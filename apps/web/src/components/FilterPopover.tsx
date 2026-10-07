import type { ReactNode } from 'react';
import { ListFilter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Shared list-filter shell. Keeps every filter reachable on narrow/short
 * viewports while leaving each page responsible for its real filter fields. */
export function FilterPopover({
  activeCount,
  onClear,
  children
}: {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <ListFilter className="size-4" />
          Bộ lọc
          {activeCount > 0 && (
            <Badge variant="outline" className="h-5 min-w-5 justify-center bg-secondary px-1 text-[#1d4ed8]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] overflow-x-hidden overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#0f172a] dark:text-slate-100">Bộ lọc</p>
          {activeCount > 0 && (
            <button type="button" onClick={onClear} className="shrink-0 text-xs font-medium text-primary hover:underline">
              Xóa tất cả
            </button>
          )}
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-3">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
