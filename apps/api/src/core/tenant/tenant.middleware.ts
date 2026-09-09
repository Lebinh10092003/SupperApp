import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../http.js';
import { getTenantById, type Tenant } from './tenant.registry.js';
import { withTenantDb } from '../db/client.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: Tenant;
      /** Chạy query trong đúng schema của tenant hiện tại — xem `withTenantDb`. */
      withTenantDb?: <T>(fn: Parameters<typeof withTenantDb>[1]) => Promise<T>;
    }
  }
}

/**
 * Middleware xác định tenant (trường) cho request hiện tại.
 *
 * TẠM THỜI đọc từ header `X-School-Id` — CHƯA quyết định cơ chế cuối cùng
 * (subdomain riêng mỗi trường? claim trong JWT sau khi đăng nhập? param
 * route?). Header là cách rẻ nhất để bắt đầu code module trong lúc chờ
 * quyết định, đổi similar 1 chỗ duy nhất này khi có hướng cuối cùng — module
 * nghiệp vụ không nên tự đọc header/tenant theo cách riêng.
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    const schoolId = req.header('X-School-Id');
    if (!schoolId) {
      throw new HttpError(400, 'Thiếu header X-School-Id.', 'TENANT_MISSING');
    }
    const tenant = await getTenantById(schoolId);
    if (!tenant || !tenant.isActive) {
      throw new HttpError(404, `Không tìm thấy trường "${schoolId}" hoặc trường đã ngừng hoạt động.`, 'TENANT_NOT_FOUND');
    }
    req.tenant = tenant;
    req.withTenantDb = function boundWithTenantDb<T>(fn: Parameters<typeof withTenantDb>[1]): Promise<T> {
      return withTenantDb(tenant.schemaName, fn) as Promise<T>;
    };
    next();
  } catch (error) {
    next(error);
  }
}
