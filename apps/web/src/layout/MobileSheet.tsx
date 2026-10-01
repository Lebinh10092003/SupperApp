import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { SIDEBAR_WIDTH } from './nav-data';

/** Drawer tạm thời trên di động — y hệt <Drawer variant="temporary"> cũ
 * trong AppShell.tsx (bản MUI), dùng chung đúng 1 nội dung Sidebar với
 * bản desktop cố định (xem AppShell.tsx). */
export function MobileSheet({
  open,
  onOpenChange,
  onOpenSearch
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSearch: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[270px] max-w-[270px] p-0 sm:max-w-none" style={{ width: SIDEBAR_WIDTH }}>
        {/* shadcn Dialog/Sheet yêu cầu 1 Title cho a11y — ẩn khỏi mắt vì
         * Sidebar đã tự có tiêu đề thương hiệu riêng ("Trường THCS Giảng
         * Võ") ngay bên trong. */}
        <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
        <Sidebar onNavigate={() => onOpenChange(false)} onOpenSearch={onOpenSearch} />
      </SheetContent>
    </Sheet>
  );
}
