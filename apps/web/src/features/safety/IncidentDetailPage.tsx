/**
 * IncidentDetailPage.tsx — Chunk B. Trang chi tiết 1 hồ sơ sự cố
 * (`GET /api/safety/incidents/:id`) + 4 hành động: đổi trạng thái, đổi ưu
 * tiên, mở lại (chỉ khi đã đóng), chỉ định chỉ huy. Route: `/safety/incidents/:id`
 * — route list->detail lồng nhau ĐẦU TIÊN trong app (không có tiền lệ để
 * copy quy ước `useParams`).
 *
 * StatusChip/PriorityChip/ConfidentialityBadge import từ `./components/*`
 * (bản thật, Chunk A/Hestia, PR #12) — trước đó dùng stub `./temp-chips`
 * tạm thời, đã xoá sau khi Chunk A merge.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import SyncAltIcon from '@mui/icons-material/SyncAltRounded';
import PriorityHighIcon from '@mui/icons-material/PriorityHighRounded';
import RestartAltIcon from '@mui/icons-material/RestartAltRounded';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1Rounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';

import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { StatusChip } from './components/StatusChip';
import { PriorityChip } from './components/PriorityChip';
import { ConfidentialityBadge } from './components/ConfidentialityBadge';
import { ChangeStatusDialog, type ChangeStatusTarget } from './dialogs/ChangeStatusDialog';
import { ChangePriorityDialog, type ChangePriorityTarget } from './dialogs/ChangePriorityDialog';
import { ReopenIncidentDialog, type ReopenIncidentTarget } from './dialogs/ReopenIncidentDialog';
import { AssignCommanderDialog, type AssignCommanderTarget } from './dialogs/AssignCommanderDialog';

interface EvidenceSummary {
  evidenceId: string;
  fileType: string;
  sizeBytes: number;
  scanStatus: string;
}

interface IncidentDetail {
  incidentId: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  confidentiality: 'C1' | 'C2' | 'C3' | 'C4';
  state: string;
  campusId: string;
  redacted?: boolean;
  categoryCode?: string;
  categoryLabel?: string | null;
  className?: string | null;
  commanderPerId?: string | null;
  commanderName?: string | null;
  lastNote?: string | null;
  reopenReason?: string | null;
  canViewEvidence?: boolean;
  evidenceList?: EvidenceSummary[];
  slaClocks?: Record<string, { deadlineAt: string; status: string; paused: boolean }>;
  createdAt?: string;
  updatedAt?: string;
}

const STATE_CLOSED = 'Đã đóng';

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
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<ChangeStatusTarget | null>(null);
  const [priorityTarget, setPriorityTarget] = useState<ChangePriorityTarget | null>(null);
  const [reopenTarget, setReopenTarget] = useState<ReopenIncidentTarget | null>(null);
  const [commanderTarget, setCommanderTarget] = useState<AssignCommanderTarget | null>(null);

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

  const handleDownloadEvidence = async (evidenceId: string) => {
    setDownloadingId(evidenceId);
    try {
      const res = await api.post<{ url: string }>(`/api/safety/evidence/${evidenceId}/download-url`);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setToast(`Lỗi tải minh chứng: ${e.message}`);
    } finally {
      setDownloadingId(null);
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title={`Hồ sơ sự cố ${incident.incidentId}`}
        subtitle={incident.categoryLabel || incident.categoryCode || undefined}
        action={
          <Button component={Link} to="/safety/incidents" startIcon={<ArrowBackIcon />} sx={{ textTransform: 'none', color: '#64748b' }}>
            Quay lại danh sách
          </Button>
        }
      />

      {toast && (
        <Alert severity="error" onClose={() => setToast('')} sx={{ mb: 2.5, borderRadius: 2 }}>
          {toast}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
        <StatusChip state={incident.state} />
        <PriorityChip priority={incident.priority} />
        <ConfidentialityBadge confidentiality={incident.confidentiality} redacted={incident.redacted} />
      </Stack>

      {incident.redacted ? (
        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Bạn không đủ quyền xem đầy đủ chi tiết hồ sơ này — trần bí mật hiện tại thấp hơn mức {incident.confidentiality} của hồ sơ. Chỉ hiển thị mã và mức ưu tiên/bí mật ở trên.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2.5}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Thông tin chung
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Cơ sở: <strong>{incident.campusId}</strong>
                </Typography>
                {incident.className && (
                  <Typography variant="body2">
                    Lớp liên quan: <strong>{incident.className}</strong>
                  </Typography>
                )}
                <Typography variant="body2">
                  Chỉ huy: <strong>{incident.commanderName || 'Chưa chỉ định'}</strong>
                </Typography>
                {incident.lastNote && <Typography variant="body2">Ghi chú gần nhất: {incident.lastNote}</Typography>}
                {incident.reopenReason && <Typography variant="body2">Lý do mở lại: {incident.reopenReason}</Typography>}
                <Typography variant="caption" color="text.secondary">
                  Tạo lúc {formatDateTime(incident.createdAt)} — cập nhật {formatDateTime(incident.updatedAt)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {incident.slaClocks && Object.keys(incident.slaClocks).length > 0 && (
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Đồng hồ SLA
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(incident.slaClocks).map(([label, clock]) => (
                    <Typography key={label} variant="body2">
                      {label}: hạn {formatDateTime(clock.deadlineAt)} — {clock.status}
                      {clock.paused ? ' (đang tạm dừng)' : ''}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {incident.canViewEvidence && incident.evidenceList && incident.evidenceList.length > 0 && (
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Minh chứng ({incident.evidenceList.length})
                </Typography>
                <Stack spacing={1}>
                  {incident.evidenceList.map((ev) => (
                    <Box key={ev.evidenceId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2">
                        {ev.evidenceId} — {ev.fileType} ({Math.round(ev.sizeBytes / 1024)} KB) — {ev.scanStatus}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        disabled={ev.scanStatus !== 'clear' || downloadingId === ev.evidenceId}
                        onClick={() => handleDownloadEvidence(ev.evidenceId)}
                        sx={{ textTransform: 'none' }}
                      >
                        Tải
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<SyncAltIcon />}
          onClick={() => setStatusTarget({ incidentId: incident.incidentId, state: incident.state })}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          Đổi trạng thái
        </Button>
        <Button
          variant="outlined"
          startIcon={<PriorityHighIcon />}
          onClick={() => setPriorityTarget({ incidentId: incident.incidentId, priority: incident.priority })}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          Đổi ưu tiên
        </Button>
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
          Chỉ định chỉ huy
        </Button>
      </Stack>

      <ChangeStatusDialog
        target={statusTarget}
        onClose={() => setStatusTarget(null)}
        onChanged={(result) => setIncident((prev) => (prev ? { ...prev, state: result.state } : prev))}
      />
      <ChangePriorityDialog
        target={priorityTarget}
        onClose={() => setPriorityTarget(null)}
        onChanged={(result) => setIncident((prev) => (prev ? { ...prev, priority: result.priority as IncidentDetail['priority'] } : prev))}
      />
      <ReopenIncidentDialog target={reopenTarget} onClose={() => setReopenTarget(null)} onChanged={() => load()} />
      <AssignCommanderDialog target={commanderTarget} onClose={() => setCommanderTarget(null)} onChanged={() => load()} />
    </Box>
  );
}
