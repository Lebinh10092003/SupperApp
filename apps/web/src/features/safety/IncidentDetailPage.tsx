/**
 * IncidentDetailPage.tsx — Chunk B. Trang chi tiết 1 hồ sơ sự cố
 * (`GET /api/safety/incidents/:id`) + 4 hành động: đổi trạng thái, đổi ưu
 * tiên, mở lại (chỉ khi đã đóng), chỉ định chỉ huy. Route: `/safety/incidents/:id`
 * — route list->detail lồng nhau ĐẦU TIÊN trong app (không có tiền lệ để
 * copy quy ước `useParams`).
 *
 * StatusChip/PriorityChip import từ `./components/*`.
 */
import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import SyncAltIcon from '@mui/icons-material/SyncAltRounded';
import PriorityHighIcon from '@mui/icons-material/PriorityHighRounded';
import RestartAltIcon from '@mui/icons-material/RestartAltRounded';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1Rounded';
import GroupAddIcon from '@mui/icons-material/GroupAddRounded';
import HowToRegIcon from '@mui/icons-material/HowToRegRounded';
import EditIcon from '@mui/icons-material/EditRounded';

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
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

// Xem ghi chú tương tự ở CasesListPage.tsx — bỏ khung AppShell trên điện
// thoại làm mất điều hướng, thêm lại thanh tab dưới cùng (lazy-load riêng
// để không kéo @ionic/react vào bundle chính).
const MobileTabBar = lazy(() => import('../../mobile/MobileTabBar').then((m) => ({ default: m.MobileTabBar })));

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
  const isMobile = useIsMobileViewport();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { actor } = useActor();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

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
      <Box sx={{ p: 4, display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2, textTransform: 'none' }}>
          Quay lại
        </Button>
      </Box>
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
    <Box sx={{ p: isMobile ? 2 : 0, pb: isMobile ? 2 : 0 }}>
      {isMobile ? (
        // Nút quay lại kiểu app di động thật (icon tròn, không phải link
        // chữ nằm lệch dưới tiêu đề như PageHeader bản desktop) — Sin báo
        // "trông như UI web" — dùng navigate(-1) để quay đúng nơi vừa đến
        // (Sự vụ của tôi / Tất cả sự vụ / Cockpit), không cố định 1 đích.
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ ml: -1, color: '#0f172a' }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.25 }} noWrap>
              {incident.incidentId}
            </Typography>
            {(incident.categoryLabel || incident.categoryCode) && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {incident.categoryLabel || incident.categoryCode}
              </Typography>
            )}
          </Box>
        </Stack>
      ) : (
        <PageHeader
          title={`Hồ sơ sự cố ${incident.incidentId}`}
          subtitle={incident.categoryLabel || incident.categoryCode || undefined}
          action={
            <Button component={Link} to="/safety/incidents" startIcon={<ArrowBackIcon />} sx={{ textTransform: 'none', color: '#64748b' }}>
              Quay lại danh sách
            </Button>
          }
        />
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>

      <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
        <StatusChip state={incident.state} />
        <PriorityChip priority={incident.priority} />
      </Stack>

      {incident.cancelRequestedAt && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5, borderRadius: 2 }}
          action={
            isSeniorRole(actor) ? (
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" color="success" disabled={decidingCancel} onClick={() => decideCancelAcknowledgment(true)} sx={{ textTransform: 'none' }}>
                  Duyệt huỷ
                </Button>
                <Button size="small" variant="outlined" color="error" disabled={decidingCancel} onClick={() => decideCancelAcknowledgment(false)} sx={{ textTransform: 'none' }}>
                  Từ chối
                </Button>
              </Stack>
            ) : undefined
          }
        >
          Đang chờ duyệt huỷ tiếp nhận — {incident.commanderName || incident.cancelRequestedBy} xin huỷ, lý do: {incident.cancelRequestReason}
        </Alert>
      )}

      <Stack spacing={2.5}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Thông tin chung
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Cơ sở: <strong>{CAMPUS_LABEL[incident.campusId] || incident.campusId}</strong>
                </Typography>
                {incident.className && (
                  <Typography variant="body2">
                    Lớp liên quan: <strong>{incident.className}</strong>
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2">
                    Chỉ huy: <strong>{incident.commanderName || 'Chưa có ai tiếp nhận'}</strong>
                  </Typography>
                  {incident.commanderPerId && <ContactInfoButton perId={incident.commanderPerId} name={incident.commanderName || incident.commanderPerId} />}
                </Box>
                {incident.participantPerIds && incident.participantPerIds.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="body2">Người tham gia xử lý khác:</Typography>
                    {incident.participantPerIds.map((p) => (
                      <Box key={p} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {incident.participantLabels?.[p] || p}
                        </Typography>
                        <ContactInfoButton perId={p} name={incident.participantLabels?.[p] || p} />
                      </Box>
                    ))}
                  </Box>
                )}
                {incident.lastNote && <Typography variant="body2">Ghi chú gần nhất: {incident.lastNote}</Typography>}
                {incident.reopenReason && <Typography variant="body2">Lý do mở lại: {incident.reopenReason}</Typography>}
                <Typography variant="caption" color="text.secondary">
                  Tạo lúc {formatDateTime(incident.createdAt)} — cập nhật {formatDateTime(incident.updatedAt)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {(isCommander || isSenior) && incident.pendingJoinRequests && incident.pendingJoinRequests.length > 0 && (
            <Card sx={{ borderRadius: 3, border: '1px solid #fde68a', bgcolor: '#fffbeb', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Yêu cầu tham gia đang chờ duyệt ({incident.pendingJoinRequests.length})
                </Typography>
                <Stack spacing={1.5} divider={<Divider />}>
                  {incident.pendingJoinRequests.map((r) => (
                    <Box key={r.perId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {incident.pendingJoinRequestLabels?.[r.perId] || r.perId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Lý do: {r.reason} — {formatDateTime(r.requestedAt)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={async () => {
                            await api.post(`/api/safety/incidents/${incident.incidentId}/join-requests/${r.perId}/approve`, {});
                            load();
                            setToast({ message: `Đã duyệt cho ${incident.pendingJoinRequestLabels?.[r.perId] || r.perId} tham gia.`, severity: 'success' });
                          }}
                          sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 600 }}
                        >
                          Duyệt
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={async () => {
                            await api.post(`/api/safety/incidents/${incident.incidentId}/join-requests/${r.perId}/reject`, {});
                            load();
                            setToast({ message: `Đã từ chối yêu cầu của ${incident.pendingJoinRequestLabels?.[r.perId] || r.perId}.`, severity: 'success' });
                          }}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          Từ chối
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {incident.slaClocks && Object.keys(incident.slaClocks).length > 0 && (
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Đồng hồ SLA
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(incident.slaClocks).map(([label, clock]) => (
                    <Typography key={label} variant="body2">
                      {SLA_CLOCK_LABEL[label] || label}: hạn {formatDateTime(clock.deadlineAt)} — {SLA_STATUS_LABEL[clock.status] || clock.status}
                      {clock.paused ? ' (đang tạm dừng)' : ''}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {incident.reportSubmissions && incident.reportSubmissions.length > 0 && (
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Nội dung tin báo gốc{incident.reportSubmissions.length > 1 ? ` (${incident.reportSubmissions.length} lượt gửi)` : ''}
                </Typography>
                <Stack spacing={1.5} divider={<Divider />}>
                  {incident.reportSubmissions.map((r) => (
                    <Box key={r.reportId}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {r.content || <em>(không có nội dung)</em>}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(r.occurredAt)}
                        {r.stillDangerous ? ' — còn nguy hiểm lúc gửi' : ''}
                      </Typography>
                      {(r.contactName || r.email || r.phone) && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          Liên hệ người báo tin
                          {r.contactName ? ' (' + r.contactName + ')' : ''}:{' '}
                          {r.email && <MuiLink href={`mailto:${r.email}`}>{r.email}</MuiLink>}
                          {r.email && r.phone ? ' · ' : ''}
                          {r.phone && <MuiLink href={`tel:${r.phone}`}>{r.phone}</MuiLink>}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent>
              <EvidenceGallery evidenceList={incident.evidenceList || []} canView={Boolean(incident.canViewEvidence)} />
            </CardContent>
          </Card>
        </Stack>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        {!incident.commanderPerId && (
          <Button
            variant="contained"
            startIcon={<HowToRegIcon />}
            onClick={() => setAckChoiceOpen(true)}
            disabled={acknowledging}
            sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {acknowledging ? 'Đang tiếp nhận...' : 'Tiếp nhận xử lý'}
          </Button>
        )}
        {actor?.perId && (incident.commanderPerId === actor.perId || isSenior) && (
          <Button
            variant="outlined"
            startIcon={<GroupAddIcon />}
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
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Thêm người xử lý
          </Button>
        )}
        {actor?.perId && incident.commanderPerId === actor.perId && !incident.cancelRequestedAt && (
          <Button variant="outlined" color="error" onClick={() => setCancelAckDialogOpen(true)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            Huỷ tiếp nhận
          </Button>
        )}
        {actor?.perId &&
          incident.commanderPerId &&
          incident.commanderPerId !== actor.perId &&
          !(incident.participantPerIds || []).includes(actor.perId) &&
          !(incident.pendingJoinRequests || []).some((r) => r.perId === actor.perId) && (
            <Button variant="outlined" startIcon={<GroupAddIcon />} onClick={() => setJoinDialogOpen(true)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
              Tham gia sự vụ
            </Button>
          )}
        {actor?.perId && (incident.pendingJoinRequests || []).some((r) => r.perId === actor.perId) && (
          <Button variant="outlined" disabled sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            Đang chờ chỉ huy duyệt tham gia
          </Button>
        )}
        {actor?.perId && incident.commanderPerId !== actor.perId && (incident.participantPerIds || []).includes(actor.perId) && (
          <Button variant="outlined" color="error" onClick={() => setLeaveDialogOpen(true)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            Rời khỏi sự vụ
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outlined"
            startIcon={<SyncAltIcon />}
            onClick={() => setStatusTarget({ incidentId: incident.incidentId, state: incident.state })}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Đổi trạng thái
          </Button>
        )}
        {canEditPriority && (
          <Button
            variant="outlined"
            startIcon={<PriorityHighIcon />}
            onClick={() => setPriorityTarget({ incidentId: incident.incidentId, priority: incident.priority })}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Đổi ưu tiên
          </Button>
        )}
        {incident.state === STATE_CLOSED && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<RestartAltIcon />}
            onClick={() => setReopenTarget({ incidentId: incident.incidentId })}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Mở lại hồ sơ
          </Button>
        )}
        {/* Chỉ hiện khi ĐÃ có chỉ huy (đổi chỉ huy) — Sin chốt 2026-09-24:
            lúc CHƯA có chỉ huy, nút này trùng hệt lựa chọn "Chỉ định người
            khác" trong modal xác nhận tiếp nhận (setAckChoiceOpen ở trên),
            giữ cả 2 là thừa. */}
        {isSenior && incident.commanderPerId && (
          <Button
            variant="outlined"
            startIcon={<PersonAddAlt1Icon />}
            onClick={() =>
              setCommanderTarget({
                incidentId: incident.incidentId,
                commanderPerId: incident.commanderPerId,
                commanderName: incident.commanderName
              })
            }
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Đổi chỉ huy
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setClassificationTarget({ incidentId: incident.incidentId, currentClassName: incident.className || null })}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Sửa lớp liên quan
          </Button>
        )}
      </Stack>

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
        confirmColor="#2563eb"
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
        confirmColor="#dc2626"
        onClose={() => setLeaveDialogOpen(false)}
        onSubmit={async (reason) => {
          await api.post(`/api/safety/incidents/${incident.incidentId}/leave`, { reason });
          load();
          setToast({ message: 'Đã rời khỏi sự vụ.', severity: 'success' });
        }}
      />
      <Dialog open={ackChoiceOpen} onClose={() => setAckChoiceOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tiếp nhận xử lý hồ sơ</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          <Typography variant="body2" color="text.secondary">
            Bạn sắp trở thành <strong>chỉ huy</strong> của hồ sơ {incident.incidentId} — chịu trách nhiệm phân công, đổi trạng thái, đổi mức ưu tiên cho đến khi bàn giao/huỷ tiếp nhận.
            {isSenior ? ' Bạn cũng có thể chỉ định người khác làm chỉ huy thay vì tự tiếp nhận.' : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setAckChoiceOpen(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Huỷ
          </Button>
          {isSenior && (
            <Button
              variant="outlined"
              startIcon={<PersonAddAlt1Icon />}
              onClick={() => {
                setAckChoiceOpen(false);
                setCommanderTarget({ incidentId: incident.incidentId, commanderPerId: incident.commanderPerId, commanderName: incident.commanderName });
              }}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
            >
              Chỉ định người khác
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<HowToRegIcon />}
            onClick={() => {
              setAckChoiceOpen(false);
              handleAcknowledge();
            }}
            sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Xác nhận tiếp nhận
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={ackDialogOpen} onClose={() => setAckDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Chọn mức ưu tiên để tiếp nhận</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Hồ sơ {incident.incidentId} chưa được phân loại mức ưu tiên — bắt buộc chọn trước khi tiếp nhận xử lý.
              {incident.suggestedPriority && ` Gợi ý theo nhóm sự cố: ${incident.suggestedPriority}.`}
            </Typography>
            <TextField select autoFocus label="Mức ưu tiên" value={ackPriority} onChange={(e) => setAckPriority(e.target.value)} fullWidth>
              <MenuItem value="P0">P0 — Khẩn cấp (nguy hiểm tức thời tính mạng/sức khỏe)</MenuItem>
              <MenuItem value="P1">P1 — Nghiêm trọng (nguy cơ nghiêm trọng / leo thang nhanh)</MenuItem>
              <MenuItem value="P2">P2 — Cần xử lý (cần phối hợp, không nguy hiểm tức thời)</MenuItem>
              <MenuItem value="P3">P3 — Thông thường (nguy cơ thông thường / phòng ngừa)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setAckDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            disabled={!ackPriority || acknowledging}
            onClick={handleAcknowledgeWithPriority}
            sx={{ bgcolor: '#16a34a', color: '#fff', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {acknowledging ? 'Đang tiếp nhận...' : 'Tiếp nhận với mức này'}
          </Button>
        </DialogActions>
      </Dialog>
      <ReasonPromptDialog
        open={cancelAckDialogOpen}
        title="Huỷ tiếp nhận"
        description={`Yêu cầu sẽ gửi tới cấp trên (Tổ trưởng/Phó Hiệu trưởng/Hiệu trưởng) duyệt trước khi ${incident.incidentId} thực sự về trạng thái chưa ai tiếp nhận.`}
        confirmLabel="Gửi yêu cầu huỷ"
        confirmColor="#dc2626"
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

      {isMobile && (
        <Suspense fallback={null}>
          <MobileTabBar mode="sticky" />
        </Suspense>
      )}
    </Box>
  );
}
