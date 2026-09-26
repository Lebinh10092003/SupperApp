/**
 * MobileTabBar.tsx — thanh điều hướng dưới cùng kiểu app di động thật,
 * pilot 2026-09-25 sau khi Sin duyệt hướng "sửa UI mobile theo Ionic
 * React" (xem demo artifact trước đó). CỐ Ý KHÔNG dùng
 * `@ionic/react-router` (package đó yêu cầu react-router-dom <6, dự án
 * đang ở v7) — tự điều hướng bằng `useNavigate`/`useLocation` của
 * react-router-dom v7 sẵn có.
 *
 * BUG THẬT đã tìm ra + tự kiểm chứng bằng DevTools 2026-09-26 (Sin báo
 * "bấm cái nào cũng đẩy về An toàn", sau đó 1 bản vá tạm còn làm CRASH
 * TRẮNG MÀN HÌNH — đã rollback ngay và ghi lại ở đây để không lặp lại):
 *
 * `<IonTabBar>`/`<IonTabButton>` của @ionic/react được thiết kế để CHỈ
 * hoạt động đúng bên trong `<IonTabs>` (dùng prop `tab`/`href`, tự quản
 * lý route qua `IonTabsContext`). Đứng độc lập như ở đây:
 *  1) `onClick` trên `IonTabButton` bị chính component tự bóc khỏi DOM,
 *     chỉ gọi lại qua sự kiện nội bộ `ionTabButtonClick` — sự kiện đó cần
 *     `IonTabs` mới phát sinh đáng tin cậy → onClick không bao giờ chạy.
 *  2) Bọc `IonTabButton` bằng 1 thẻ `<div>` để né (1) làm hỏng LUÔN việc
 *     phân phối slot Shadow DOM của `ion-tab-bar` (`<slot>` chỉ nhận CON
 *     TRỰC TIẾP) → thanh tab biến mất hoàn toàn.
 *  3) Lấy `ref` trên `<IonTabBar>` để tự `querySelectorAll` KHÔNG trả về
 *     DOM node thật — nó forward tới `IonTabBarUnwrapped`, một
 *     `React.PureComponent` (class), nên `ref.current` là INSTANCE REACT,
 *     không có `.querySelectorAll` → `TypeError`, crash trắng toàn app
 *     (đã tự gây ra, tự phát hiện qua console error, rollback ngay).
 *
 * FIX DỨT ĐIỂM: bỏ hẳn `IonTabBar`/`IonTabButton`, tự dựng thanh tab bằng
 * phần tử HTML thường (`<button>`) — chỉ mượn `<IonIcon>` (thuần hiển
 * thị, không dính onClick) để giữ đúng bộ icon Ionic. `<button>` là
 * DOM/React chuẩn, onClick chắc chắn chạy, không có custom
 * element/shadow-DOM/class-ref nào để hỏng.
 *
 * BUG THỨ 2 — 2026-09-26 (Sin báo trên iPhone thật: thanh tab "trôi/kẹt"
 * giữa trang khi cuộn tay, dù đo bằng script cuộn lập trình
 * (`window.scrollTo`) trên DevTools thì vẫn đứng yên đúng đáy màn hình —
 * script không tái hiện được vì đây là lỗi CHỈ xảy ra với cử chỉ cuộn
 * chạm thật (touch/momentum scroll), không phải scroll lập trình).
 * NGUYÊN NHÂN: lỗi nền tảng đã biết của Safari iOS — phần tử
 * `position:fixed` không được đẩy lên layer GPU riêng dễ bị "rớt lại"
 * (jank/drift) trong lúc cuộn quán tính (momentum scroll) và thanh địa
 * chỉ Safari tự ẩn/hiện làm đổi chiều cao viewport. FIX: ép phần tử lên
 * layer GPU riêng bằng `transform: translateZ(0)` — cách khắc phục tiêu
 * chuẩn cho đúng lỗi này trên iOS Safari.
 */
import { IonIcon, IonBadge } from '@ionic/react';
import { shieldOutline, calendarOutline, schoolOutline, personCircleOutline } from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';

interface TabDef {
  path: string;
  matchPaths: string[];
  icon: string;
  label: string;
}

// Trỏ thẳng vào ĐÚNG URL desktop đã dùng (/safety, /work-schedule/tasks,
// /classroom) — không còn "/mobile-preview/..." riêng (Sin phản hồi
// 2026-09-25 lần 2: không muốn bị dẫn sang link khác, giao diện phải tự
// đổi ngay trên URL người dùng đang mở qua `pResponsive` ở App.tsx).
// "/account" là trang mới (hồ sơ cá nhân), chưa có ở bản desktop.
const TABS: TabDef[] = [
  { path: '/safety', matchPaths: ['/', '/safety'], icon: shieldOutline, label: 'An toàn' },
  { path: '/work-schedule/tasks', matchPaths: ['/work-schedule', '/work-schedule/tasks'], icon: calendarOutline, label: 'Lịch' },
  { path: '/classroom', matchPaths: ['/classroom'], icon: schoolOutline, label: 'Lớp học số' },
  { path: '/account', matchPaths: ['/account'], icon: personCircleOutline, label: 'Cá nhân' }
];

export function MobileTabBar({ activeCount }: { activeCount?: number }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        borderTop: '1px solid #e5e7eb',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: '#fff',
        zIndex: 10,
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        willChange: 'transform'
      }}
    >
      {TABS.map((t) => {
        const isActive = t.matchPaths.includes(location.pathname);
        const color = isActive ? '#2563eb' : '#64748b';
        return (
          <button
            key={t.path}
            type="button"
            onClick={() => navigate(t.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '6px 0',
              border: 'none',
              background: 'transparent',
              color,
              position: 'relative',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <span style={{ position: 'relative' }}>
              <IonIcon icon={t.icon} style={{ fontSize: 22 }} />
              {t.label === 'An toàn' && !!activeCount && (
                <IonBadge color="danger" style={{ position: 'absolute', top: -6, right: -10, fontSize: 10 }}>
                  {activeCount}
                </IonBadge>
              )}
            </span>
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
