/**
 * MobileScreenShell.tsx — khung chuẩn cho MỌI màn hình mobile trong app
 * (thay thế hoàn toàn cách làm cũ: bọc `<Box p=...>` + tự chèn
 * `<MobileTabBar position=fixed/sticky>` rải rác từng trang, đã gây 3 lần
 * sửa lỗi thất bại — xem ghi chú đầy đủ ở MobileTabBar.tsx).
 *
 * Cấu trúc: flex-column cao đúng 100dvh (район an toàn thiết bị qua
 * `env(safe-area-inset-*)`), header (tuỳ chọn, thường là NavBar) đứng
 * yên, PHẦN NỘI DUNG MỚI LÀ VÙNG CUỘN (flex:1, overflow-y:auto) — thanh
 * tab dưới cùng nằm NGOÀI vùng cuộn, không cần bất kỳ CSS `position`
 * fixed/sticky nào để "dính đáy" — nó vốn dĩ luôn ở đáy vì nội dung cuộn
 * bên trong nó, không phải cả trang cuộn qua nó.
 */
import type { ReactNode } from 'react';

export function MobileScreenShell({
  header,
  children,
  tabBar,
  contentPadding = true
}: {
  header?: ReactNode;
  children: ReactNode;
  tabBar?: ReactNode;
  contentPadding?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: '#f4f5f7',
        overflow: 'hidden'
      }}
    >
      {header}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: contentPadding ? 16 : 0
        }}
      >
        {children}
      </div>
      {tabBar}
    </div>
  );
}
