/**
 * email-adapter.ts — Adapter email thật (Sin chốt 2026-09-24, sau khi rà
 * soát phát hiện `ADAPTERS = {}` rỗng hoàn toàn ở `notify-hooks.ts` —
 * không có email/SMS/push nào thật sự gửi ra ngoài, mọi thông báo chỉ ghi
 * `dispatch_log: no_adapter_configured`).
 *
 * 2 chế độ, tự chọn theo cấu hình `.env` (Sin chốt 2026-09-24, bổ sung sau
 * khi xác nhận luồng đúng qua Ethereal):
 *  - CÓ đủ SMTP_HOST/SMTP_USER/SMTP_PASS -> dùng SMTP THẬT (Google
 *    Workspace của trường — smtp.gmail.com + email @thcs-giangvo.edu.vn +
 *    App Password, hoặc bất kỳ SMTP nào khác) — email tới THẲNG hộp thư
 *    thật của người nhận.
 *  - KHÔNG có -> rơi về Ethereal (ethereal.email) — SMTP TEST miễn phí,
 *    KHÔNG cần đăng ký tài khoản, email KHÔNG BAO GIỜ tới hộp thư thật,
 *    chỉ xem qua link preview trả về sau mỗi lần gửi. Dùng cho dev/test
 *    khi chưa có SMTP thật, hoặc để không phát tán email thử ra ngoài.
 *
 * Transporter tạo 1 LẦN, CACHE lại cho suốt vòng đời process.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import type { DispatchAdapter } from './dispatch.js';

let transporterPromise: Promise<{ transporter: Transporter; mode: 'smtp' | 'ethereal' }> | null = null;

function hasRealSmtpConfig(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (hasRealSmtpConfig()) {
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
        });
        console.log('[email-adapter] Dùng SMTP THẬT:', env.SMTP_HOST, '— email gửi thẳng tới hộp thư thật.');
        return { transporter, mode: 'smtp' as const };
      }
      const account = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass }
      });
      console.log(
        '[email-adapter] CHƯA cấu hình SMTP thật (SMTP_HOST/SMTP_USER/SMTP_PASS) — dùng Ethereal TEST, email KHÔNG tới hộp thư thật, chỉ xem qua link preview. Tài khoản test:',
        account.user
      );
      return { transporter, mode: 'ethereal' as const };
    })();
  }
  return transporterPromise;
}

/**
 * `DispatchAdapter` đúng shape mà `dispatch.ts::dispatchRequest` (kênh
 * "email") và `reporter-notify.ts` (`opts.emailAdapter`) đều gọi —
 * `send({ to, subject, text })`, trả `{ status, previewUrl }`.
 */
export const emailAdapter: DispatchAdapter = {
  async send(msg) {
    const { to, subject, text } = msg as { to?: string; subject?: string; text?: string };
    if (!to) throw new Error('email-adapter: thiếu "to".');
    const { transporter, mode } = await getTransporter();
    const info = await transporter.sendMail({
      from: env.SMTP_FROM || '"THCS Giảng Võ — Cảnh báo an toàn" <no-reply@thcsgiangvo.edu.vn>',
      to,
      subject: subject || 'Thông báo từ hệ thống',
      text: text || ''
    });
    const previewUrl = mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) || undefined : undefined;
    return { status: 'sent', previewUrl };
  }
};
