/**
 * zoneStats.ts — Thống kê sự cố theo khu vực trong khuôn viên ("bản đồ điểm
 * nóng"), port 1-1 từ `zoneStats.js` (project An toàn, Firebase). Dùng danh
 * mục `campus_zones` (nạp tay/qua upsertCampusZone, giống hệt
 * `homeroom_assignments`/`grade_supervisor_assignments` — KHÔNG bắt buộc
 * phải có sẵn hết) và `zone_id`/`zone_ids` (tuỳ chọn) đã gắn trên
 * `incidents` (bảng NHÁP, xem `incidents.schema.ts`).
 *
 * Áp dụng ngưỡng ẩn tối thiểu (k-anonymity đơn giản,
 * `catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN`) để KHÔNG lộ số lượng vụ việc quá
 * nhỏ theo khu vực/nhóm sự cố — tránh suy ngược ra 1 học sinh/1 vụ cụ thể.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/zoneStats.js
 */

import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as catalog from './catalog.js';
import { incidents } from './incidents.schema.js';
import { campusZones, zoneCategories, campusMapMarkers, type PolygonPoint } from './campus-zones.schema.js';

type Db = NodePgDatabase<Record<string, never>>;

export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const VALID_RANGE_DAYS = [7, 30, 90];
const DEFAULT_RANGE_DAYS = 90;

// Hình dạng khu vực khi vẽ bằng trình vẽ kéo-thả (Konva.js) — mặc định
// 'rect' cho dữ liệu cũ. `polygon_percent` vẫn là 4 điểm góc bounding-box
// dù shape_type khác 'rect' — client tự vẽ hình nội tiếp bbox đó.
export const VALID_SHAPE_TYPES = ['rect', 'circle', 'l_shape', 't_shape', 'triangle'] as const;

// ~15 icon đánh dấu trang trí bên trong 1 khu vực — allowlist server-side.
export const VALID_ZONE_ICON_KEYS = [
  'restroom', 'plant', 'health', 'library', 'canteen', 'stairs', 'parking',
  'gate', 'sports', 'water', 'trash', 'security', 'electrical', 'fire_extinguisher', 'other'
] as const;

function toJsDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  return new Date(v as string);
}

interface IncidentRow {
  incidentId: string;
  campusId: string;
  categoryCode: string;
  priority: string;
  zoneIds: string[] | null;
  zoneId: string | null;
  createdAt: Date;
}

interface ZoneRow {
  zoneId: string;
  parentZoneId: string | null;
}

export interface ComputeZoneStatsFilter {
  campusId?: string;
  categoryCodes?: string[];
  rangeDays?: number;
}

export interface ZoneStatsEntry {
  zone_id: string;
  total_count: number | '<5';
  breakdown_hidden: boolean;
  by_priority: Record<string, number> | null;
  by_category: Record<string, number> | null;
  trend: Record<string, number> | null;
  severity_flag: boolean;
  descendant_count: number;
}

export interface ComputeZoneStatsResult {
  campus_id: string;
  range_days: number;
  category_filter: string[] | null;
  unassigned_count: number;
  total_incidents_campus: number;
  zones: ZoneStatsEntry[];
}

/**
 * computeZoneStats — thống kê sự cố theo khu vực cho 1 cơ sở, trong khoảng
 * `rangeDays` (mặc định/chỉ 7|30|90), lọc tuỳ chọn theo `categoryCodes`.
 * `opts.now` cho phép test cố định mốc thời gian.
 *
 * CỘNG DỒN CHA-CON (`parent_zone_id`): số hiển thị ở 1 khu vực = số của
 * CHÍNH nó + TỔNG số của MỌI khu vực con (đệ quy, khử trùng lặp theo
 * `incident_id`). Khu vực KHÔNG có con giữ hành vi Y HỆT trước đây.
 */
export async function computeZoneStats(db: Db, filter: ComputeZoneStatsFilter = {}, opts?: { now?: Date }): Promise<ComputeZoneStatsResult> {
  const { campusId, categoryCodes, rangeDays } = filter;
  if (!campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
  const now = opts?.now || new Date();

  const effectiveRangeDays = VALID_RANGE_DAYS.includes(rangeDays as number) ? (rangeDays as number) : DEFAULT_RANGE_DAYS;

  const [rawIncidents, allCampusZones] = await Promise.all([
    db.select().from(incidents).where(eq(incidents.campusId, campusId)),
    listAllCampusZones(db, { campusId })
  ]);
  const nowMs = now.getTime();
  const rangeThresholdMs = nowMs - effectiveRangeDays * 24 * 3600 * 1000;

  const allIncidents = (rawIncidents as unknown as IncidentRow[]).map((it) => ({
    ...it,
    _createdMs: (toJsDate(it.createdAt) || new Date(0)).getTime()
  }));

  // Suy `zoneIds` hiệu lực của 1 incident: ưu tiên mảng `zoneIds` mới, rơi
  // về `zoneId` cũ (đơn) nếu chưa có.
  function effectiveZoneIds(it: (typeof allIncidents)[number]): string[] {
    if (Array.isArray(it.zoneIds) && it.zoneIds.length > 0) return it.zoneIds;
    if (it.zoneId) return [it.zoneId];
    return [];
  }

  const filtered = allIncidents.filter((it) => {
    if (it._createdMs < rangeThresholdMs) return false;
    if (Array.isArray(categoryCodes) && categoryCodes.length > 0 && categoryCodes.indexOf(it.categoryCode) === -1) return false;
    return true;
  });

  let unassignedCount = 0;
  const byZone = new Map<string, typeof filtered>();
  const uniqueIncidentIdsFiltered = new Set<string>();
  const filteredById = new Map<string, (typeof filtered)[number]>();
  filtered.forEach((it) => {
    if (it.incidentId) {
      uniqueIncidentIdsFiltered.add(it.incidentId);
      filteredById.set(it.incidentId, it);
    }
    const zoneIds = effectiveZoneIds(it);
    if (zoneIds.length === 0) {
      unassignedCount += 1;
      return;
    }
    zoneIds.forEach((zoneId) => {
      if (!byZone.has(zoneId)) byZone.set(zoneId, []);
      byZone.get(zoneId)!.push(it);
    });
  });

  // trend luôn tính ĐỘC LẬP với rangeDays/categoryCodes input, dùng TOÀN BỘ
  // hồ sơ của khu vực đó (allIncidents, không phải filtered).
  const allByZone = new Map<string, typeof allIncidents>();
  const allById = new Map<string, (typeof allIncidents)[number]>();
  allIncidents.forEach((it) => {
    if (it.incidentId) allById.set(it.incidentId, it);
    const zoneIds = effectiveZoneIds(it);
    zoneIds.forEach((zoneId) => {
      if (!allByZone.has(zoneId)) allByZone.set(zoneId, []);
      allByZone.get(zoneId)!.push(it);
    });
  });

  function computeTrendFromItems(items: typeof allIncidents): Record<string, number> {
    const trend: Record<string, number> = {};
    [7, 30, 90].forEach((d) => {
      const thresholdMs = nowMs - d * 24 * 3600 * 1000;
      trend['last_' + d + 'd'] = items.filter((it) => it._createdMs >= thresholdMs).length;
    });
    return trend;
  }

  const childrenMap = new Map<string, string[]>();
  (allCampusZones as unknown as ZoneRow[]).forEach((z) => {
    if (z.parentZoneId) {
      if (!childrenMap.has(z.parentZoneId)) childrenMap.set(z.parentZoneId, []);
      childrenMap.get(z.parentZoneId)!.push(z.zoneId);
    }
  });

  function rollupIds(zoneId: string, bucketMap: Map<string, { incidentId: string }[]>, memo: Map<string, Set<string>>): Set<string> {
    if (memo.has(zoneId)) return memo.get(zoneId)!;
    const ids = new Set<string>();
    (bucketMap.get(zoneId) || []).forEach((it) => {
      if (it.incidentId) ids.add(it.incidentId);
    });
    (childrenMap.get(zoneId) || []).forEach((childId) => {
      rollupIds(childId, bucketMap, memo).forEach((id) => ids.add(id));
    });
    memo.set(zoneId, ids);
    return ids;
  }

  function countDescendants(zoneId: string): number {
    const kids = childrenMap.get(zoneId) || [];
    let count = kids.length;
    kids.forEach((childId) => {
      count += countDescendants(childId);
    });
    return count;
  }

  const filteredMemo = new Map<string, Set<string>>();
  const allMemo = new Map<string, Set<string>>();

  const zoneIdsToConsider = new Set<string>([...byZone.keys(), ...allByZone.keys(), ...(allCampusZones as unknown as ZoneRow[]).map((z) => z.zoneId)]);

  const zones = Array.from(zoneIdsToConsider)
    .map((zoneId): ZoneStatsEntry | null => {
      const items = Array.from(rollupIds(zoneId, byZone, filteredMemo))
        .map((id) => filteredById.get(id))
        .filter((x): x is (typeof filtered)[number] => Boolean(x));
      const totalCount = items.length;
      if (totalCount === 0) return null;

      const severityFlag = items.some((it) => it.priority === catalog.PRIORITY.P0 || it.priority === catalog.PRIORITY.P1);
      const descendantCount = countDescendants(zoneId);

      if (totalCount < catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN) {
        return {
          zone_id: zoneId,
          total_count: totalCount > 0 ? '<5' : 0,
          breakdown_hidden: true,
          by_priority: null,
          by_category: null,
          trend: null,
          severity_flag: severityFlag,
          descendant_count: descendantCount
        };
      }

      const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
      const rawByCategory: Record<string, number> = {};
      items.forEach((it) => {
        const cur = byPriority[it.priority];
        if (cur !== undefined) byPriority[it.priority] = cur + 1;
        rawByCategory[it.categoryCode] = (rawByCategory[it.categoryCode] || 0) + 1;
      });

      const byCategory: Record<string, number> = {};
      let hiddenSum = 0;
      Object.entries(rawByCategory).forEach(([code, count]) => {
        if (count < catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN) {
          hiddenSum += count;
        } else {
          byCategory[code] = count;
        }
      });
      if (hiddenSum > 0) byCategory.khac_it_gap = hiddenSum;

      const allItems = Array.from(rollupIds(zoneId, allByZone, allMemo))
        .map((id) => allById.get(id))
        .filter((x): x is (typeof allIncidents)[number] => Boolean(x));

      return {
        zone_id: zoneId,
        total_count: totalCount,
        breakdown_hidden: false,
        by_priority: byPriority,
        by_category: byCategory,
        trend: computeTrendFromItems(allItems),
        severity_flag: severityFlag,
        descendant_count: descendantCount
      };
    })
    .filter((x): x is ZoneStatsEntry => Boolean(x));

  return {
    campus_id: campusId,
    range_days: effectiveRangeDays,
    category_filter: Array.isArray(categoryCodes) && categoryCodes.length > 0 ? categoryCodes : null,
    unassigned_count: unassignedCount,
    total_incidents_campus: uniqueIncidentIdsFiltered.size,
    zones
  };
}

/** listCampusZones — toàn bộ khu vực ACTIVE của 1 cơ sở, sắp theo `order` tăng dần. */
export async function listCampusZones(db: Db, params: { campusId?: string } = {}) {
  if (!params.campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
  const rows = await db
    .select()
    .from(campusZones)
    .where(and(eq(campusZones.campusId, params.campusId), eq(campusZones.active, true)));
  rows.sort((a, b) => (a.order || 0) - (b.order || 0));
  return rows;
}

/**
 * listAllCampusZones — TOÀN BỘ khu vực của 1 cơ sở kể cả đã tắt
 * (active=false), dùng riêng cho màn quản trị. Không lọc quyền ở đây, tầng
 * gọi tự kiểm 'catalog.edit' trước khi gọi hàm này.
 */
export async function listAllCampusZones(db: Db, params: { campusId?: string } = {}) {
  if (!params.campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
  const rows = await db.select().from(campusZones).where(eq(campusZones.campusId, params.campusId));
  rows.sort((a, b) => (a.order || 0) - (b.order || 0));
  return rows;
}

function isValidPolygon(polygon: unknown): polygon is PolygonPoint[] {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  return polygon.every((p) => p && typeof p.x === 'number' && typeof p.y === 'number' && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
}

export interface UpsertCampusZoneInput {
  zoneId: string;
  campusId: string;
  label: string;
  order?: number;
  mapImageKey?: string | null;
  polygonPercent: PolygonPoint[];
  shapeType?: string;
  rotationDeg?: number;
  categoryId?: string | null;
  color?: string | null;
  parentZoneId?: string | null;
  keywords?: string[];
  active?: boolean;
}

/**
 * upsertCampusZone — tạo/cập nhật 1 khu vực. Input camelCase, lưu Postgres
 * cùng convention camelCase Drizzle (cột thật là snake_case).
 */
export async function upsertCampusZone(db: Db, zoneData: Partial<UpsertCampusZoneInput>, opts?: { now?: Date }) {
  const now = opts?.now || new Date();
  const data = zoneData || {};
  if (!data.zoneId) throw new AppError('invalid_input', 'Thiếu zoneId.');
  if (!data.campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
  if (!data.label) throw new AppError('invalid_input', 'Thiếu label (tên khu vực).');
  if (!isValidPolygon(data.polygonPercent)) {
    throw new AppError('invalid_input', 'polygonPercent phải là mảng ít nhất 3 điểm {x,y} với x,y trong khoảng 0-100.');
  }

  // Khu vực CHA (tuỳ chọn) — validate CHẶT (cha-con sai sẽ làm hỏng vòng
  // lặp rollup).
  const parentZoneId = data.parentZoneId || null;
  if (parentZoneId) {
    if (parentZoneId === data.zoneId) {
      throw new AppError('invalid_input', 'Khu vực không thể là cha của chính nó.');
    }
    const allCampusZones = await listAllCampusZones(db, { campusId: data.campusId });
    const zoneByIdMap = new Map(allCampusZones.map((z) => [z.zoneId, z]));
    const parentZone = zoneByIdMap.get(parentZoneId);
    if (!parentZone) {
      throw new AppError('invalid_input', 'Khu vực cha không tồn tại trong cùng cơ sở.');
    }
    let cursor: string | null = parentZone.parentZoneId || null;
    let steps = 0;
    while (cursor) {
      if (cursor === data.zoneId) {
        throw new AppError('invalid_input', 'Không thể chọn khu vực cha — sẽ tạo thành vòng lặp cha-con.');
      }
      steps += 1;
      if (steps > allCampusZones.length) break;
      const next = zoneByIdMap.get(cursor);
      cursor = next ? next.parentZoneId || null : null;
    }
  }

  const doc = {
    zoneId: data.zoneId,
    campusId: data.campusId,
    label: data.label,
    order: typeof data.order === 'number' ? data.order : 0,
    mapImageKey: data.mapImageKey || null,
    polygonPercent: data.polygonPercent,
    shapeType: (VALID_SHAPE_TYPES as readonly string[]).includes(data.shapeType as string) ? (data.shapeType as string) : 'rect',
    rotationDeg: (((Number(data.rotationDeg) || 0) % 360) + 360) % 360,
    categoryId: data.categoryId || null,
    color: isValidHexColor(data.color) ? (data.color as string) : null,
    parentZoneId,
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    active: data.active !== undefined ? !!data.active : true,
    updatedAt: now
  };

  await db
    .insert(campusZones)
    .values({ ...doc, createdAt: now })
    .onConflictDoUpdate({ target: campusZones.zoneId, set: doc });

  return doc;
}

// ---------------------------------------------------------------------------
// Gợi ý ĐA khu vực từ nội dung mô tả tin báo — keyword-matching thuần, chỉ
// hỗ trợ hiển thị gợi ý cho người xử lý xác nhận thủ công.
// ---------------------------------------------------------------------------

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

export interface ZoneForSuggest {
  zone_id?: string;
  zoneId?: string;
  keywords?: string[];
}

/**
 * suggestZoneIdsFromContent — CHỈ LÀ GỢI Ý keyword-matching thuần, KHÔNG
 * hiểu ngữ cảnh, có thể match sai/thừa. KHÔNG BAO GIỜ được dùng để tự động
 * gán zone chính thức — chỉ hiển thị cho người xử lý xác nhận thủ công.
 */
export function suggestZoneIdsFromContent(content: string | null | undefined, zones: ZoneForSuggest[]): string[] {
  if (!content) return [];
  const normContent = normalizeForMatch(content);
  const matched: string[] = [];
  (zones || []).forEach((zone) => {
    const hit = (zone.keywords || []).some((kw) => normContent.includes(normalizeForMatch(kw)));
    if (hit) matched.push((zone.zoneId ?? zone.zone_id) as string);
  });
  return matched;
}

/** suggestZonesForReport — tiện ích gọi trực tiếp từ submitReport (khi safety.ts port tới). */
export async function suggestZonesForReport(db: Db, params: { campusId: string; content: string | null | undefined }): Promise<string[]> {
  const zones = await listCampusZones(db, { campusId: params.campusId });
  return suggestZoneIdsFromContent(params.content, zones);
}

// ---------------------------------------------------------------------------
// zone_categories — "nhóm khu vực" (tên + màu) DÙNG CHUNG cho cả 3 cơ sở.
// ---------------------------------------------------------------------------

export function isValidHexColor(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

/** listZoneCategories — toàn bộ nhóm ACTIVE, sắp theo `order` tăng dần. */
export async function listZoneCategories(db: Db) {
  const rows = await db.select().from(zoneCategories).where(eq(zoneCategories.active, true));
  rows.sort((a, b) => (a.order || 0) - (b.order || 0));
  return rows;
}

export interface UpsertZoneCategoryInput {
  categoryId: string;
  label: string;
  color: string;
  order?: number;
  active?: boolean;
}

/** upsertZoneCategory — tạo/cập nhật 1 nhóm khu vực. `categoryId` do client tự sinh (slug). */
export async function upsertZoneCategory(db: Db, categoryData: Partial<UpsertZoneCategoryInput>, opts?: { now?: Date }) {
  const now = opts?.now || new Date();
  const data = categoryData || {};
  if (!data.categoryId) throw new AppError('invalid_input', 'Thiếu categoryId.');
  if (!data.label) throw new AppError('invalid_input', 'Thiếu label (tên nhóm khu vực).');
  if (!isValidHexColor(data.color)) {
    throw new AppError('invalid_input', 'color phải là mã hex 6 ký tự, VD "#93C5FD".');
  }

  const doc = {
    categoryId: data.categoryId,
    label: data.label,
    color: data.color as string,
    order: typeof data.order === 'number' ? data.order : 0,
    active: data.active !== undefined ? !!data.active : true,
    updatedAt: now
  };

  await db
    .insert(zoneCategories)
    .values({ ...doc, createdAt: now })
    .onConflictDoUpdate({ target: zoneCategories.categoryId, set: doc });

  return doc;
}

/**
 * deleteZoneCategory — soft-delete (active:false). CHẶN xoá nếu còn khu
 * vực ACTIVE nào đang gán nhóm này.
 */
export async function deleteZoneCategory(db: Db, categoryId: string, opts?: { now?: Date }) {
  if (!categoryId) throw new AppError('invalid_input', 'Thiếu categoryId.');
  const inUse = await db
    .select()
    .from(campusZones)
    .where(and(eq(campusZones.categoryId, categoryId), eq(campusZones.active, true)));
  if (inUse.length > 0) {
    throw new AppError('category_in_use', 'Nhóm khu vực đang được ' + inUse.length + ' khu vực sử dụng, không thể xoá — đổi nhóm cho các khu vực đó trước.');
  }
  await db
    .update(zoneCategories)
    .set({ active: false, updatedAt: opts?.now || new Date() })
    .where(eq(zoneCategories.categoryId, categoryId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// campus_map_markers — icon đánh dấu TRANG TRÍ, ĐỘC LẬP với mọi khu vực.
// ---------------------------------------------------------------------------

/** listCampusMapMarkers — toàn bộ marker ACTIVE của 1 cơ sở. */
export async function listCampusMapMarkers(db: Db, params: { campusId: string }) {
  if (!params.campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
  return db
    .select()
    .from(campusMapMarkers)
    .where(and(eq(campusMapMarkers.campusId, params.campusId), eq(campusMapMarkers.active, true)));
}

export interface UpsertCampusMapMarkerInput {
  markerId: string;
  campusId: string;
  iconKey: string;
  xPercent: number;
  yPercent: number;
  color?: string | null;
  active?: boolean;
}

/** upsertCampusMapMarker — tạo/cập nhật 1 icon ghim trên bản đồ. `markerId` do client tự sinh (slug). */
export async function upsertCampusMapMarker(db: Db, markerData: Partial<UpsertCampusMapMarkerInput>, opts?: { now?: Date }) {
  const now = opts?.now || new Date();
  const data = markerData || {};
  if (!data.markerId) throw new AppError('invalid_input', 'Thiếu markerId.');
  if (!data.campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
  if (!(VALID_ZONE_ICON_KEYS as readonly string[]).includes(data.iconKey as string)) {
    throw new AppError('invalid_input', 'iconKey không hợp lệ.');
  }
  if (typeof data.xPercent !== 'number' || data.xPercent < 0 || data.xPercent > 100 || typeof data.yPercent !== 'number' || data.yPercent < 0 || data.yPercent > 100) {
    throw new AppError('invalid_input', 'xPercent/yPercent phải trong khoảng 0-100.');
  }

  const doc = {
    markerId: data.markerId,
    campusId: data.campusId,
    iconKey: data.iconKey as string,
    xPercent: data.xPercent,
    yPercent: data.yPercent,
    color: isValidHexColor(data.color) ? (data.color as string) : null,
    active: data.active !== undefined ? !!data.active : true,
    updatedAt: now
  };

  await db
    .insert(campusMapMarkers)
    .values({ ...doc, createdAt: now })
    .onConflictDoUpdate({ target: campusMapMarkers.markerId, set: doc });

  return doc;
}

/** deleteCampusMapMarker — hard-delete (icon trang trí, không ai tham chiếu tới). */
export async function deleteCampusMapMarker(db: Db, markerId: string) {
  if (!markerId) throw new AppError('invalid_input', 'Thiếu markerId.');
  await db.delete(campusMapMarkers).where(eq(campusMapMarkers.markerId, markerId));
  return { ok: true };
}
