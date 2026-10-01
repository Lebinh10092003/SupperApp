import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useVisibleNavGroups } from './nav-data';

const normalizeSearch = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

/** Tìm kiếm điều hành (⌘K/Ctrl+K) — y hệt Dialog tìm kiếm cũ trong
 * AppShell.tsx (bản MUI), chuyển sang dùng shadcn `Command` (cmdk) thay vì
 * tự quản lý mũi tên lên/xuống/Enter bằng tay — cmdk đã làm sẵn đúng việc
 * đó. Giữ nguyên bộ lọc `normalizeSearch` cũ (không phân biệt dấu tiếng
 * Việt) bằng `shouldFilter={false}` + tự lọc danh sách truyền vào, thay vì
 * dùng bộ lọc mặc định của cmdk (không xử lý tiếng Việt) — vì vậy dùng
 * trực tiếp <Command>/<Dialog> thay vì <CommandDialog> (component đó
 * không cho truyền shouldFilter xuống Command bên trong).
 *
 * `open`/`onOpenChange` do AppShell quản lý (controlled) — không tự giữ
 * state đóng/mở riêng, vì nút "Tìm kiếm điều hành..." trong Sidebar cũng
 * cần mở được đúng dialog này (không chỉ phím tắt ⌘K/Ctrl+K). */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const visibleGroups = useVisibleNavGroups();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const goToItem = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const trimmed = query.trim();
  const matches = (label: string) => !trimmed || normalizeSearch(label).includes(normalizeSearch(trimmed));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Tìm kiếm điều hành</DialogTitle>
        <DialogDescription>Tìm trang, chức năng...</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md" style={{ marginTop: '-20vh' }}>
        <Command shouldFilter={false} className="rounded-lg">
          <CommandInput placeholder="Tìm trang, chức năng..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Không tìm thấy mục nào khớp "{query}".</CommandEmpty>
            {visibleGroups.map((group) => {
              const items = group.items.filter((item) => matches(item.label));
              if (items.length === 0) return null;
              return (
                <CommandGroup key={group.groupTitle} heading={group.groupTitle}>
                  {items.map((item) => (
                    <CommandItem key={item.path} value={item.path} onSelect={() => goToItem(item.path)}>
                      {item.icon}
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
