/**
 * email-adapter.ts — Adapter email THẬT đầu tiên của hệ thống (Sin chốt
 * 2026-09-24, sau khi rà soát phát hiện `ADAPTERS = {}` rỗng hoàn toàn ở
 * `notify-hooks.ts` — không có email/SMS/push nào thật sự gửi ra ngoài,
 * mọi thông báo chỉ ghi `dispatch_log: no_adapter_configured`).
 *
 * Dùng Ethereal (ethereal.email) — dịch vụ SMTP TEST miễn phí, KHÔNG cần
 * đăng ký tài khoản trước (nodemailer tự tạo tài khoản test qua API của
 * Ethereal). Email KHÔNG BAO GIỜ tới hộp thư thật — chỉ xem được qua link
 * preview Ethereal trả về sau mỗi lần gửi. Đây là bước ĐẦU để xác nhận
 * TOÀN BỘ luồng gửi email (dispatch.ts, reporter-notify.ts, nội dung,
 * người nhận) chạy đúng thật — trước khi nối SMTP sản xuất thật (đổi
 * `createTransportReal()` sang cấu hình SMTP thật khi trường có, xem
 * TODO cuối file).
 *
 * Tài khoản Ethereal tạo 1 LẦN, CACHE lại cho suốt vòng đời process (tạo
 * lại tài khoản mới mỗi lần gửi vừa chậm vừa không cần thiết — Ethereal
 * không giới hạn số email gửi trên 1 tài khoản test).
 */

import nodemailer, { type Transporter } from 'nodemailer';
import type { DispatchAdapter } from './dispatch.js';

let transporterPromise: Promise<{ transporter: Transporter; account: { user: string; pass: string } }> | null = null;

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const account = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass }
      });
      console.log('[email-adapter] Đã tạo tài khoản Ethereal test — email gửi qua đây, xem preview qua link trả về mỗi lần gửi. Hộp thư test (nếu cần xem trực tiếp):', account.user);
      return { transporter, account };
    })();
  }
  return transporterPromise;
}

/**
 * `DispatchAdapter` đúng shape mà `dispatch.ts::dispatchRequest` (kênh
 * "email") và `reporter-notify.ts` (`opts.emailAdapter`) đều gọi —
 * `send({ to, subject, text })`, trả `{ status, previewUrl }`.
 */
export const etherealEmailAdapter: DispatchAdapter = {
  async send(msg) {
    const { to, subject, text } = msg as { to?: string; subject?: string; text?: string };
    if (!to) throw new Error('email-adapter: thiếu "to".');
    const { transporter } = await getTransporter();
    const info = await transporter.sendMail({
      from: '"THCS Giảng Võ — Cảnh báo an toàn" <no-reply@thcsgiangvo.edu.vn>',
      to,
      subject: subject || 'Thông báo từ hệ thống',
      text: text || ''
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    return { status: 'sent', previewUrl: previewUrl || undefined };
  }
};

// TODO (việc hạ tầng/vận hành riêng, ngoài phạm vi port logic): khi trường
// có SMTP thật (Google Workspace SMTP relay, hoặc dịch vụ như SES/SendGrid),
// đổi `getTransporter()` sang đọc host/port/user/pass thật từ biến môi
// trường (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS...) thay vì
// `nodemailer.createTestAccount()`. Không đổi gì khác — `etherealEmailAdapter`
// (đổi tên) vẫn implement đúng `DispatchAdapter`, nơi gọi (notify-hooks.ts)
// không cần sửa.
