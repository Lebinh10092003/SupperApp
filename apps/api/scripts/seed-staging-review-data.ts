/**
 * Deterministic, rerunnable review dataset for the staging environment.
 * It replaces only Work Schedule and Safety module data, writes a JSON
 * backup before deletion, and refuses every database except the exact
 * `supperapp_staging` database with an explicit operator confirmation.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { assertStagingReviewReset } from './staging-review-data-guard.mjs';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
assertStagingReviewReset(databaseUrl, process.env.CONFIRM_STAGING_REVIEW_RESET);

const backupDir = process.env.STAGING_REVIEW_BACKUP_DIR;
if (!backupDir) throw new Error('STAGING_REVIEW_BACKUP_DIR is required; the reset will not run without a backup destination.');

const campuses = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'];
const campusLocations: Record<string, string[]> = {
  MAIN_CAMPUS: ['Phòng họp A1', 'Hội trường tầng 2', 'Thư viện', 'Sân trường', 'Phòng Tin học'],
  CAMPUS_1: ['Phòng họp Phân hiệu 1', 'Sân Phân hiệu 1', 'Phòng đa năng', 'Phòng Y tế'],
  CAMPUS_2: ['Phòng họp Phân hiệu 2', 'Sân Phân hiệu 2', 'Phòng chuyên môn', 'Khu thể chất']
};

const eventTemplates = [
  ['Họp giao ban Ban giám hiệu', 'Rà soát tiến độ tuần và thống nhất nhiệm vụ trọng tâm.', 'MEETING'],
  ['Sinh hoạt tổ Ngữ văn', 'Trao đổi kế hoạch dạy học và phương án hỗ trợ học sinh.', 'PROFESSIONAL'],
  ['Sinh hoạt tổ Toán - Tin', 'Thống nhất nội dung chuyên đề và lịch kiểm tra chung.', 'PROFESSIONAL'],
  ['Họp hội đồng sư phạm', 'Đánh giá công tác tháng và triển khai kế hoạch tháng tới.', 'MEETING'],
  ['Dự giờ môn Tiếng Anh', 'Dự giờ, góp ý phương pháp và chia sẻ học liệu.', 'PROFESSIONAL'],
  ['Tập huấn ứng dụng công nghệ số', 'Hướng dẫn sử dụng công cụ số trong quản lý và giảng dạy.', 'TRAINING'],
  ['Chuyên đề đổi mới kiểm tra đánh giá', 'Thảo luận ma trận đề và đánh giá theo năng lực.', 'TRAINING'],
  ['Kiểm tra cơ sở vật chất', 'Rà soát phòng học, điện, nước và thiết bị an toàn.', 'INSPECTION'],
  ['Khám sức khỏe học đường', 'Phối hợp kiểm tra sức khỏe định kỳ cho học sinh.', 'HEALTH'],
  ['Sinh hoạt Liên đội', 'Triển khai hoạt động thi đua và phong trào thiếu nhi.', 'ACTIVITY'],
  ['Họp phụ huynh khối 6', 'Trao đổi tình hình học tập và phối hợp giáo dục học sinh.', 'MEETING'],
  ['Sinh hoạt chuyên môn liên khối', 'Chia sẻ kinh nghiệm tổ chức hoạt động học tích cực.', 'PROFESSIONAL'],
  ['Kiểm tra hồ sơ chuyên môn', 'Rà soát kế hoạch bài dạy và hồ sơ theo quy định.', 'INSPECTION'],
  ['Hoạt động ngoại khóa kỹ năng sống', 'Tổ chức kỹ năng tự bảo vệ và giao tiếp an toàn.', 'ACTIVITY'],
  ['Rà soát công tác tuyển sinh', 'Kiểm tra hồ sơ, dữ liệu và phương án hỗ trợ phụ huynh.', 'MEETING'],
  ['Ngày hội đọc sách', 'Giới thiệu sách mới và hoạt động đọc theo chủ đề.', 'ACTIVITY'],
  ['Diễn tập phòng cháy chữa cháy', 'Thực hành thoát nạn và sử dụng thiết bị chữa cháy.', 'TRAINING'],
  ['Tổng vệ sinh khuôn viên trường', 'Phân công vệ sinh lớp học và chăm sóc khuôn viên.', 'ACTIVITY'],
  ['Họp tổ chuyển đổi số', 'Rà soát dữ liệu dùng chung và tiến độ số hóa hồ sơ.', 'MEETING'],
  ['Họp công tác chủ nhiệm', 'Trao đổi nề nếp, chuyên cần và hỗ trợ học sinh.', 'MEETING'],
  ['Kiểm tra an toàn bếp ăn', 'Kiểm tra lưu mẫu, nguồn thực phẩm và vệ sinh khu bếp.', 'INSPECTION'],
  ['Tập huấn sơ cấp cứu', 'Thực hành xử trí các tình huống thường gặp trong trường.', 'TRAINING'],
  ['Giao lưu thể thao học sinh', 'Tổ chức thi đấu giao hữu giữa các khối lớp.', 'ACTIVITY'],
  ['Họp chuẩn bị kiểm tra giữa kỳ', 'Thống nhất lịch, phòng thi và công tác coi kiểm tra.', 'MEETING'],
  ['Chuyên đề tư vấn tâm lý học đường', 'Nhận diện sớm và hỗ trợ học sinh gặp khó khăn tâm lý.', 'TRAINING']
] as const;

const incidentTemplates = [
  ['violence_bullying', 'Hai học sinh xảy ra mâu thuẫn và xô đẩy trong giờ ra chơi, giáo viên trực đã kịp thời can thiệp.'],
  ['violence_bullying', 'Giáo viên ghi nhận dấu hiệu một học sinh bị các bạn trêu chọc kéo dài và đã mời các em trao đổi riêng.'],
  ['abuse_neglect', 'Học sinh chia sẻ dấu hiệu bị đối xử không phù hợp ngoài trường; bộ phận tư vấn đang phối hợp xác minh thận trọng.'],
  ['medical_minor', 'Học sinh bị trầy xước khi vui chơi tại sân trường, đã được sơ cứu và thông báo gia đình.'],
  ['weapon_drugs', 'Phát hiện một vật sắc nhọn trong ngăn bàn lớp học, giáo viên đã thu giữ và báo Ban giám hiệu.'],
  ['electrical_chemical', 'Ổ cắm tại hành lang có dấu hiệu lỏng và phát nhiệt, khu vực đã được khoanh lại chờ kỹ thuật xử lý.'],
  ['structural_hazard', 'Tay vịn cầu thang bị lung lay tại một điểm nối, nhà trường đã tạm ngăn lối đi liên quan.'],
  ['facility_general', 'Nước tràn từ khu rửa tay làm sàn hành lang trơn, nhân viên đã đặt biển cảnh báo và lau khô.'],
  ['traffic_gate', 'Xe dừng đỗ sát cổng trường gây cản trở lối đi bộ vào giờ đón học sinh.'],
  ['security_intrusion', 'Bảo vệ phát hiện người lạ tiếp cận khu vực lớp học và đã mời về phòng trực để xác minh.'],
  ['security_intrusion', 'Một học sinh báo thất lạc ví tại khu thể chất, camera và sổ bàn giao đang được kiểm tra.'],
  ['fire_explosion', 'Có mùi khét nhẹ gần tủ điện phòng chức năng, nguồn điện khu vực đã được ngắt để kiểm tra.'],
  ['food_safety', 'Một số học sinh phản ánh suất ăn có mùi vị bất thường, bếp đã dừng phục vụ lô thực phẩm liên quan.'],
  ['natural_disaster', 'Cành cây lớn có dấu hiệu nứt sau mưa, khu vực bên dưới đã được rào tạm thời.'],
  ['facility_general', 'Cánh cửa tủ thiết bị bị bung bản lề, có nguy cơ va vào học sinh khi sử dụng.'],
  ['violence_bullying', 'Hai học sinh tranh cãi sau giờ học; giáo viên chủ nhiệm đang tổ chức hòa giải và theo dõi.'],
  ['weapon_drugs', 'Phát hiện vật dụng không rõ nguồn gốc tại khu vực hạn chế, nhà trường đã niêm phong để xác minh.'],
  ['medical_minor', 'Học sinh bị đau cổ chân trong giờ thể dục, đã được nghỉ vận động và theo dõi tại phòng y tế.'],
  ['medical_emergency', 'Học sinh choáng nhẹ trong giờ chào cờ, nhân viên y tế đã kiểm tra và liên hệ gia đình.'],
  ['security_intrusion', 'Học sinh đi vào khu vực kho thiết bị khi chưa được phép, giáo viên đã đưa em trở lại lớp và nhắc nhở.'],
  ['facility_hygiene', 'Khu vệ sinh có nước đọng và mùi bất thường, nhân viên vệ sinh đang xử lý nguyên nhân.'],
  ['cyberbullying', 'Phát hiện nội dung chế giễu một học sinh trong nhóm trò chuyện của lớp, giáo viên chủ nhiệm đã tiếp nhận thông tin.'],
  ['data_privacy', 'Hình ảnh sinh hoạt lớp bị chia sẻ ngoài nhóm nội bộ khi chưa có sự đồng ý, nhà trường đang yêu cầu gỡ bỏ.'],
  ['transport_bus', 'Xe đưa đón đến muộn và dừng sai vị trí quy định, bộ phận phụ trách đang làm việc với đơn vị vận hành.'],
  ['facility_general', 'Quạt trần trong lớp phát tiếng động bất thường, lớp đã tạm ngừng sử dụng thiết bị để kiểm tra.']
] as const;

const states = ['Mới tiếp nhận', 'Đang phân loại', 'Khẩn cấp đang xử lý', 'Đã giao', 'Đang xử lý', 'Chờ bên ngoài', 'Đang theo dõi', 'Đề nghị đóng', 'Đã đóng'];
const priorities = ['P0', 'P1', 'P2', 'P3'];
const publicCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const backupTables = [
  'ltc_events', 'ltc_tasks', 'ltc_audit_logs', 'reports', 'report_identities', 'report_supplements',
  'incidents', 'audit_logs', 'sla_clocks', 'notify_requests', 'admin_notifications', 'public_codes', 'evidence', 'id_counters'
];

function atLocalDay(offsetDays: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function publicCodeToken(seed: number) {
  let value = seed * 104729;
  let token = '';
  for (let i = 0; i < 4; i++) {
    token += publicCodeAlphabet[value % publicCodeAlphabet.length];
    value = Math.floor(value / publicCodeAlphabet.length) + seed + i;
  }
  return token;
}

async function backup(client: pg.PoolClient) {
  await mkdir(backupDir!, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(backupDir!, `review-data-before-${stamp}`);
  await mkdir(target, { recursive: false, mode: 0o700 });
  for (const table of backupTables) {
    const result = await client.query(`select * from ${table}`);
    await writeFile(join(target, `${table}.json`), JSON.stringify(result.rows, null, 2), { mode: 0o600 });
  }
  console.log(`BACKUP_PATH=${target}`);
  return target;
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const identity = await client.query('select current_database() database, current_schema() schema');
    if (identity.rows[0]?.database !== 'supperapp_staging') throw new Error('Runtime database identity mismatch; reset aborted.');
    console.log(`DATABASE_VERIFIED=${identity.rows[0].database}|${identity.rows[0].schema}`);

    await client.query('begin isolation level repeatable read');
    await backup(client);

    const accountRows = await client.query("select per_id, display_name from accounts where display_name is not null order by case when display_name like 'Người Chỉ Huy%' then 1 else 0 end, display_name");
    const people = accountRows.rows.filter((row) => row.per_id && row.display_name && !String(row.display_name).includes('Người Chỉ Huy'));
    if (people.length < 4) throw new Error('At least four staging accounts are required for coherent ownership and assignments.');
    const classRows = await client.query('select class_name from classes where active order by class_name');
    const classNames = classRows.rows.map((row) => String(row.class_name));
    if (classNames.length === 0) throw new Error('No active staging classes are available.');

    await client.query('delete from ltc_tasks');
    await client.query('delete from ltc_events');
    await client.query("delete from ltc_audit_logs where entity_type in ('event','task')");
    await client.query('delete from admin_notifications');
    await client.query('delete from notify_requests');
    await client.query('delete from sla_clocks');
    await client.query('delete from audit_logs');
    await client.query('delete from report_supplements');
    await client.query('delete from report_identities');
    await client.query('delete from evidence');
    await client.query('delete from public_codes');
    await client.query('delete from incidents');
    await client.query('delete from reports');

    const eventIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const [title, description, type] = eventTemplates[i % eventTemplates.length]!;
      const campus = campuses[i % campuses.length]!;
      const startAt = atLocalDay(i - 24, 7 + (i % 9), i % 2 ? 30 : 0);
      const endAt = new Date(startAt.getTime() + (60 + (i % 4) * 30) * 60_000);
      const chair = people[i % people.length]!.per_id;
      const participants = [people[(i + 1) % people.length]!.per_id, people[(i + 3) % people.length]!.per_id];
      const scope = i % 5 === 0 ? 'SCHOOL_WIDE' : 'CAMPUS';
      const status = i % 13 === 0 ? 'CANCELLED' : i % 7 === 0 ? 'DRAFT' : i % 6 === 0 ? 'PENDING_APPROVAL' : 'PUBLISHED';
      const inserted = await client.query(
        `insert into ltc_events
          (title,description,type,priority,campus_id,scope,start_at,end_at,location,chair_per_id,participant_per_ids,external_participants,status,cancellation_note,approvals,created_by_per_id,created_at,updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) returning id`,
        [
          title, description, type, i % 9 === 0 ? 'HIGH' : 'NORMAL', campus, scope, startAt, endAt,
          campusLocations[campus]![i % campusLocations[campus]!.length], chair, participants,
          i % 8 === 0 ? ['Đại diện Ban phụ huynh'] : [], status,
          status === 'CANCELLED' ? 'Điều chỉnh do trùng kế hoạch chung của nhà trường.' : null,
          JSON.stringify(scope === 'SCHOOL_WIDE' && status === 'PUBLISHED' ? [{ role: 'R.PRINCIPAL', perId: people[0]!.per_id, at: startAt.toISOString() }] : []),
          people[(i + 2) % people.length]!.per_id, new Date(startAt.getTime() - 5 * 86400_000)
        ]
      );
      const eventId = inserted.rows[0].id;
      eventIds.push(eventId);
      await client.query(
        `insert into ltc_audit_logs (entity_type,entity_id,action,actor_per_id,after,created_at) values ('event',$1,'event.created',$2,$3,$4)`,
        [eventId, chair, JSON.stringify({ title, status, scope }), new Date(startAt.getTime() - 5 * 86400_000)]
      );
    }

    for (let i = 0; i < 40; i++) {
      const dueAt = atLocalDay(i - 18, 16, 30);
      const task = await client.query(
        `insert into ltc_tasks
          (event_id,title,description,priority,campus_id,assignee_per_id,collaborator_per_ids,location,start_at,due_at,status,acceptance_note,created_by_per_id,created_at,updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) returning id`,
        [
          eventIds[i], `Chuẩn bị nội dung cho ${eventTemplates[i % eventTemplates.length]![0].toLowerCase()}`,
          'Hoàn thiện tài liệu, phối hợp các bộ phận liên quan và báo cáo đúng hạn.', i % 7 === 0 ? 'HIGH' : 'NORMAL',
          campuses[i % campuses.length], people[(i + 1) % people.length]!.per_id, [people[(i + 2) % people.length]!.per_id],
          campusLocations[campuses[i % campuses.length]!]![0], new Date(dueAt.getTime() - 3 * 86400_000), dueAt,
          i % 3 === 0 ? 'COMPLETED' : 'ASSIGNED', i % 3 === 0 ? 'Đã hoàn thành và bàn giao đúng yêu cầu.' : '',
          people[i % people.length]!.per_id, new Date(dueAt.getTime() - 7 * 86400_000)
        ]
      );
      await client.query(
        `insert into ltc_audit_logs (entity_type,entity_id,action,actor_per_id,after,created_at) values ('task',$1,'task.created',$2,$3,$4)`,
        [task.rows[0].id, people[i % people.length]!.per_id, JSON.stringify({ eventId: eventIds[i] }), new Date(dueAt.getTime() - 7 * 86400_000)]
      );
    }

    for (let i = 0; i < 50; i++) {
      const seq = String(i + 1).padStart(4, '0');
      const reportSeq = String(i + 1).padStart(5, '0');
      const incidentId = `SC.2610.${seq}`;
      const reportId = `TB.2610.${reportSeq}`;
      const publicCode = `GV-${publicCodeToken(i + 1)}-${publicCodeToken(i + 51)}`;
      const [category, content] = incidentTemplates[i % incidentTemplates.length]!;
      const campus = campuses[(i + 1) % campuses.length]!;
      const state = states[i % states.length]!;
      const priority = priorities[i % priorities.length]!;
      const occurredAt = atLocalDay(-(i % 42), 7 + (i % 11), (i * 7) % 60);
      const updatedAt = new Date(occurredAt.getTime() + (2 + (i % 36)) * 3600_000);
      const className = ['violence_bullying', 'abuse_neglect', 'cyberbullying', 'data_privacy'].includes(category)
        ? classNames[i % classNames.length]
        : null;
      const isClosed = state === 'Đã đóng';
      const hasCommander = !['Mới tiếp nhận', 'Đang phân loại'].includes(state);
      const commander = hasCommander ? people[(i + 1) % people.length]!.per_id : null;
      const reporter = people[(i + 4) % people.length]!;

      await client.query(
        `insert into reports
          (report_id,public_code,channel,campus_id,category_code,occurred_at,anonymous,still_dangerous,confidentiality,content,class_name,reporter_role,created_by_per_id,created_at)
         values ($1,$2,'internal',$3,$4,$5,false,$6,$7,$8,$9,'staff',$10,$5)`,
        [reportId, publicCode, campus, category, occurredAt, priority === 'P0', ['abuse_neglect', 'weapon_drugs'].includes(category) ? 'C4' : 'C2', content, className, reporter.per_id]
      );
      await client.query(
        `insert into report_identities (report_id,contact_name,contact_channel,safe_contact_time,email,phone)
         values ($1,$2,'email','Sau 16:30',$3,$4)`,
        [reportId, reporter.display_name, `lienhe.phuhuynh${String(i + 1).padStart(2, '0')}@giangvo.edu.vn`, `090${String(3100000 + i).padStart(7, '0')}`]
      );
      await client.query('insert into public_codes (code,report_id,created_at) values ($1,$2,$3)', [publicCode, reportId, occurredAt]);
      await client.query(
        `insert into incidents
          (incident_id,campus_id,category_code,class_name,priority,confidentiality,state,report_ids,commander_per_id,assigned_task_per_ids,last_note,resolution_deadline_at,resolution_deadline_set_by,closed_by,closed_at,created_at,updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          incidentId, campus, category, className, priority, ['abuse_neglect', 'weapon_drugs'].includes(category) ? 'C4' : 'C2', state,
          JSON.stringify([reportId]), commander, JSON.stringify(hasCommander ? [people[(i + 2) % people.length]!.per_id] : []),
          isClosed ? 'Đã xác minh biện pháp khắc phục và thống nhất kết thúc theo dõi.' : 'Đang phối hợp xử lý theo quy trình của nhà trường.',
          hasCommander && !isClosed ? atLocalDay(3 + (i % 8), 17) : null, hasCommander ? people[0]!.per_id : null,
          isClosed ? people[0]!.per_id : null, isClosed ? updatedAt : null, occurredAt, updatedAt
        ]
      );

      const auditSteps = hasCommander
        ? [['incident.created', reporter.per_id], ['incident.commander_assigned', people[0]!.per_id], ['incident.status_changed', commander]]
        : [['incident.created', reporter.per_id], ['incident.classification_started', people[0]!.per_id]];
      for (let step = 0; step < auditSteps.length; step++) {
        await client.query(
          `insert into audit_logs (log_id,occurred_at,actor_per_id,role_used,action,object_id,after,reason,request_id,correlation_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            crypto.randomUUID(), new Date(occurredAt.getTime() + step * 45 * 60_000), auditSteps[step]![1], step === 0 ? 'R.TEACHER' : 'R.PRINCIPAL',
            auditSteps[step]![0], incidentId, JSON.stringify({ state, priority, commanderPerId: commander }),
            step === 0 ? 'Ghi nhận thông tin và mở hồ sơ xử lý.' : 'Cập nhật theo tiến độ xử lý thực tế.',
            `review-${i + 1}-${step + 1}`, `incident-${incidentId}`
          ]
        );
      }

      if (!isClosed) {
        for (const [label, minutes] of [['ack', priority === 'P0' ? 1 : priority === 'P1' ? 5 : 30], ['assign', priority === 'P0' ? 1 : priority === 'P1' ? 15 : 120]] as const) {
          const deadline = new Date(occurredAt.getTime() + minutes * 60_000);
          await client.query(
            `insert into sla_clocks (object_id,clock_label,priority,start_at,deadline_at,status,paused,pause_history)
             values ($1,$2,$3,$4,$5,$6,false,'[]'::jsonb)`,
            [incidentId, label, priority, occurredAt, deadline, hasCommander ? 'met' : deadline < new Date() ? 'overdue' : 'running']
          );
        }
      }
    }

    await client.query(
      `insert into id_counters (prefix,period,value,updated_at) values ('SC','2610',50,now()),('TB','2610',50,now())
       on conflict (prefix,period) do update set value=greatest(id_counters.value,excluded.value),updated_at=excluded.updated_at`
    );

    const validation = await client.query(`
      select
        (select count(*)::int from ltc_events) work_schedule_count,
        (select count(*)::int from incidents) safety_incident_count,
        (select count(*)::int from ltc_tasks t left join ltc_events e on e.id=t.event_id where t.event_id is not null and e.id is null) orphan_tasks,
        (select count(*)::int from incidents i left join reports r on r.report_id = i.report_ids->>0 where r.report_id is null) orphan_incident_reports,
        (select count(*)::int from incidents i where i.commander_per_id is not null and not exists (select 1 from accounts a where a.per_id=i.commander_per_id)) orphan_commanders
    `);
    const counts = validation.rows[0];
    if (counts.work_schedule_count !== 50 || counts.safety_incident_count !== 50) throw new Error(`Exact count validation failed: ${JSON.stringify(counts)}`);
    if (counts.orphan_tasks || counts.orphan_incident_reports || counts.orphan_commanders) throw new Error(`Related data integrity validation failed: ${JSON.stringify(counts)}`);

    const forbidden = await client.query(`
      select
        (select count(*)::int from ltc_events where title ~* '(test|demo|fake|sample|abccc|lorem ipsum|dummy)' or description ~* '(test|demo|fake|sample|abccc|lorem ipsum|dummy)') work_forbidden,
        (select count(*)::int from reports where content ~* '(test|demo|fake|sample|abccc|lorem ipsum|dummy)') safety_forbidden
    `);
    if (forbidden.rows[0].work_forbidden || forbidden.rows[0].safety_forbidden) throw new Error(`Forbidden review text found: ${JSON.stringify(forbidden.rows[0])}`);

    await client.query('commit');
    console.log(`WORK_SCHEDULE_COUNT=${counts.work_schedule_count}`);
    console.log(`SAFETY_INCIDENT_COUNT=${counts.safety_incident_count}`);
    console.log(`RELATED_DATA_INTEGRITY=PASS`);
    console.log(`FORBIDDEN_PLACEHOLDER_TEXT=0`);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
