# Postgres — single-tenant per deployment

Xem đầy đủ bối cảnh/lý do ở
`/Users/macbook/Projects/SUPERAPP_MIGRATION_COORDINATION/DECISIONS.md`
(mục "ĐẢO NGƯỢC" 2026-09-09). Tóm tắt:

- **Mỗi TRƯỜNG (pháp nhân, vd "THCS Giảng Võ") = 1 deployment + 1 database
  Postgres riêng hoàn toàn.** Các deployment của các trường khác nhau
  **không liên hệ/đồng bộ gì với nhau** — không có registry trung tâm.
- **Trường điểm chính + các phân hiệu (`MAIN_CAMPUS`/`CAMPUS_1`/`CAMPUS_2`)
  của CÙNG 1 trường vẫn dùng CHUNG 1 database này** — phân biệt bằng field
  `campus_id` trên từng bảng, giống hệt cách Firebase hiện tại đang làm.
  KHÔNG tách hạ tầng theo cơ sở/phân hiệu.
- Vì vậy **không có** tenant registry, không có middleware chọn
  schema/database theo request, không có `withTenantDb` — chỉ 1 pool kết
  nối duy nhất (`pool.ts`) và 1 Drizzle instance duy nhất (`client.ts`).

## Dùng trong module nghiệp vụ

```ts
import { db } from '../../core/db/client.js';

const rows = await db.select().from(incidents).where(eq(incidents.campusId, campusId));
```

Không tự `new Pool()` hay import `pg` trực tiếp ở module khác — luôn qua
`db` ở đây để chỉ có 1 nơi quản lý kết nối.

## Migration

```bash
cd apps/api
npx drizzle-kit generate   # sinh SQL migration từ mọi file *.schema.ts
npx drizzle-kit migrate    # áp migration lên DATABASE_URL
```

## Test khói

`pool.smoke.test.ts` — kết nối Postgres thật, chạy 1 query đơn giản, tự
`skip` nếu không có `DATABASE_URL` (để không phá CI của module chưa cần
Postgres).

**Lưu ý QUAN TRỌNG khi viết test đụng Postgres:** Node test runner chạy
NHIỀU FILE test SONG SONG theo mặc định (mỗi file 1 worker riêng), dù các
test TRONG CÙNG 1 file chạy tuần tự. Nếu 2 file test khác nhau dùng chung
1 ID cố định (VD `perId: 'PER.TRUCBAN'`) trên CÙNG 1 bảng Postgres, chúng
SẼ đụng nhau (lỗi trùng khoá, hoặc đọc nhầm dữ liệu của file kia) khi chạy
`node --test file1.test.ts file2.test.ts` cùng lúc — dù mỗi file test
riêng lẻ đều PASS khi chạy 1 mình. Đã gặp thật khi port `dispatch.ts` +
`push-notify.ts` (2 file cùng dùng `PER.TRUCBAN`/`PER.HIEUTRUONG`).
**Quy ước bắt buộc**: mọi ID dùng trong test (perId, objectId, token...)
phải có tiền tố RIÊNG theo tên file/module (VD `PER.DISPATCH_TRUCBAN`,
`NR.DISPATCH.001`) để không đụng bất kỳ file test nào khác trong tương
lai, kể cả file bạn chưa biết sẽ được viết sau.

**Lưu ý phát hiện được:** script `npm test` ở root (`src/**/*.test.ts`) có
vẻ KHÔNG luôn nhặt được file test nằm sâu 2 cấp thư mục tuỳ theo shell
đang chạy (glob `**` không có `globstar`) — nếu thêm test mới mà không
thấy chạy trong `npm test`, verify lại bằng:
```bash
node --import tsx --test $(find src -name "*.test.ts")
```
trước khi kết luận test bị lỗi.
