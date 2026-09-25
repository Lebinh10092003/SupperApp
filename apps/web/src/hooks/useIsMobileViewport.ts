import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT_PX = 820;

/**
 * Phát hiện màn hình hẹp (điện thoại) qua `matchMedia`, tự cập nhật khi
 * xoay máy/resize — dùng để tự động đổi sang giao diện Ionic mobile ngay
 * trên CÙNG một URL, không cần dẫn người dùng sang link riêng.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
