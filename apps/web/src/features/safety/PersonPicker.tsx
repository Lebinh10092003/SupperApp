/**
 * PersonPicker.tsx — ô chọn 1 người theo tên, gọi
 * `GET /api/safety/people/search?q=` (`people-search.ts`, K7). Backend chỉ
 * trả `{perId, name}` (KHÔNG email/uid vì lý do bảo mật) — component này
 * KHÔNG tự suy ra thêm thông tin gì khác ngoài 2 field đó.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface PersonOption {
  perId: string;
  name: string;
}

export function PersonPicker({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: PersonOption | null;
  onChange: (person: PersonOption | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (value && !options.some((o) => o.perId === value.perId)) return [value, ...options];
    return options;
  }, [options, value]);

  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', !value && 'text-muted-foreground')}>{value ? value.name : 'Gõ tên để tìm...'}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Gõ tên để tìm..." value={inputValue} onValueChange={setInputValue} />
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
                    {optionsWithSelected.map((o) => (
                      <CommandItem
                        key={o.perId}
                        value={o.perId}
                        onSelect={() => {
                          onChange(value?.perId === o.perId ? null : o);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 size-4', value?.perId === o.perId ? 'opacity-100' : 'opacity-0')} />
                        {o.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
