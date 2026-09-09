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
// `AppError` import từ zoneStats.ts — từ PR #7 (gộp AppError về dùng chung
// shared.ts) đây chỉ là re-export, CÙNG 1 class với `shared.ts`. Trước đó
// zoneStats.ts tự định nghĩa lớp RIÊNG (bug `instanceof` thật, xem
// TASKS.md/REVIEW_LOG.md) — giữ import qua zoneStats.ts ở đây chỉ để rõ
// nguồn gốc lỗi (`listCampusZones` ném ra), không còn ý nghĩa "phải đúng
// bản nào" như trước nữa.
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
