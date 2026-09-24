/**
 * ContactInfoButton.tsx — icon nhỏ cạnh tên 1 người (chỉ huy/người tham
 * gia hồ sơ) để xem email/SĐT và gọi/gửi mail thường trực tiếp khi cần
 * gấp — Sin yêu cầu 2026-09-24: "phải có cái đó để có thể gửi mail thường
 * hoặc gọi thẳng trong trường hợp cần thiết". Gọi
 * `GET /api/safety/people/contact?perIds=` (chỉ xem được khi đã đăng
 * nhập + có vai trò an toàn nào đó — KHÁC PersonPicker.tsx cố ý không trả
 * email khi TÌM theo tên, ở đây là XEM chi tiết 1 người đã biết trước).
 */
import { useState } from 'react';
import { IconButton, Popover, Stack, Typography, Link as MuiLink, CircularProgress, Tooltip } from '@mui/material';
import ContactPhoneRoundedIcon from '@mui/icons-material/ContactPhoneRounded';
import { api } from '../../../services/api';

interface ContactInfo {
  perId: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function ContactInfoButton({ perId, name }: { perId: string; name: string }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [error, setError] = useState('');

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    if (!contact && !loading) {
      setLoading(true);
      setError('');
      api
        .get<{ results: ContactInfo[] }>(`/api/safety/people/contact?perIds=${encodeURIComponent(perId)}`)
        .then((res) => setContact(res.results?.[0] || null))
        .catch(() => setError('Không tải được thông tin liên hệ.'))
        .finally(() => setLoading(false));
    }
  };

  return (
    <>
      <Tooltip title={`Xem liên hệ của ${name}`}>
        <IconButton size="small" onClick={handleOpen} sx={{ color: '#64748b', p: 0.25 }}>
          <ContactPhoneRoundedIcon sx={{ fontSize: 17 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={0.75} sx={{ p: 2, minWidth: 220 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {name}
          </Typography>
          {loading && <CircularProgress size={16} />}
          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
          {contact && (
            <>
              <Typography variant="body2">
                Email:{' '}
                {contact.email ? (
                  <MuiLink href={`mailto:${contact.email}`}>{contact.email}</MuiLink>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Chưa có</span>
                )}
              </Typography>
              <Typography variant="body2">
                SĐT:{' '}
                {contact.phone ? (
                  <MuiLink href={`tel:${contact.phone}`}>{contact.phone}</MuiLink>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Chưa có — liên hệ Quản trị viên để bổ sung</span>
                )}
              </Typography>
            </>
          )}
        </Stack>
      </Popover>
    </>
  );
}
