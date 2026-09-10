/** normalizeForMatch — chuẩn hoá chuỗi để so khớp không phân biệt dấu/hoa-thường. */
export function normalizeForMatch(str: string | null | undefined): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}
