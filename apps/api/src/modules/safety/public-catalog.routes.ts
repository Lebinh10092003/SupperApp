/**
 * public-catalog.routes.ts — route ĐỌC danh mục tĩnh cho CỔNG CÔNG KHAI
 * (KHÔNG đăng nhập), port từ `exports.listCategories`/
 * `exports.listCampusZonesPublic` trong `index.js` gốc.
 *
 * Bản gốc chặn bằng `checkAppCheckOrAuthEnforced` (Firebase App Check HOẶC
 * Auth token) — App Check là hạ tầng riêng của Firebase, KHÔNG có tương
 * đương trong repo Postgres này (chưa ai port/quyết định thay thế). Bỏ
 * chặn App Check ở đây — 2 route này chỉ đọc danh mục tĩnh/công khai,
 * không có dữ liệu nhạy cảm, mở public HOÀN TOÀN khớp đúng ý nghĩa nghiệp
 * vụ ("phục vụ cổng công khai không cần đăng nhập").
 */

import { Router } from 'express';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { CATEGORY_CATALOG, groupForCategory, groupLabelForCategory } from './catalog.js';
// `AppError` ở đây PHẢI import từ zoneStats.ts (không phải shared.ts) —
// zoneStats.ts tự định nghĩa lớp `AppError` RIÊNG (trùng tên/hình dạng với
// bản ở shared.ts nhưng KHÔNG PHẢI cùng 1 class), nên `listCampusZones`
// ném ra instance của bản zoneStats.ts. Đã tự phát hiện: dùng nhầm bản
// shared.ts ở đây sẽ khiến `instanceof AppError` luôn false, lỗi
// invalid_input rơi vào nhánh `throw e` (500) thay vì trả đúng 400.
import { listCampusZones, AppError } from './zoneStats.js';

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

// Port từ `exports.listCampusZonesPublic` — CHỈ trả 4 field tối thiểu
// (zoneId, campusId, label, order), KHÔNG trả keywords/polygonPercent
// (không cần thiết cho cổng công khai, giảm payload).
publicCatalogRouter.get(
  '/campus-zones',
  asyncRoute(async (req, res) => {
    const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : undefined;
    try {
      const zones = await listCampusZones(db, { campusId });
      const out = zones.map((z) => ({ zoneId: z.zoneId, campusId: z.campusId, label: z.label, order: z.order }));
      res.status(200).json(out);
    } catch (e) {
      if (e instanceof AppError) {
        throw new HttpError(e.code === 'invalid_input' ? 400 : 500, e.message, e.code.toUpperCase());
      }
      throw e;
    }
  })
);
