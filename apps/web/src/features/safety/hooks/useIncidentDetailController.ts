import { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import type { ChangeStatusTarget } from '../dialogs/ChangeStatusDialog';
import type { ChangePriorityTarget } from '../dialogs/ChangePriorityDialog';
import type { ReopenIncidentTarget } from '../dialogs/ReopenIncidentDialog';
import type { AssignCommanderTarget } from '../dialogs/AssignCommanderDialog';
import type { AddParticipantTarget } from '../dialogs/AddParticipantDialog';
import type { CorrectClassificationTarget } from '../dialogs/CorrectClassificationDialog';
import { useActor } from './useActor';

export interface EvidenceSummary {
  evidenceId: string;
  fileType: string;
  sizeBytes: number;
  scanStatus: string;
}

export interface ReportSubmission {
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

export interface IncidentDetail {
  incidentId: string;
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

export const STATE_CLOSED = 'Đã đóng';
const SENIOR_ROLE_IDS = new Set(['R.PRINCIPAL', 'R.VICE_PRINCIPAL', 'R.DEPT_HEAD']);
export function isSeniorRole(actor: { roles: Array<{ roleId: string }> } | null | undefined) {
  return !!actor?.roles?.some((r) => SENIOR_ROLE_IDS.has(r.roleId));
}

/**
 * Toàn bộ state + logic nghiệp vụ của trang chi tiết sự vụ — trích xuất
 * từ IncidentDetailPage.tsx (bản desktop) để DÙNG CHUNG với bản mobile
 * (MobileIncidentDetailPage.tsx), tránh chép lại ~200 dòng xử lý API dễ
 * lệch nhau khi sửa 1 bên quên bên kia. 2 trang chỉ khác nhau ở JSX hiển
 * thị, không khác ở cách gọi API/điều kiện hiện nút.
 */
export function useIncidentDetailController(id: string | undefined) {
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
  const [ackChoiceOpen, setAckChoiceOpen] = useState(false);
  const [decidingJoinPerId, setDecidingJoinPerId] = useState<string | null>(null);

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

  const decideJoinRequest = async (perId: string, approve: boolean) => {
    if (!incident) return;
    const label = incident.pendingJoinRequestLabels?.[perId] || perId;
    setDecidingJoinPerId(perId);
    try {
      await api.post(`/api/safety/incidents/${incident.incidentId}/join-requests/${perId}/${approve ? 'approve' : 'reject'}`, {});
      load();
      setToast({
        message: approve ? `Đã duyệt cho ${label} tham gia.` : `Đã từ chối yêu cầu của ${label}.`,
        severity: 'success'
      });
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
    } finally {
      setDecidingJoinPerId(null);
    }
  };

  const isSenior = isSeniorRole(actor);
  const isCommander = !!actor?.perId && incident?.commanderPerId === actor.perId;
  const isParticipant = !!actor?.perId && (incident?.participantPerIds || []).includes(actor.perId);
  const canEdit = isCommander || isParticipant || isSenior;
  const canEditPriority = isCommander || isSenior;

  return {
    actor,
    incident,
    setIncident,
    loading,
    error,
    toast,
    setToast,
    load,
    isSenior,
    isCommander,
    isParticipant,
    canEdit,
    canEditPriority,
    statusTarget,
    setStatusTarget,
    priorityTarget,
    setPriorityTarget,
    reopenTarget,
    setReopenTarget,
    classificationTarget,
    setClassificationTarget,
    commanderTarget,
    setCommanderTarget,
    addParticipantTarget,
    setAddParticipantTarget,
    joinDialogOpen,
    setJoinDialogOpen,
    leaveDialogOpen,
    setLeaveDialogOpen,
    cancelAckDialogOpen,
    setCancelAckDialogOpen,
    decidingCancel,
    acknowledging,
    ackDialogOpen,
    setAckDialogOpen,
    ackPriority,
    setAckPriority,
    ackChoiceOpen,
    setAckChoiceOpen,
    decidingJoinPerId,
    handleAcknowledge,
    handleAcknowledgeWithPriority,
    decideCancelAcknowledgment,
    decideJoinRequest
  };
}
