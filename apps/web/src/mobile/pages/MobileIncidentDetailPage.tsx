/**
 * MobileIncidentDetailPage.tsx — bản mobile THẬT của trang chi tiết sự vụ,
 * dùng component antd-mobile (NavBar/List/Toast) thay vì tái sử dụng JSX
 * desktop. Toàn bộ state/logic API dùng CHUNG với bản desktop qua
 * `useIncidentDetailController` (xem file hook) — sửa 1 nơi, cả 2 trang
 * cùng đúng, không lệch nhau.
 *
 * Các dialog form phức tạp (đổi trạng thái/ưu tiên/chỉ huy, thêm người
 * tham gia, sửa phân loại) TÁI DÙNG NGUYÊN các MUI Dialog đã có sẵn —
 * đây là modal che phủ toàn màn hình, không phải khung điều hướng nên
 * không phải phần Sin phàn nàn "trông như web".
 */
import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar, List, Card, SpinLoading, Toast, Space } from 'antd-mobile';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography, Link as MuiLink } from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1Rounded';
import HowToRegIcon from '@mui/icons-material/HowToRegRounded';
import { StatusChip } from '../../features/safety/components/StatusChip';
import { PriorityChip } from '../../features/safety/components/PriorityChip';
import { EvidenceGallery } from '../../features/safety/EvidenceGallery';
import { ChangeStatusDialog } from '../../features/safety/dialogs/ChangeStatusDialog';
import { ChangePriorityDialog } from '../../features/safety/dialogs/ChangePriorityDialog';
import { ReopenIncidentDialog } from '../../features/safety/dialogs/ReopenIncidentDialog';
import { AssignCommanderDialog } from '../../features/safety/dialogs/AssignCommanderDialog';
import { AddParticipantDialog } from '../../features/safety/dialogs/AddParticipantDialog';
import { ReasonPromptDialog } from '../../features/safety/dialogs/ReasonPromptDialog';
import { ContactInfoButton } from '../../features/safety/components/ContactInfoButton';
import { CorrectClassificationDialog } from '../../features/safety/dialogs/CorrectClassificationDialog';
import { CAMPUS_LABEL, SLA_CLOCK_LABEL, SLA_STATUS_LABEL } from '../../features/safety/constants';
import { useIncidentDetailController, STATE_CLOSED, isSeniorRole, type IncidentDetail } from '../../features/safety/hooks/useIncidentDetailController';
import { MobileScreenShell } from '../MobileScreenShell';
import { MobileTabBar } from '../MobileTabBar';
import { api } from '../../services/api';

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

export default function MobileIncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
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
  } = useIncidentDetailController(id);

  // Toast của antd-mobile là API mệnh lệnh (Toast.show), không phải
  // component dựng theo state như Snackbar MUI — bắn ra ngay khi `toast`
  // đổi, dùng useState làm "đã hiện cái này chưa" để không lặp lại.
  const [lastShownToastKey, setLastShownToastKey] = useState<string | null>(null);
  if (toast && `${toast.message}-${toast.severity}` !== lastShownToastKey) {
    setLastShownToastKey(`${toast.message}-${toast.severity}`);
    Toast.show({ content: toast.message, icon: toast.severity === 'success' ? 'success' : 'fail' });
    setToast(null);
  }

  const header = (
    <NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>
      {incident ? incident.incidentId : 'Hồ sơ sự cố'}
    </NavBar>
  );

  if (loading) {
    return (
      <MobileScreenShell header={header} tabBar={<MobileTabBar />}>
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <SpinLoading />
        </Box>
      </MobileScreenShell>
    );
  }

  if (error) {
    return (
      <MobileScreenShell header={header} tabBar={<MobileTabBar />}>
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      </MobileScreenShell>
    );
  }

  if (!incident) return null;

  return (
    <MobileScreenShell header={header} tabBar={<MobileTabBar />}>
      <Space direction="vertical" block style={{ '--gap': '12px' } as any}>
        <Space wrap>
          <StatusChip state={incident.state} />
          <PriorityChip priority={incident.priority} />
        </Space>

        {incident.cancelRequestedAt && (
          <Card>
            <Typography variant="body2" sx={{ mb: isSeniorRole(actor) ? 1 : 0 }}>
              Đang chờ duyệt huỷ tiếp nhận — {incident.commanderName || incident.cancelRequestedBy} xin huỷ, lý do: {incident.cancelRequestReason}
            </Typography>
            {isSeniorRole(actor) && (
              <Space>
                <Button size="small" variant="contained" color="success" disabled={decidingCancel} onClick={() => decideCancelAcknowledgment(true)} sx={{ textTransform: 'none' }}>
                  Duyệt huỷ
                </Button>
                <Button size="small" variant="outlined" color="error" disabled={decidingCancel} onClick={() => decideCancelAcknowledgment(false)} sx={{ textTransform: 'none' }}>
                  Từ chối
                </Button>
              </Space>
            )}
          </Card>
        )}

        <Card title="Thông tin chung">
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
        </Card>

        {(isCommander || isSenior) && incident.pendingJoinRequests && incident.pendingJoinRequests.length > 0 && (
          <Card title={`Yêu cầu tham gia đang chờ duyệt (${incident.pendingJoinRequests.length})`} style={{ '--background-color': '#fffbeb' } as any}>
            <Stack spacing={1.5} divider={<Box sx={{ borderTop: '1px solid #fde68a' }} />}>
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
                      disabled={decidingJoinPerId === r.perId}
                      onClick={() => decideJoinRequest(r.perId, true)}
                      sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 600 }}
                    >
                      Duyệt
                    </Button>
                    <Button size="small" variant="outlined" color="error" disabled={decidingJoinPerId === r.perId} onClick={() => decideJoinRequest(r.perId, false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                      Từ chối
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Card>
        )}

        {incident.slaClocks && Object.keys(incident.slaClocks).length > 0 && (
          <Card title="Đồng hồ SLA">
            <Stack spacing={1}>
              {Object.entries(incident.slaClocks).map(([label, clock]) => (
                <Typography key={label} variant="body2">
                  {SLA_CLOCK_LABEL[label] || label}: hạn {formatDateTime(clock.deadlineAt)} — {SLA_STATUS_LABEL[clock.status] || clock.status}
                  {clock.paused ? ' (đang tạm dừng)' : ''}
                </Typography>
              ))}
            </Stack>
          </Card>
        )}

        {incident.reportSubmissions && incident.reportSubmissions.length > 0 && (
          <Card title={`Nội dung tin báo gốc${incident.reportSubmissions.length > 1 ? ` (${incident.reportSubmissions.length} lượt gửi)` : ''}`}>
            <Stack spacing={1.5} divider={<Box sx={{ borderTop: '1px solid #f1f5f9' }} />}>
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
          </Card>
        )}

        <Card>
          <EvidenceGallery evidenceList={incident.evidenceList || []} canView={Boolean(incident.canViewEvidence)} />
        </Card>

        {(() => {
          const items: Array<{ key: string; icon: ReactNode; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; contained?: boolean }> = [];
          if (!incident.commanderPerId) {
            items.push({ key: 'ack', icon: <HowToRegIcon fontSize="small" />, label: acknowledging ? 'Đang tiếp nhận...' : 'Tiếp nhận xử lý', onClick: () => setAckChoiceOpen(true), disabled: acknowledging, contained: true });
          }
          if (actor?.perId && (incident.commanderPerId === actor.perId || isSenior)) {
            items.push({
              key: 'add-participant',
              icon: null,
              label: 'Thêm người xử lý',
              onClick: () =>
                setAddParticipantTarget({
                  incidentId: incident.incidentId,
                  suggested: incident.suggestedParticipants,
                  current: [
                    ...(incident.commanderPerId ? [{ perId: incident.commanderPerId, label: (incident.commanderName || incident.commanderPerId) + ' (chỉ huy)' }] : []),
                    ...(incident.participantPerIds || []).map((p) => ({ perId: p, label: incident.participantLabels?.[p] || p }))
                  ]
                })
            });
          }
          if (actor?.perId && incident.commanderPerId === actor.perId && !incident.cancelRequestedAt) {
            items.push({ key: 'cancel-ack', icon: null, label: 'Huỷ tiếp nhận', onClick: () => setCancelAckDialogOpen(true), danger: true });
          }
          if (
            actor?.perId &&
            incident.commanderPerId &&
            incident.commanderPerId !== actor.perId &&
            !(incident.participantPerIds || []).includes(actor.perId) &&
            !(incident.pendingJoinRequests || []).some((r) => r.perId === actor.perId)
          ) {
            items.push({ key: 'join', icon: null, label: 'Tham gia sự vụ', onClick: () => setJoinDialogOpen(true) });
          }
          if (actor?.perId && (incident.pendingJoinRequests || []).some((r) => r.perId === actor.perId)) {
            items.push({ key: 'join-pending', icon: null, label: 'Đang chờ chỉ huy duyệt tham gia', disabled: true });
          }
          if (actor?.perId && incident.commanderPerId !== actor.perId && (incident.participantPerIds || []).includes(actor.perId)) {
            items.push({ key: 'leave', icon: null, label: 'Rời khỏi sự vụ', onClick: () => setLeaveDialogOpen(true), danger: true });
          }
          if (canEdit) {
            items.push({ key: 'change-status', icon: null, label: 'Đổi trạng thái', onClick: () => setStatusTarget({ incidentId: incident.incidentId, state: incident.state }) });
          }
          if (canEditPriority) {
            items.push({ key: 'change-priority', icon: null, label: 'Đổi ưu tiên', onClick: () => setPriorityTarget({ incidentId: incident.incidentId, priority: incident.priority }) });
          }
          if (incident.state === STATE_CLOSED) {
            items.push({ key: 'reopen', icon: null, label: 'Mở lại hồ sơ', onClick: () => setReopenTarget({ incidentId: incident.incidentId }), danger: true });
          }
          if (isSenior && incident.commanderPerId) {
            items.push({
              key: 'change-commander',
              icon: null,
              label: 'Đổi chỉ huy',
              onClick: () => setCommanderTarget({ incidentId: incident.incidentId, commanderPerId: incident.commanderPerId, commanderName: incident.commanderName })
            });
          }
          if (canEdit) {
            items.push({ key: 'edit-class', icon: null, label: 'Sửa lớp liên quan', onClick: () => setClassificationTarget({ incidentId: incident.incidentId, currentClassName: incident.className || null }) });
          }

          const ackItem = items.find((it) => it.contained);
          const listItems = items.filter((it) => !it.contained);

          return (
            <>
              {ackItem && (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={ackItem.icon}
                  disabled={ackItem.disabled}
                  onClick={ackItem.onClick}
                  sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 1.2 }}
                >
                  {ackItem.label}
                </Button>
              )}
              {listItems.length > 0 && (
                <List mode="card">
                  {listItems.map((it) => (
                    <List.Item key={it.key} arrow={!it.disabled} disabled={it.disabled} clickable={!it.disabled} onClick={it.onClick}>
                      <span style={{ color: it.danger ? '#dc2626' : undefined, fontWeight: 500 }}>{it.label}</span>
                    </List.Item>
                  ))}
                </List>
              )}
            </>
          );
        })()}
      </Space>

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
        description={`Bạn sẽ tự thêm mình vào danh sách người tham gia xử lý ${incident.incidentId}.`}
        confirmLabel="Tham gia"
        confirmColor="#2563eb"
        onClose={() => setJoinDialogOpen(false)}
        onSubmit={async (reason) => {
          await api.post(`/api/safety/incidents/${incident.incidentId}/join`, { reason });
          load();
          setToast({ message: 'Đã gửi yêu cầu tham gia sự vụ.', severity: 'success' });
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
          setToast({ message: base + notified, severity: 'success' });
        }}
      />
    </MobileScreenShell>
  );
}
