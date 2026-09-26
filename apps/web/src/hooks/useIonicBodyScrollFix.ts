import { useEffect } from 'react';

/**
 * BUG THẬT tự phát hiện 2026-09-26 (Sin báo trên điện thoại thật: "vô đó
 * chỉ bấm chứ không cuộn được gì luôn" — không chỉ ở 1 trang, RẤT NHIỀU
 * trang bị mất khả năng cuộn): `@ionic/react/css/structure.css` đặt cứng
 *   body{position:fixed;overflow:hidden;height:100%;...}
 * — giả định TOÀN BỘ app là Ionic (IonContent tự cuộn nội bộ, không cần
 * body cuộn). CSS này nạp qua `import '@ionic/react/css/structure.css'`
 * bên trong từng Mobile*Page (cố tình lazy-load để tách chunk, KHÔNG lẫn
 * bundle chính) — nhưng CSS là hiệu ứng TOÀN CỤC, không tự gỡ khi rời
 * trang: một khi đã ghé qua 1 trang Ionic bất kỳ trong phiên, MỌI trang
 * MUI thường còn lại (Sự vụ, Cockpit, chi tiết hồ sơ, Audit log, Phân
 * tích...) mất luôn khả năng cuộn trang thật, vì chúng dựa vào cuộn body
 * bình thường chứ không có IonContent riêng.
 *
 * Fix: mỗi trang Ionic thật (có IonPage/IonContent) gọi hook này — lúc
 * MOUNT xoá override inline (cho CSS gốc của Ionic áp dụng đúng như thiết
 * kế, cần thiết để IonContent cuộn mượt/không bị rung khi kéo quá đà trên
 * iOS), lúc UNMOUNT (rời trang) ép body về trạng thái cuộn bình thường
 * bằng style inline — inline thắng rule trong stylesheet nên đè được
 * structure.css dù nó vẫn còn nằm trong <head>.
 */
export function useIonicBodyScrollFix() {
  useEffect(() => {
    document.body.style.position = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
    return () => {
      document.body.style.position = 'static';
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
    };
  }, []);
}
