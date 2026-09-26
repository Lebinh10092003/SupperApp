/**
 * MobileAuditLogPage.tsx — bản mobile của "Nhật ký kiểm toán"
 * (/safety/audit-logs). Trang admin/kiểm toán, ít dùng trên điện thoại —
 * vẫn làm gọn theo đúng khung mobile chung, tái dùng nguyên logic gọi API
 * (không có hook riêng vì logic đơn giản, không cần trích xuất).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, SearchBar, List, SpinLoading, Dialog as AntDialog } from 'antd-mobile';
import { Box, Typography, Button } from '@mui/material';
import { api } from '../../services/api';
import { MobileScreenShell } from '../MobileScreenShell';
import { MobileTabBar } from '../MobileTabBar';
import { ACTION_LABEL } from '../../features/safety/auditActionLabels';

interface AuditLogEntry {
  logId: string;
  occurredAt: string;
  actorPerId: string;
  actorLabel?: string;
  action: string;
  objectId: string;
  reason: string | null;
  before: unknown;
  after: unknown;
}

const PAGE_SIZE = 50;

export default function MobileAuditLogPage() {
  const navigate = useNavigate();
  const [objectId, setObjectId] = useState('');
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = (q: string) => {
    setLoading(true);
    setError('');
    const qs = q.trim() ? `?objectId=${encodeURIComponent(q.trim())}&limit=${PAGE_SIZE}` : `?limit=${PAGE_SIZE}`;
    api
      .get<{ items: AuditLogEntry[]; hasMore: boolean }>(`/api/safety/audit-logs${qs}`)
      .then((res) => {
        setItems(res.items || []);
        setHasMore(!!res.hasMore);
        setSearched(true);
      })
      .catch((e: any) => setError(e.message || 'Không tải được nhật ký kiểm toán (có thể vai trò của bạn không đủ quyền xem).'))
      .finally(() => setLoading(false));
  };

  const loadMore = () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (objectId.trim()) params.set('objectId', objectId.trim());
    params.set('limit', String(PAGE_SIZE));
    params.set('before', last.occurredAt);
    api
      .get<{ items: AuditLogEntry[]; hasMore: boolean }>(`/api/safety/audit-logs?${params.toString()}`)
      .then((res) => {
        setItems((prev) => [...prev, ...(res.items || [])]);
        setHasMore(!!res.hasMore);
      })
      .catch((e: any) => setError(e.message || 'Không tải thêm được.'))
      .finally(() => setLoading(false));
  };

  const showDetail = (it: AuditLogEntry) => {
    AntDialog.alert({
      title: 'Chi tiết bản ghi kiểm toán',
      content: (
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2">Thời gian: {new Date(it.occurredAt).toLocaleString('vi-VN')}</Typography>
          <Typography variant="body2">Người thực hiện: {it.actorLabel || it.actorPerId}</Typography>
          <Typography variant="body2">Hành động: {ACTION_LABEL[it.action] || it.action}</Typography>
          <Typography variant="body2">Đối tượng: {it.objectId}</Typography>
          {it.reason && <Typography variant="body2">Lý do: {it.reason}</Typography>}
        </Box>
      )
    });
  };

  return (
    <MobileScreenShell header={<NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>Nhật ký kiểm toán</NavBar>} tabBar={<MobileTabBar />} contentPadding={false}>
      <Box sx={{ p: 2 }}>
        <SearchBar
          placeholder="Mã hồ sơ/đối tượng — để trống xem gần đây nhất"
          value={objectId}
          onChange={setObjectId}
          onSearch={() => load(objectId)}
          showCancelButton={false}
        />
        <Button fullWidth variant="contained" sx={{ mt: 1.5, textTransform: 'none' }} onClick={() => load(objectId)}>
          Tra cứu
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <SpinLoading />
        </Box>
      )}
      {error && (
        <Typography color="error" sx={{ px: 2 }}>
          {error}
        </Typography>
      )}
      {searched && !loading && !error && (
        <List mode="card">
          {items.length === 0 && <List.Item>Không có bản ghi nào.</List.Item>}
          {items.map((it) => (
            <List.Item key={it.logId} arrow clickable onClick={() => showDetail(it)} description={`${it.actorLabel || it.actorPerId} · ${it.objectId}`}>
              <Typography variant="body2" fontWeight={600}>
                {ACTION_LABEL[it.action] || it.action}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(it.occurredAt).toLocaleString('vi-VN')}
              </Typography>
            </List.Item>
          ))}
        </List>
      )}
      {searched && hasMore && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Button variant="outlined" onClick={loadMore} sx={{ textTransform: 'none' }}>
            Tải thêm
          </Button>
        </Box>
      )}
    </MobileScreenShell>
  );
}
