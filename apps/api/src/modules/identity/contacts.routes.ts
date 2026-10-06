/**
 * contacts.routes.ts — CRUD "nhóm liên hệ" cho sổ danh bạ nội bộ (bổ sung
 * 2026-10-02, xem contacts.schema.ts). Thành viên nhóm chỉ lưu `perId` —
 * tên/email/SĐT để hiển thị PHẢI tra thêm qua
 * `GET /api/safety/people/contact?perIds=` có sẵn (safety-query.routes.ts),
 * route này không trả lại những field đó để tránh trùng lặp nguồn dữ
 * liệu/dễ lệch nhau.
 *
 * Quyền: ai đăng nhập cũng xem được TOÀN BỘ nhóm mặc định (ownerPerId
 * null) + nhóm cá nhân của chính mình. Sửa/xoá nhóm cá nhân chỉ chủ nhóm;
 * sửa/xoá/tạo nhóm mặc định chỉ vai trò có capability MANAGE_USERS (BGH —
 * khớp đúng tập vai trò đang được dùng để gate /admin ở frontend).
 */
import { Router, type Request } from 'express';
import { and, eq, isNull, or } from 'drizzle-orm';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from './actor-context.js';
import { accounts } from './identity.schema.js';
import { can } from '../../auth/roles.js';
import { contactGroups, contactGroupMembers } from './contacts.schema.js';
import { assertCanManageGroup } from './contacts.permissions.js';

export const contactsRouter = Router();

async function resolveActor(req: Request) {
  return loadActorContext(db, req.appUser!.uid);
}

contactsRouter.get(
  '/groups',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await resolveActor(req);
    const groups = await db
      .select()
      .from(contactGroups)
      .where(or(isNull(contactGroups.ownerPerId), eq(contactGroups.ownerPerId, actor.perId!)));
    const members = await db.select().from(contactGroupMembers);
    const membersByGroup = new Map<string, string[]>();
    for (const m of members) {
      const list = membersByGroup.get(m.groupId) ?? [];
      list.push(m.perId);
      membersByGroup.set(m.groupId, list);
    }
    res.json({
      results: groups.map((g) => ({
        groupId: g.groupId,
        name: g.name,
        scope: g.ownerPerId === null ? 'school' : 'personal',
        mine: g.ownerPerId === actor.perId,
        perIds: membersByGroup.get(g.groupId) ?? []
      }))
    });
  })
);

contactsRouter.post(
  '/groups',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await resolveActor(req);
    const d = req.body || {};
    const name = String(d.name || '').trim();
    if (!name) throw new HttpError(400, 'Thiếu tên nhóm.', 'INVALID_INPUT');
    const scope = d.scope === 'school' ? 'school' : 'personal';
    if (scope === 'school' && !can(req.appUser!.role, 'MANAGE_USERS')) {
      throw new HttpError(403, 'Chỉ Ban giám hiệu được tạo nhóm liên hệ mặc định toàn trường.', 'PERMISSION_ERROR');
    }
    const [row] = await db
      .insert(contactGroups)
      .values({ name, ownerPerId: scope === 'school' ? null : actor.perId! })
      .returning();
    res.status(201).json({ groupId: row!.groupId, name: row!.name, scope, mine: scope === 'personal', perIds: [] });
  })
);

contactsRouter.patch(
  '/groups/:id',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await resolveActor(req);
    const id = String(req.params.id);
    const [group] = await db.select().from(contactGroups).where(eq(contactGroups.groupId, id)).limit(1);
    if (!group) throw new HttpError(404, 'Không tìm thấy nhóm.', 'NOT_FOUND');
    assertCanManageGroup(group, actor.perId!, req.appUser!.role);
    const name = String(req.body?.name || '').trim();
    if (!name) throw new HttpError(400, 'Thiếu tên nhóm.', 'INVALID_INPUT');
    await db.update(contactGroups).set({ name }).where(eq(contactGroups.groupId, id));
    res.json({ ok: true });
  })
);

contactsRouter.delete(
  '/groups/:id',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await resolveActor(req);
    const id = String(req.params.id);
    const [group] = await db.select().from(contactGroups).where(eq(contactGroups.groupId, id)).limit(1);
    if (!group) throw new HttpError(404, 'Không tìm thấy nhóm.', 'NOT_FOUND');
    assertCanManageGroup(group, actor.perId!, req.appUser!.role);
    await db.delete(contactGroups).where(eq(contactGroups.groupId, id));
    res.json({ ok: true });
  })
);

contactsRouter.post(
  '/groups/:id/members',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await resolveActor(req);
    const id = String(req.params.id);
    const perId = String(req.body?.perId || '').trim();
    if (!perId) throw new HttpError(400, 'Thiếu perId.', 'INVALID_INPUT');
    const [group] = await db.select().from(contactGroups).where(eq(contactGroups.groupId, id)).limit(1);
    if (!group) throw new HttpError(404, 'Không tìm thấy nhóm.', 'NOT_FOUND');
    assertCanManageGroup(group, actor.perId!, req.appUser!.role);
    const [person] = await db.select().from(accounts).where(eq(accounts.perId, perId)).limit(1);
    if (!person) throw new HttpError(404, 'Không tìm thấy người này trong hệ thống.', 'NOT_FOUND');
    await db.insert(contactGroupMembers).values({ groupId: id, perId }).onConflictDoNothing();
    res.status(201).json({ ok: true });
  })
);

contactsRouter.delete(
  '/groups/:id/members/:perId',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await resolveActor(req);
    const id = String(req.params.id);
    const [group] = await db.select().from(contactGroups).where(eq(contactGroups.groupId, id)).limit(1);
    if (!group) throw new HttpError(404, 'Không tìm thấy nhóm.', 'NOT_FOUND');
    assertCanManageGroup(group, actor.perId!, req.appUser!.role);
    await db
      .delete(contactGroupMembers)
      .where(and(eq(contactGroupMembers.groupId, id), eq(contactGroupMembers.perId, String(req.params.perId))));
    res.json({ ok: true });
  })
);
