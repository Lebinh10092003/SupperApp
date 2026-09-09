# Module Identity — dùng chung An toàn + Lịch công tác

Port từ Firestore collection cùng tên (project An toàn trường học,
`functions/src/index.js`), field/shape đối chiếu trực tiếp từ code thật.
Xem `SUPERAPP_MIGRATION_COORDINATION/DECISIONS.md` để biết bối cảnh.

## File

- `roles.ts` — 16 mã `ROLE.*` + trần bí mật mặc định (`ROLE_DEFAULT_CEILING`)
  + `WHOLE_SCHOOL_ROLES` + `CAMPUS_IDS`. Port từ `catalog.js`. HẰNG SỐ ứng
  dụng, không phải bảng DB — import trực tiếp, đừng hard-code lại mã vai
  trò ở module khác.
- `identity.schema.ts` — 7 bảng Drizzle: `accounts`, `assignments`,
  `peopleDirectory`, `dutyShifts`, `delegations`, `homeroomAssignments`,
  `gradeSupervisorAssignments`.
- `actor-context.ts` — `loadActorContext(db, uid, now?)`, port 1-1 từ
  `loadActorContext` gốc (`index.js:388-436`). Trả về `{ perId, session,
  roles[], onDutyNow, activeDelegations[] }` — dùng làm input cho authz
  9 bước (khi module An toàn được port) và cho việc xác định người trực/
  quyền tạm thời ở module Lịch công tác.
- `actor-context.smoke.test.ts` — test PASS thật với Postgres (role hết
  hạn/chưa hiệu lực bị lọc đúng, ca trực/uỷ quyền tính đúng, lỗi rõ ràng
  khi uid chưa có account).

## Điểm khác biệt có chủ đích so với bản Firestore gốc

Bản gốc tải HẾT `assignments`/`duty_shifts`/`delegations` theo `per_id` rồi
lọc còn-hiệu-lực bằng JavaScript. Bản Postgres này **vẫn tải hết rồi lọc
bằng JS y hệt** (không đẩy điều kiện ngày xuống SQL) để giữ ĐÚNG 1-1 hành
vi gốc, dễ đối chiếu khi review — có thể tối ưu đẩy xuống `WHERE` sau khi
đã có dữ liệu thật để đo hiệu năng, không tối ưu sớm khi chưa cần.

## Gap đã biết (chưa xác nhận được từ code, ai port dữ liệu thật cần lưu ý)

`delegations` Firestore doc GỐC có thể có field khác ngoài 4 field code
hiện tại đọc tới (`to_per_id`, `campus_id`, `from`, `to`) — vd lý do uỷ
quyền, người uỷ quyền (`from_per_id`). Trước khi import dữ liệu thật, kiểm
tra lại 1 doc mẫu trên Firestore Console để bổ sung cột nếu cần.

## Dùng trong module khác

```ts
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';

const actor = await loadActorContext(db, req.user.uid);
```
