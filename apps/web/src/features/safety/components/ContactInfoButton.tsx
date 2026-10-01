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
import { Contact, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ContactInfo {
  perId: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function ContactInfoButton({ perId, name }: { perId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [error, setError] = useState('');

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !contact && !loading) {
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
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon-xs" variant="ghost" className="text-slate-500">
              <Contact className="size-[17px]" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Xem liên hệ của {name}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-56">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold">{name}</p>
          {loading && <Loader2 className="size-4 animate-spin text-slate-500" />}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {contact && (
            <>
              <p className="text-sm">
                Email:{' '}
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-slate-400">Chưa có</span>
                )}
              </p>
              <p className="text-sm">
                SĐT:{' '}
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-slate-400">Chưa có — liên hệ Quản trị viên để bổ sung</span>
                )}
              </p>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
