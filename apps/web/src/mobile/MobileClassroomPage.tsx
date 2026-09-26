/**
 * MobileClassroomPage.tsx — tab "Lớp học số". Bản đọc-nhanh (read-only),
 * gọi thẳng `GET /api/classroom` — cùng nguồn dữ liệu với
 * ClassroomPage.tsx bản desktop, chỉ đổi lớp hiển thị và bỏ các thao tác
 * quản trị (đồng bộ/xoá/gán lớp) vốn không phù hợp trên điện thoại. Đã bỏ
 * @ionic/react, đổi sang antd-mobile.
 */
import { useEffect, useState } from 'react';
import { Card, Tag, SpinLoading } from 'antd-mobile';
import { LinkOutline } from 'antd-mobile-icons';
import { Box, Typography } from '@mui/material';
import { api } from '../services/api';
import { MobileScreenShell } from './MobileScreenShell';
import { MobileTabBar } from './MobileTabBar';

interface CourseItem {
  id: string;
  name: string;
  section?: string;
  courseState?: string;
  alternateLink?: string;
  className?: string;
  classId?: string;
}

export default function MobileClassroomPage() {
  const [items, setItems] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ items: CourseItem[] }>('/api/classroom')
      .then((x) => setItems(x.items || []))
      .catch(() => setError('Không tải được danh sách lớp học.'))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = items.filter((c) => c.courseState === 'ACTIVE').length;

  return (
    <MobileScreenShell tabBar={<MobileTabBar />} contentPadding={false}>
      <Box sx={{ p: 2, pb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700 }}>
          Google Classroom
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25 }}>
          Lớp học số
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {activeCount} lớp đang mở
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
          <SpinLoading />
        </Box>
      )}
      {error && (
        <Typography color="error" sx={{ px: 2 }}>
          {error}
        </Typography>
      )}
      {!loading && !error && items.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          Chưa có lớp học nào được đồng bộ.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, px: 2, pb: 2 }}>
        {items.map((c) => {
          const active = c.courseState === 'ACTIVE';
          return (
            <Card key={c.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.35, flex: 1 }}>
                  {c.name}
                </Typography>
                <Tag style={{ '--background-color': active ? '#ecfdf5' : '#f1f5f9', '--text-color': active ? '#059669' : '#64748b' } as any}>
                  {active ? 'Đang mở' : c.courseState || '—'}
                </Tag>
              </Box>
              {c.section && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {c.section}
                </Typography>
              )}
              {(c.className || c.classId) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  Đã gán lớp: {c.className || c.classId}
                </Typography>
              )}
              {c.alternateLink && (
                <Box
                  component="a"
                  href={c.alternateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, fontSize: 12.5, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                >
                  Mở Google Classroom <LinkOutline fontSize={13} />
                </Box>
              )}
            </Card>
          );
        })}
      </Box>
    </MobileScreenShell>
  );
}
