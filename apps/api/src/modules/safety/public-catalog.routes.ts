/**
 * public-catalog.routes.ts — route ĐỌC danh mục tĩnh cho CỔNG CÔNG KHAI
 * (KHÔNG đăng nhập), port từ `exports.listCategories` trong `index.js` gốc.
 *
 * Bản gốc chặn bằng `checkAppCheckOrAuthEnforced` (Firebase App Check HOẶC
 * Auth token) — App Check là hạ tầng riêng của Firebase, KHÔNG có tương
 * đương trong repo Postgres này (chưa ai port/quyết định thay thế). Bỏ
 * chặn App Check ở đây — route này chỉ đọc danh mục tĩnh/công khai, không
 * có dữ liệu nhạy cảm, mở public HOÀN TOÀN khớp đúng ý nghĩa nghiệp vụ
 * ("phục vụ cổng công khai không cần đăng nhập").
 */

import { Router } from 'express';
import { asyncRoute } from '../../core/http.js';
import { CATEGORY_CATALOG, groupForCategory, groupLabelForCategory } from './catalog.js';

export const publicCatalogRouter = Router();

// Port từ `exports.listCategories`.
publicCatalogRouter.get(
  '/categories',
  asyncRoute(async (_req, res) => {
    const out = Object.entries(CATEGORY_CATALOG).map(([code, v]) => ({
      code,
      label: v.label,
      linkClass: v.linkClass,
      group: groupForCategory(code),
      groupLabel: groupLabelForCategory(code)
    }));
    res.status(200).json(out);
  })
);
