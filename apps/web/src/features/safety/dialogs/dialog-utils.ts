/**
 * dialog-utils.ts — tiện ích dùng chung cho 4 dialog hành động (Chunk B).
 *
 * `api.ts` (services/api.ts) chỉ ném `Error(message)` thuần — KHÔNG giữ
 * lại HTTP status/code (`APPROVAL_REQUIRED`...) khi throw ra tới UI. 3 hàm
 * nghiệp vụ khác nhau ở `incident-lifecycle.ts` dùng 3 câu message khác
 * nhau cho cùng 1 tình huống "cần phê duyệt" — nhận diện bằng substring
 * chung "phê duyệt" thay vì so khớp nguyên văn từng câu (dễ vỡ nếu backend
 * đổi câu chữ).
 */
export function isApprovalRequiredMessage(message: string | undefined | null): boolean {
  return typeof message === 'string' && message.includes('phê duyệt');
}
