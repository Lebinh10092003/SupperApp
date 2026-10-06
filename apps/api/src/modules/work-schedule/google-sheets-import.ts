/**
 * google-sheets-import.ts — "Kéo dữ liệu từ Google Sheet" cho Lịch công
 * tác tuần (bổ sung 2026-09-28, sau khi Sin yêu cầu tự tạo 1 sheet mô
 * phỏng đúng cấu trúc rồi thử kéo thẳng). 1 CHIỀU — đọc rồi chèn vào bảng
 * trong app, KHÔNG BAO GIỜ ghi ngược lại sheet.
 *
 * Dùng lại cơ chế Domain-Wide Delegation (DWD) đã có sẵn cho Classroom
 * (`integrations/dwd.ts`) — mạo danh CHÍNH email của actor đang thực hiện
 * thao tác import để gọi Sheets API, không dùng 1 tài khoản dịch vụ cố
 * định chung — actor phải có quyền đọc sheet đó bằng chính tài khoản
 * Workspace của họ (giống hệt cách họ tự mở sheet trên trình duyệt).
 *
 * ĐÃ THỬ THẬT 2026-09-28: gọi thành công tới bước xin access token nhưng
 * Google trả `unauthorized_client` — scope
 * 'https://www.googleapis.com/auth/spreadsheets.readonly' CHƯA được cấp ở
 * Google Admin Console (Security > API controls > Domain-wide Delegation)
 * cho đúng Client ID của service account DWD đang dùng. Cần trường tự vào
 * Admin Console cấp thêm scope này (client_id lấy qua
 * `resolveServiceAccount()`, KHÔNG hard-code ở đây vì đã có sẵn ở
 * service-account.json) trước khi nút "Kéo dữ liệu" hoạt động thật.
 */
import { dwdToken } from '../../integrations/dwd.js';
import type { WeeklySheetRowInput } from './weekly-sheet.service.js';

export class GoogleSheetsImportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

/** Nhận cả link đầy đủ (docs.google.com/spreadsheets/d/<id>/edit...) lẫn ID trần. */
export function extractSpreadsheetId(urlOrId: string): string {
  const trimmed = (urlOrId || '').trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  throw new GoogleSheetsImportError('invalid_input', 'Không nhận diện được ID Google Sheet từ link đã dán.');
}

/**
 * Parse dữ liệu thô Sheets API (`values`, mảng-hàng-của-mảng-ô — Google TỰ
 * CẮT các ô trắng ở CUỐI mỗi hàng, không đệm cho đủ 5 cột) thành các dòng
 * sẵn sàng chèn vào `ltc_weekly_sheet_rows`.
 *
 * Cột A ("Thứ/ngày" trên sheet gốc) LÀ Ô GỘP (merge) qua nhiều hàng cùng
 * ngày trên sheet thật — Sheets API trả giá trị CHỈ ở hàng đầu ô gộp, các
 * hàng còn lại trả CHUỖI RỖNG. Forward-fill (mang ngày gần nhất xuống các
 * hàng rỗng) để tái tạo đúng nhóm ngày, KHÔNG cần sheet phải bỏ merge.
 *
 * Chấp nhận cột A ở 2 dạng: 'YYYY-MM-DD' (ISO, ưu tiên) hoặc 'D/M' /
 * 'DD/MM' (kiểu sheet thật hay ghi, VD "21/9") — suy năm từ `targetYear`
 * tham số vào (năm của tuần đang import tới).
 *
 * Hàng KHÔNG parse được ngày (tiêu đề, hàng header, hàng trắng hoàn toàn)
 * bị BỎ QUA lặng lẽ — không throw, để không chặn cả file chỉ vì 1-2 hàng
 * trang trí đầu sheet.
 */
export function parseWeeklySheetRows(values: string[][], targetYear: number): WeeklySheetRowInput[] {
  const rows: WeeklySheetRowInput[] = [];
  let lastDate: string | null = null;
  let sortOrderInDay = 0;

  for (const raw of values) {
    const cells = [0, 1, 2, 3, 4].map((i) => (raw[i] ?? '').toString().trim());
    const [colA, timeLabel, content, location, people] = cells;

    const parsedDate = colA ? parseDateCell(colA, targetYear) : null;
    if (parsedDate) {
      lastDate = parsedDate;
      sortOrderInDay = 0;
    }

    // Hàng hoàn toàn trắng (kể cả cột A) -> bỏ qua, không tính là dòng dữ liệu.
    if (!colA && !timeLabel && !content && !location && !people) continue;
    // Chưa từng thấy ngày nào (đang ở phần tiêu đề/header phía trên) -> bỏ qua.
    if (!lastDate) continue;
    // Có ngày ở cột A nhưng KHÔNG parse được (VD chính là hàng tiêu đề dài
    // "LỊCH CÔNG TÁC TUẦN...") VÀ chưa có nội dung gì khác -> chắc chắn là
    // hàng trang trí, bỏ qua.
    if (colA && !parsedDate && !timeLabel && !content && !location && !people) continue;

    rows.push({
      rowDate: lastDate,
      timeLabel,
      content,
      location,
      people,
      sortOrder: sortOrderInDay++
    });
  }
  return rows;
}

function parseDateCell(cell: string, targetYear: number): string | null {
  const iso = cell.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return cell;
  // "21/9", "21/09", có thể kèm tên thứ phía trước và dấu ngoặc ("Thứ Hai
  // (21/9)") -> CỐ Ý bắt buộc khớp TOÀN BỘ ô (neo ^...$), không chỉ "chứa
  // đâu đó" — bug thật gặp phải lúc viết: hàng tiêu đề dài
  // "...TỪ 21/9-27/9/2026" bị nhận nhầm thành ngày vì nó CHỨA chuỗi
  // "21/9" ở giữa câu, dù rõ ràng không phải 1 ô ngày thật.
  const dm = cell.match(/^(?:Thứ\s+\S+\s*)?\(?\s*(\d{1,2})\/(\d{1,2})\s*\)?\.?$/i);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${targetYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Gọi Sheets API thật (đọc range A1:E500) — mạo danh `actorEmail` qua DWD.
 * Ném `GoogleSheetsImportError` với `code` rõ ràng để route dịch sang
 * thông báo tiếng Việt phù hợp (KHÔNG lộ chi tiết lỗi Google thô cho
 * người dùng cuối).
 */
export async function fetchGoogleSheetValues(spreadsheetId: string, actorEmail: string): Promise<string[][]> {
  let token: string;
  try {
    token = await dwdToken(actorEmail, [SHEETS_READONLY_SCOPE]);
  } catch (e) {
    throw new GoogleSheetsImportError(
      'scope_not_authorized',
      'Hệ thống chưa được cấp quyền đọc Google Sheets (cần quản trị Google Workspace của trường vào Admin Console > Security > API controls > Domain-wide Delegation, thêm scope "https://www.googleapis.com/auth/spreadsheets.readonly" cho service account đang dùng).'
    );
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:E500`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) {
    throw new GoogleSheetsImportError('not_found', 'Không tìm thấy Google Sheet với link/ID này.');
  }
  if (res.status === 403) {
    throw new GoogleSheetsImportError(
      'no_access',
      `Tài khoản ${actorEmail} không có quyền đọc Google Sheet này — cần được chia sẻ (share) quyền xem trước.`
    );
  }
  if (!res.ok) {
    throw new GoogleSheetsImportError('sheets_api_error', 'Không đọc được Google Sheet — thử lại sau.');
  }
  const body = (await res.json()) as { values?: string[][] };
  return body.values || [];
}
