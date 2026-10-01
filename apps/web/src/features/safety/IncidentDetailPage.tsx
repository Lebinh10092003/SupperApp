/**
 * IncidentDetailPage.tsx — Chunk B. Trang chi tiết 1 hồ sơ sự cố
 * (`GET /api/safety/incidents/:id`) + 4 hành động: đổi trạng thái, đổi ưu
 * tiên, mở lại (chỉ khi đã đóng), chỉ định chỉ huy. Route: `/safety/incidents/:id`
 * — route list->detail lồng nhau ĐẦU TIÊN trong app (không có tiền lệ để
 * copy quy ước `useParams`).
 *
 * StatusChip/PriorityChip import từ `./components/*`.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, TriangleAlert, RotateCcw, UserPlus, UsersRound, UserCheck, Pencil, Loader2 } from 'lucide-react';

import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { StatusChip } from './components/StatusChip';
import { PriorityChip } from './components/PriorityChip';
import { EvidenceGallery } from './EvidenceGallery';
import { ChangeStatusDialog, type ChangeStatusTarget } from './dialogs/ChangeStatusDialog';
import { ChangePriorityDialog, type ChangePriorityTarget } from './dialogs/ChangePriorityDialog';
import { ReopenIncidentDialog, type ReopenIncidentTarget } from './dialogs/ReopenIncidentDialog';
import { AssignCommanderDialog, type AssignCommanderTarget } from './dialogs/AssignCommanderDialog';
import { AddParticipantDialog, type AddParticipantTarget } from './dialogs/AddParticipantDialog';
import { ReasonPromptDialog } from './dialogs/ReasonPromptDialog';
import { ContactInfoButton } from './components/ContactInfoButton';
import { CorrectClassificationDialog, type CorrectClassificationTarget } from './dialogs/CorrectClassificationDialog';
import { CAMPUS_LABEL, SLA_CLOCK_LABEL, SLA_STATUS_LABEL } from './constants';
import { useActor } from './hooks/useActor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Toast, type ToastState } from '../../components/Toast';

interface EvidenceSummary {
  evidenceId: string;
  fileType: string;
  sizeBytes: number;
  scanStatus: string;
}

interface ReportSubmission {
  reportId: string;
  content: string;
  occurredAt: string;
  channel: string;
  reporterRole: string | null;
  stillDangerous: boolean;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

interface IncidentDetail {
  incidentId: string;
  // Nullable từ 2026-09-22 — hồ sơ CHƯA ai tiếp nhận thì chưa có mức ưu tiên.
  priority: 'P0' | 'P1' | 'P2' | 'P3' | null;
  suggestedPriority?: 'P0' | 'P1' | 'P2' | 'P3' | null;
  confidentiality: 'C1' | 'C2' | 'C3' | 'C4';
  state: string;
  campusId: string;
  categoryCode?: string;
  categoryLabel?: string | null;
  className?: string | null;
  suggestedParticipants?: Array<{ perId: string; label: string }>;
  commanderPerId?: string | null;
  commanderName?: string | null;
  participantPerIds?: string[];
  participantLabels?: Record<string, string>;
  pendingJoinRequests?: Array<{ perId: string; reason: string; requestedAt: string }>;
  pendingJoinRequestLabels?: Record<string, string>;
  lastNote?: string | null;
  reopenReason?: string | null;
  cancelRequestedBy?: string | null;
  cancelRequestReason?: string | null;
  cancelRequestedAt?: string | null;
  canViewEvidence?: boolean;
  evidenceList?: EvidenceSummary[];
  reportSubmissions?: ReportSubmission[];
  slaClocks?: Record<string, { deadlineAt: string; status: string; paused: boolean }>;
  createdAt?: string;
  updatedAt?: string;
}

const STATE_CLOSED = 'Đã đóng';
const SENIOR_ROLE_IDS = new Set(['R.PRINCIPAL', 'R.VICE_PRINCIPAL', 'R.DEPT_HEAD']);
function isSeniorRole(actor: { roles: Array<{ roleId: string }> } | null | undefined) {
  return !!actor?.roles?.some((r) => SENIOR_ROLE_IDS.has(r.roleId));
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { actor } = useActor();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const [statusTarget, setStatusTarget] = useState<ChangeStatusTarget | null>(null);
  const [priorityTarget, setPriorityTarget] = useState<ChangePriorityTarget | null>(null);
  const [reopenTarget, setReopenTarget] = useState<ReopenIncidentTarget | null>(null);
  const [classificationTarget, setClassificationTarget] = useState<CorrectClassificationTarget | null>(null);
  const [commanderTarget, setCommanderTarget] = useState<AssignCommanderTarget | null>(null);
  const [addParticipantTarget, setAddParticipantTarget] = useState<AddParticipantTarget | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [cancelAckDialogOpen, setCancelAckDialogOpen] = useState(false);
  const [decidingCancel, setDecidingCancel] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackDialogOpen, setAckDialogOpen] = useState(false);
  const [ackPriority, setAckPriority] = useState('');
  // Bấm "Tiếp nhận xử lý" KHÔNG được gọi thẳng API nữa (Sin chốt
  // 2026-09-24) — phải qua modal xác nhận này trước. Tài khoản cấp cao
  // thấy thêm lựa chọn "Chỉ định người khác" ngay trong modal, dẫn sang
  // AssignCommanderDialog có sẵn thay vì tự tiếp nhận.
  const [ackChoiceOpen, setAckChoiceOpen] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    api
      .get<IncidentDetail>(`/api/safety/incidents/${id}`)
      .then(setIncident)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAcknowledge = async () => {
    if (!incident) return;
    // Hồ sơ chưa có mức ưu tiên (chưa ai chọn) -> BẮT BUỘC chọn trước khi
    // tiếp nhận, mở dialog thay vì gọi thẳng API (Sin chốt 2026-09-22).
    if (!incident.priority) {
      setAckPriority(incident.suggestedPriority || '');
      setAckDialogOpen(true);
      return;
    }
    setAcknowledging(true);
    try {
      await api.post<{ incidentId: string; commanderPerId: string }>(`/api/safety/incidents/${incident.incidentId}/acknowledge`, {});
      load();
      setToast({ message: 'Bạn đã tiếp nhận xử lý hồ sơ này — trở thành chỉ huy sự vụ.', severity: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
    } finally {
      setAcknowledging(false);
    }
  };

  const handleAcknowledgeWithPriority = async () => {
    if (!incident || !ackPriority) return;
    setAcknowledging(true);
    try {
      await api.post<{ incidentId: string; commanderPerId: string }>(`/api/safety/incidents/${incident.incidentId}/acknowledge`, { priority: ackPriority });
      setAckDialogOpen(false);
      load();
      setToast({ message: 'Bạn đã tiếp nhận xử lý hồ sơ này — trở thành chỉ huy sự vụ.', severity: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
    } finally {
      setAcknowledging(false);
    }
  };

  const decideCancelAcknowledgment = async (approve: boolean) => {
    if (!incident) return;
    setDecidingCancel(true);
    try {
      await api.post(`/api/safety/incidents/${incident.incidentId}/cancel-acknowledgment/decide`, { approve });
      load();
      setToast({ message: approve ? 'Đã duyệt huỷ tiếp nhận.' : 'Đã từ chối yêu cầu huỷ tiếp nhận.', severity: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
    } finally {
      setDecidingCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-8">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4 text-slate-500">
          <ArrowLeft className="size-4" />
          Quay lại
        </Button>
      </div>
    );
  }

  if (!incident) return null;

  // Sin chốt 2026-09-22: "người tiếp nhận hoặc người tham gia hoặc tài
  // khoản cấp cao mới đổi trạng thái được" — chỉ gợi ý hiển thị phía
  // client, phân quyền thật vẫn ở server (authz.ts).
  const isSenior = isSeniorRole(actor);
  const isCommander = !!actor?.perId && incident.commanderPerId === actor.perId;
  const isParticipant = !!actor?.perId && (incident.participantPerIds || []).includes(actor.perId);
  const canEdit = isCommander || isParticipant || isSenior;
  // Đổi ưu tiên THU HẸP HƠN — chỉ chỉ huy hoặc cấp cao, participant thường không đổi được.
  const canEditPriority = isCommander || isSenior;

  return (
    <>
      <PageHeader
        title={`Hồ sơ sự cố ${incident.incidentId}`}
        subtitle={incident.categoryLabel || incident.categoryCode || undefined}
        action={
          <Button asChild variant="ghost" className="text-slate-500">
            <Link to="/safety/incidents">
              <ArrowLeft className="size-4" />
              Quay lại danh sách
            </Link>
          </Button>
        }
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="mb-5 flex flex-wrap gap-1.5">
        <StatusChip state={incident.state} />
        <PriorityChip priority={incident.priority} />
      </div>

      {incident.cancelRequestedAt && (
        <Alert className="mb-5 flex items-center justify-between border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-900">
            Đang chờ duyệt huỷ tiếp nhận — {incident.commanderName || incident.cancelRequestedBy} xin huỷ, lý do: {incident.cancelRequestReason}
          </AlertDescription>
          {isSeniorRole(actor) && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={decidingCancel} onClick={() => decideCancelAcknowledgment(true)} className="bg-emerald-600 hover:bg-emerald-700">
                Duyệt huỷ
              </Button>
              <Button size="sm" variant="outline" disabled={decidingCancel} onClick={() => decideCancelAcknowledgment(false)} className="border-red-300 text-red-600 hover:bg-red-50">
                Từ chối
              </Button>
            </div>
          )}
        </Alert>
      )}

      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-slate-200 p-5">
          <p className="mb-3 text-sm font-bold">Thông tin chung</p>
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              Cơ sở: <strong>{CAMPUS_LABEL[incident.campusId] || incident.campusId}</strong>
            </p>
            {incident.className && (
              <p className="text-sm">
                Lớp liên quan: <strong>{incident.className}</strong>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-sm">
                Chỉ huy: <strong>{incident.commanderName || 'Chưa có ai tiếp nhận'}</strong>
              </p>
              {incident.commanderPerId && <ContactInfoButton perId={incident.commanderPerId} name={incident.commanderName || incident.commanderPerId} />}
            </div>
            {incident.participantPerIds && incident.participantPerIds.length > 0 && (
              <div className="flex flex-wrap items-start gap-1">
                <p className="text-sm">Người tham gia xử lý khác:</p>
                {incident.participantPerIds.map((p) => (
                  <div key={p} className="inline-flex items-center gap-0.5">
                    <p className="text-sm font-bold">{incident.participantLabels?.[p] || p}</p>
                    <ContactInfoButton perId={p} name={incident.participantLabels?.[p] || p} />
                  </div>
                ))}
              </div>
            )}
            {incident.lastNote && <p className="text-sm">Ghi chú gần nhất: {incident.lastNote}</p>}
            {incident.reopenReason && <p className="text-sm">Lý do mở lại: {incident.reopenReason}</p>}
            <p className="text-xs text-slate-500">
              Tạo lúc {formatDateTime(incident.createdAt)} — cập nhật {formatDateTime(incident.updatedAt)}
            </p>
          </div>
        </div>

        {(isCommander || isSenior) && incident.pendingJoinRequests && incident.pendingJoinRequests.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="mb-3 text-sm font-bold">Yêu cầu tham gia đang chờ duyệt ({incident.pendingJoinRequests.length})</p>
            <div className="flex flex-col divide-y divide-amber-200">
              {incident.pendingJoinRequests.map((r) => (
                <div key={r.perId} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-bold">{incident.pendingJoinRequestLabels?.[r.perId] || r.perId}</p>
                    <p className="text-xs text-slate-500">
                      Lý do: {r.reason} — {formatDateTime(r.requestedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        await api.post(`/api/safety/incidents/${incident.incidentId}/join-requests/${r.perId}/approve`, {});
                        load();
                        setToast({ message: `Đã duyệt cho ${incident.pendingJoinRequestLabels?.[r.perId] || r.perId} tham gia.`, severity: 'success' });
                      }}
                      className="bg-green-600 font-semibold hover:bg-green-700"
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await api.post(`/api/safety/incidents/${incident.incidentId}/join-requests/${r.perId}/reject`, {});
                        load();
                        setToast({ message: `Đã từ chối yêu cầu của ${incident.pendingJoinRequestLabels?.[r.perId] || r.perId}.`, severity: 'success' });
                      }}
                      className="border-red-300 font-semibold text-red-600 hover:bg-red-50"
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {incident.slaClocks && Object.keys(incident.slaClocks).length > 0 && (
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="mb-3 text-sm font-bold">Đồng hồ SLA</p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(incident.slaClocks).map(([label, clock]) => (
                <p key={label} className="text-sm">
                  {SLA_CLOCK_LABEL[label] || label}: hạn {formatDateTime(clock.deadlineAt)} — {SLA_STATUS_LABEL[clock.status] || clock.status}
                  {clock.paused ? ' (đang tạm dừng)' : ''}
                </p>
              ))}
            </div>
          </div>
        )}

        {incident.reportSubmissions && incident.reportSubmissions.length > 0 && (
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="mb-3 text-sm font-bold">
              Nội dung tin báo gốc{incident.reportSubmissions.length > 1 ? ` (${incident.reportSubmissions.length} lượt gửi)` : ''}
            </p>
            <div className="flex flex-col divide-y divide-slate-200">
              {incident.reportSubmissions.map((r) => (
                <div key={r.reportId} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm whitespace-pre-wrap">{r.content || <em>(không có nội dung)</em>}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(r.occurredAt)}
                    {r.stillDangerous ? ' — còn nguy hiểm lúc gửi' : ''}
                  </p>
                  {(r.contactName || r.email || r.phone) && (
                    <p className="mt-1 text-sm">
                      Liên hệ người báo tin
                      {r.contactName ? ' (' + r.contactName + ')' : ''}:{' '}
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                          {r.email}
                        </a>
                      )}
                      {r.email && r.phone ? ' · ' : ''}
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="text-primary hover:underline">
                          {r.phone}
                        </a>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-5">
          <EvidenceGallery evidenceList={incident.evidenceList || []} canView={Boolean(incident.canViewEvidence)} />
        </div>
      </div>

      <Separator className="my-6" />

      <div className="flex flex-wrap gap-2.5">
        {!incident.commanderPerId && (
          <Button onClick={() => setAckChoiceOpen(true)} disabled={acknowledging} className="bg-green-600 hover:bg-green-700">
            {acknowledging ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
            {acknowledging ? 'Đang tiếp nhận...' : 'Tiếp nhận xử lý'}
          </Button>
        )}
        {actor?.perId && (incident.commanderPerId === actor.perId || isSenior) && (
          <Button
            variant="outline"
            onClick={() =>
              setAddParticipantTarget({
                incidentId: incident.incidentId,
                suggested: incident.suggestedParticipants,
                current: [
                  ...(incident.commanderPerId ? [{ perId: incident.commanderPerId, label: (incident.commanderName || incident.commanderPerId) + ' (chỉ huy)' }] : []),
                  ...(incident.participantPerIds || []).map((p) => ({ perId: p, label: incident.participantLabels?.[p] || p }))
                ]
              })
            }
            className="font-semibold"
          >
            <UsersRound className="size-4" />
            Thêm người xử lý
          </Button>
        )}
        {actor?.perId && incident.commanderPerId === actor.perId && !incident.cancelRequestedAt && (
          <Button variant="outline" onClick={() => setCancelAckDialogOpen(true)} className="border-red-300 text-red-600 hover:bg-red-50">
            Huỷ tiếp nhận
          </Button>
        )}
        {actor?.perId &&
          incident.commanderPerId &&
          incident.commanderPerId !== actor.perId &&
          !(incident.participantPerIds || []).includes(actor.perId) &&
          !(incident.pendingJoinRequests || []).some((r) => r.perId === actor.perId) && (
            <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
              <UsersRound className="size-4" />
              Tham gia sự vụ
            </Button>
          )}
        {actor?.perId && (incident.pendingJoinRequests || []).some((r) => r.perId === actor.perId) && (
          <Button variant="outline" disabled>
            Đang chờ chỉ huy duyệt tham gia
          </Button>
        )}
        {actor?.perId && incident.commanderPerId !== actor.perId && (incident.participantPerIds || []).includes(actor.perId) && (
          <Button variant="outline" onClick={() => setLeaveDialogOpen(true)} className="border-red-300 text-red-600 hover:bg-red-50">
            Rời khỏi sự vụ
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" onClick={() => setStatusTarget({ incidentId: incident.incidentId, state: incident.state })}>
            <ArrowLeftRight className="size-4" />
            Đổi trạng thái
          </Button>
        )}
        {canEditPriority && (
          <Button variant="outline" onClick={() => setPriorityTarget({ incidentId: incident.incidentId, priority: incident.priority })}>
            <TriangleAlert className="size-4" />
            Đổi ưu tiên
          </Button>
        )}
        {incident.state === STATE_CLOSED && (
          <Button
            variant="outline"
            onClick={() => setReopenTarget({ incidentId: incident.incidentId })}
            className="border-red-300 font-semibold text-red-600 hover:bg-red-50"
          >
            <RotateCcw className="size-4" />
            Mở lại hồ sơ
          </Button>
        )}
        {/* Chỉ hiện khi ĐÃ có chỉ huy (đổi chỉ huy) — Sin chốt 2026-09-24:
            lúc CHƯA có chỉ huy, nút này trùng hệt lựa chọn "Chỉ định người
            khác" trong modal xác nhận tiếp nhận (setAckChoiceOpen ở trên),
            giữ cả 2 là thừa. */}
        {isSenior && incident.commanderPerId && (
          <Button
            variant="outline"
            onClick={() =>
              setCommanderTarget({
                incidentId: incident.incidentId,
                commanderPerId: incident.commanderPerId,
                commanderName: incident.commanderName
              })
            }
            className="font-semibold"
          >
            <UserPlus className="size-4" />
            Đổi chỉ huy
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => setClassificationTarget({ incidentId: incident.incidentId, currentClassName: incident.className || null })}
            className="font-semibold"
          >
            <Pencil className="size-4" />
            Sửa lớp liên quan
          </Button>
        )}
      </div>

      <ChangeStatusDialog
        target={statusTarget}
        onClose={() => setStatusTarget(null)}
        onChanged={(result) => {
          setIncident((prev) => (prev ? { ...prev, state: result.state } : prev));
          setToast({ message: `Đã đổi trạng thái sang '${result.state}'.`, severity: 'success' });
        }}
      />
      <ChangePriorityDialog
        target={priorityTarget}
        onClose={() => setPriorityTarget(null)}
        onChanged={(result) => {
          setIncident((prev) => (prev ? { ...prev, priority: result.priority as IncidentDetail['priority'] } : prev));
          setToast({ message: `Đã đổi mức ưu tiên sang ${result.priority}.`, severity: 'success' });
        }}
      />
      <ReopenIncidentDialog
        target={reopenTarget}
        onClose={() => setReopenTarget(null)}
        onChanged={() => {
          load();
          setToast({ message: 'Đã mở lại hồ sơ.', severity: 'success' });
        }}
      />
      <AssignCommanderDialog
        target={commanderTarget}
        onClose={() => setCommanderTarget(null)}
        onChanged={(result) => {
          load();
          setToast({ message: `Đã chỉ định chỉ huy: ${result.commanderName}.`, severity: 'success' });
        }}
      />
      <AddParticipantDialog
        target={addParticipantTarget}
        onClose={() => setAddParticipantTarget(null)}
        onChanged={(result) => {
          load();
          setToast({ message: `Đã thêm ${result.personName} cùng tham gia xử lý.`, severity: 'success' });
        }}
      />
      <ReasonPromptDialog
        open={joinDialogOpen}
        title="Tham gia sự vụ"
        description={
          incident.commanderPerId && !isSenior
            ? `Hồ sơ ${incident.incidentId} đã có chỉ huy — yêu cầu tham gia của bạn cần chỉ huy duyệt trước khi có hiệu lực.`
            : `Bạn sẽ tự thêm mình vào danh sách người tham gia xử lý ${incident.incidentId}.`
        }
        confirmLabel="Tham gia"
        confirmVariant="default"
        onClose={() => setJoinDialogOpen(false)}
        onSubmit={async (reason) => {
          const result = await api.post<{ status: 'joined' | 'pending_approval' }>(`/api/safety/incidents/${incident.incidentId}/join`, { reason });
          load();
          setToast(
            result.status === 'pending_approval'
              ? { message: 'Đã gửi yêu cầu tham gia — đang chờ chỉ huy duyệt.', severity: 'success' }
              : { message: 'Đã tham gia sự vụ.', severity: 'success' }
          );
        }}
      />
      <ReasonPromptDialog
        open={leaveDialogOpen}
        title="Rời khỏi sự vụ"
        description={`Bạn sẽ rời khỏi danh sách người tham gia xử lý ${incident.incidentId}.`}
        confirmLabel="Rời sự vụ"
        confirmVariant="destructive"
        onClose={() => setLeaveDialogOpen(false)}
        onSubmit={async (reason) => {
          await api.post(`/api/safety/incidents/${incident.incidentId}/leave`, { reason });
          load();
          setToast({ message: 'Đã rời khỏi sự vụ.', severity: 'success' });
        }}
      />
      <Dialog open={ackChoiceOpen} onOpenChange={setAckChoiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tiếp nhận xử lý hồ sơ</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Bạn sắp trở thành <strong>chỉ huy</strong> của hồ sơ {incident.incidentId} — chịu trách nhiệm phân công, đổi trạng thái, đổi mức ưu
            tiên cho đến khi bàn giao/huỷ tiếp nhận.
            {isSenior ? ' Bạn cũng có thể chỉ định người khác làm chỉ huy thay vì tự tiếp nhận.' : ''}
          </p>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setAckChoiceOpen(false)} className="text-slate-500">
              Huỷ
            </Button>
            <div className="flex flex-wrap gap-2">
              {isSenior && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setAckChoiceOpen(false);
                    setCommanderTarget({ incidentId: incident.incidentId, commanderPerId: incident.commanderPerId, commanderName: incident.commanderName });
                  }}
                  className="font-semibold"
                >
                  <UserPlus className="size-4" />
                  Chỉ định người khác
                </Button>
              )}
              <Button
                onClick={() => {
                  setAckChoiceOpen(false);
                  handleAcknowledge();
                }}
                className="bg-green-600 font-bold hover:bg-green-700"
              >
                <UserCheck className="size-4" />
                Xác nhận tiếp nhận
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={ackDialogOpen} onOpenChange={setAckDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chọn mức ưu tiên để tiếp nhận</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Hồ sơ {incident.incidentId} chưa được phân loại mức ưu tiên — bắt buộc chọn trước khi tiếp nhận xử lý.
            {incident.suggestedPriority && ` Gợi ý theo nhóm sự cố: ${incident.suggestedPriority}.`}
          </p>
          <div>
            <Label className="mb-1.5 block">Mức ưu tiên</Label>
            <Select value={ackPriority} onValueChange={setAckPriority}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn mức ưu tiên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P0">P0 — Khẩn cấp (nguy hiểm tức thời tính mạng/sức khỏe)</SelectItem>
                <SelectItem value="P1">P1 — Nghiêm trọng (nguy cơ nghiêm trọng / leo thang nhanh)</SelectItem>
                <SelectItem value="P2">P2 — Cần xử lý (cần phối hợp, không nguy hiểm tức thời)</SelectItem>
                <SelectItem value="P3">P3 — Thông thường (nguy cơ thông thường / phòng ngừa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAckDialogOpen(false)} className="text-slate-500">
              Hủy
            </Button>
            <Button disabled={!ackPriority || acknowledging} onClick={handleAcknowledgeWithPriority} className="bg-green-600 hover:bg-green-700">
              {acknowledging ? 'Đang tiếp nhận...' : 'Tiếp nhận với mức này'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReasonPromptDialog
        open={cancelAckDialogOpen}
        title="Huỷ tiếp nhận"
        description={`Yêu cầu sẽ gửi tới cấp trên (Tổ trưởng/Phó Hiệu trưởng/Hiệu trưởng) duyệt trước khi ${incident.incidentId} thực sự về trạng thái chưa ai tiếp nhận.`}
        confirmLabel="Gửi yêu cầu huỷ"
        confirmVariant="destructive"
        onClose={() => setCancelAckDialogOpen(false)}
        onSubmit={async (reason) => {
          await api.post(`/api/safety/incidents/${incident.incidentId}/cancel-acknowledgment/request`, { reason });
          load();
          setToast({ message: 'Đã gửi yêu cầu huỷ tiếp nhận, đang chờ cấp trên duyệt.', severity: 'success' });
        }}
      />
      <CorrectClassificationDialog
        target={classificationTarget}
        onClose={() => setClassificationTarget(null)}
        onChanged={(result) => {
          load();
          const base = result.className ? `Đã cập nhật lớp liên quan: ${result.className}.` : 'Đã xoá lớp liên quan.';
          const notified = result.notifiedPerIds?.length ? ` Đã báo cho ${result.notifiedPerIds.length} GVCN/GV phụ trách khối liên quan.` : '';
          setToast({
            message: base + notified,
            severity: 'success'
          });
        }}
      />
    </>
  );
}
