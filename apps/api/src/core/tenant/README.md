# Nền tảng multi-tenant Postgres (schema-per-tenant)

Dùng chung cho mọi module viết lại từ Firebase trong Super App THCS Giảng Võ
(An toàn trường học, Lịch công tác, Classroom Intelligence). Mỗi trường
(tenant) có 1 schema Postgres riêng trong CÙNG 1 Postgres instance — không
phải kiểu "1 bảng dùng chung + cột schoolId". Lý do chọn: cách ly mạnh hơn,
lỡ quên filter theo tenant ở 1 chỗ nào đó thì query đơn giản KHÔNG THỂ chạm
được dữ liệu trường khác (khác schema hoàn toàn), thay vì chỉ dựa vào code
nhớ filter đúng.

## Thành phần

- `apps/api/src/core/db/pool.ts` — 1 pg `Pool` duy nhất dùng chung cho mọi
  schema (registry `public` lẫn mọi tenant). `withTenantSchema(schemaName, fn)`
  mượn 1 client, `SET search_path` đúng schema, chạy `fn`, rồi LUÔN reset lại
  `search_path` trước khi trả client về pool — bắt buộc, nếu bỏ bước reset
  connection tái sử dụng sẽ dính search_path cũ của tenant trước.
- `apps/api/src/core/db/client.ts` — `withTenantDb(schemaName, fn)`, bản bọc
  Drizzle của `withTenantSchema` — **đây là điểm vào DUY NHẤT** code nghiệp vụ
  nên dùng để query, đừng tự `new Pool()`/tự quản lý client ở module khác.
- `apps/api/src/core/tenant/tenant.schema.ts` — bảng registry `tenants` (schema
  `public`): map `id` (slug trường) ↔ `schema_name` (schema Postgres thật).
- `apps/api/src/core/tenant/tenant.registry.ts` — `provisionTenant()` (tạo
  trường mới: đăng ký registry + tạo schema thật), `getTenantById()`,
  `listTenants()`.
- `apps/api/src/core/tenant/tenant.middleware.ts` — middleware Express
  `resolveTenant`, gắn `req.tenant` + `req.withTenantDb(fn)` cho mỗi request.
  **TẠM THỜI** đọc tenant từ header `X-School-Id` — CHƯA chốt cơ chế cuối
  (subdomain riêng mỗi trường? claim JWT sau đăng nhập?). Đổi ở đúng 1 chỗ
  này khi có quyết định, module nghiệp vụ không tự đọc tenant theo cách riêng.

## Quy ước cho module mới (An toàn / Lịch công tác / Classroom Intelligence)

1. Mọi bảng nghiệp vụ của module nằm trong schema TENANT (không nằm `public`)
   — migration viết trong `apps/api/drizzle/tenant-template/`, áp dụng cho
   MỌI schema tenant khi provisioning (chưa có script tự động áp lại cho
   tenant đã tồn tại — TODO khi có tenant thật đầu tiên ngoài smoke test).
2. Trong route handler, dùng `req.withTenantDb(async (db) => { ... })` để
   query — KHÔNG import `publicDb` (chỉ dành cho bảng `tenants` ở registry).
3. Dữ liệu định danh dùng chung giữa nhiều module (accounts/assignments/
   people_directory/duty_shifts — hiện sống trong module An toàn ở Firebase
   cũ) sẽ có 1 bộ bảng "identity" dùng chung trong CHÍNH schema tenant (không
   phải bảng riêng từng module) — đang thiết kế, sẽ chia sẻ khi sẵn sàng,
   ĐỪNG tự port riêng để tránh 2 bản identity lệch nhau giữa các module.
4. ORM: **Drizzle** (`drizzle-orm` + `drizzle-kit`), KHÔNG dùng Knex/Prisma —
   lý do chọn Drizzle: Prisma generate client cố định 1 schema, khó áp dụng
   cho schema-per-tenant động lúc runtime; Drizzle định nghĩa bảng bằng TS
   thuần, truyền `db` (đã set search_path đúng tenant) vào query tự nhiên.

## Test khói (bằng chứng thật, không chỉ code chạy được)

`apps/api/src/core/tenant/tenant.smoke.test.ts` — tạo 2 tenant thật, ghi dữ
liệu vào tenant A, xác nhận tenant B không thấy được (kể cả dùng chung 1
connection pool), rồi dọn dẹp. Test tự `skip` nếu không có `DATABASE_URL`
trỏ tới Postgres thật đang chạy (để không phá CI của các module khác chưa
cần Postgres).

```bash
export DATABASE_URL=postgres://postgres@localhost:5432/postgres
node --import tsx --test src/core/tenant/tenant.smoke.test.ts
```

## Chạy migration registry (`public.tenants`) lần đầu

```bash
cd apps/api
npx drizzle-kit generate --config drizzle.config.public.ts   # đã generate sẵn, chỉ cần khi đổi tenant.schema.ts
npx drizzle-kit migrate --config drizzle.config.public.ts
```
