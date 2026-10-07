/**
 * PeopleMultiPicker.tsx — chọn NHIỀU người theo tên, dùng chung
 * `GET /api/safety/people/search?q=` với PersonPicker.tsx (module An
 * toàn) — endpoint đọc từ hạ tầng identity dùng chung, không riêng module
 * nào, nên tái dùng thẳng thay vì viết lại lời gọi API.
 *
 * Nút "Chọn toàn bộ" (Sin yêu cầu 2026-09-21) — tự động chọn HẾT người có
 * tài khoản qua `GET /api/safety/people/all`, thay vì bấm chọn từng người
 * khi muốn mời toàn trường tham dự 1 lịch.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { api } from '../../../services/api';
import type { PersonOption } from '../../safety/PersonPicker';
import { ContactGroupPickerButton } from '../../contacts/ContactGroupPickerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function PeopleMultiPicker({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: PersonOption[];
  onChange: (people: PersonOption[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const query = inputValue.trim();

  useEffect(() => {
    if (query.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<{ results: PersonOption[] }>(`/api/safety/people/search?q=${encodeURIComponent(query)}`)
        .then((res) => {
          if (!cancelled) setOptions(res.results || []);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const optionsWithSelected = useMemo(() => {
    const extra = value.filter((v) => !options.some((o) => o.perId === v.perId));
    return [...extra, ...options];
  }, [options, value]);

  const selectAll = async () => {
    setSelectingAll(true);
    try {
      const res = await api.get<{ results: PersonOption[] }>('/api/safety/people/all');
      onChange(res.results || []);
    } catch {
      // Best-effort — lỗi tải danh sách không cần chặn form, người dùng vẫn
      // chọn tay được như bình thường.
    } finally {
      setSelectingAll(false);
    }
  };

  const toggle = (person: PersonOption) => {
    if (value.some((v) => v.perId === person.perId)) {
      onChange(value.filter((v) => v.perId !== person.perId));
    } else {
      onChange([...value, person]);
    }
  };

  // Trường ~100 người, bấm "Chọn toàn bộ" trước đây render HẾT từng
  // chip trong ô -> modal dài vô tận (Sin phản hồi 2026-09-24). Chỉ
  // hiện 2 chip đầu + "+N" còn lại, vẫn đủ để bỏ chọn từng người nếu cần
  // (bấm vào ô để xem/xoá lại).
  const visibleChips = value.slice(0, 2);
  const extraCount = value.length - visibleChips.length;

  return (
    <div className="min-w-0 flex flex-col gap-1.5">
      <Label className="block">{label}</Label>
      <div className="flex min-w-0 items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="min-w-0 flex-1 justify-between overflow-hidden font-normal">
            <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              {value.length === 0 ? (
                <span className="text-muted-foreground">Tìm theo tên hoặc email</span>
              ) : (
                <>
                  {visibleChips.map((p) => (
                    <Badge key={p.perId} variant="outline" title={p.name} className="min-w-0 max-w-[42%] gap-1 border-transparent bg-secondary text-[#1d4ed8]">
                      <span className="truncate">{p.name}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(p);
                        }}
                      >
                        <X className="size-3" />
                      </span>
                    </Badge>
                  ))}
                  {extraCount > 0 && (
                    <Badge variant="outline" className="border-transparent bg-slate-100 text-slate-600">
                      +{extraCount}
                    </Badge>
                  )}
                </>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Tìm theo tên hoặc email" value={inputValue} onValueChange={setInputValue} />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Đang tìm...
                </div>
              ) : (
                <>
                  <CommandEmpty>{query.length < 2 ? 'Gõ ít nhất 2 ký tự để tìm' : 'Không tìm thấy'}</CommandEmpty>
                  <CommandGroup>
                    {optionsWithSelected.map((o) => {
                      const checked = value.some((v) => v.perId === o.perId);
                      return (
                        <CommandItem key={o.perId} value={o.perId} onSelect={() => toggle(o)}>
                          <Check className={checked ? 'mr-2 size-4 opacity-100' : 'mr-2 size-4 opacity-0'} />
                          {o.name} ({o.perId})
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!disabled && (
        // `selected={value}` nạp sẵn giỏ chọn hiện tại vào modal (Sin yêu
        // cầu 2026-10-05: "input sẵn người đã chọn ở ngoài") — modal cho
        // thêm/bớt tự do bên trong, "Xong" trả về NGUYÊN giỏ cuối cùng
        // (đã gồm cả xoá bớt nếu có), nên thay thế thẳng `value` thay vì
        // gộp thêm (gộp thêm sẽ không xoá được người đã bỏ chọn trong modal).
        <ContactGroupPickerButton selected={value} onPickMultiple={(people) => onChange(people)} />
      )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={selectAll} disabled={disabled || selectingAll} className="w-fit px-0 text-primary">
          {selectingAll ? 'Đang tải...' : 'Chọn toàn bộ'}
        </Button>
        {value.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onChange([])} disabled={disabled} className="w-fit px-0 text-slate-500">
            Bỏ chọn hết
          </Button>
        )}
        {value.length > 0 && <span className="text-xs text-slate-500">Đã chọn {value.length} người</span>}
      </div>
    </div>
  );
}
