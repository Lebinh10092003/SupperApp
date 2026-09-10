/**
 * me.routes.ts — `GET /api/safety/me`, wrapper mỏng quanh `loadActorContext`
 * đã có sẵn (dùng bởi MỌI route nội bộ khác của module An toàn) — KHÔNG
 * phải port từ `index.js` gốc (bản Firebase không có endpoint này, vì
 * client cũ dùng `onCall` không cần biết trước role để ẩn/hiện nút — mọi
 * thứ chặn ở server, lỗi permission-denied hiện khi bấm).
 *
 * Thêm route này để FRONTEND MỚI (React/apps/web) có 1 nguồn CHÍNH THỨC
 * biết "tôi là ai, vai trò gì, đang trực ca không" để ẩn/hiện nút hành
 * động hợp lý (VD ẩn "Mở lại hồ sơ" nếu không phải Hiệu trưởng/Phó HT) —
 * KHÔNG PHẢI lớp phân quyền, chỉ là gợi ý hiển thị. Phân quyền THẬT vẫn
 * 100% ở server qua `authz.ts` 9 bước, y hệt mọi route khác — ẩn nút ở
 * client không có nghĩa hành động đó an toàn nếu gọi thẳng API.
 */

import { Router } from 'express';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';

export const meRouter = Router();

meRouter.get(
  '/me',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    res.json({ perId: actor.perId, roles: actor.roles, onDutyNow: actor.onDutyNow, activeDelegations: actor.activeDelegations });
  })
);
