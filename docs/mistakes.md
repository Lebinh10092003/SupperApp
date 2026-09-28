# Nhật ký lỗi do Claude tự gây ra (SupperApp)

Chỉ ghi lỗi do chính Claude gây ra trong quá trình làm việc — không phải bug
có sẵn trong code trước đó. Mỗi mục: ngày, lỗi gì, nguyên nhân gốc, cách sửa,
cách phòng tránh lần sau.

## 2026-09-17 — Build frontend local rồi rsync dist/ làm sập đăng nhập production

**Lỗi:** Khi deploy tính năng `SafetyUsersSection.tsx` (gán vai trò cho
tài khoản chưa từng đăng nhập), tôi chạy `npm run build` cho `apps/web`
TRÊN MÁY LOCAL của mình rồi chỉ rsync thư mục `dist/` lên VPS
(`/var/www/html`) — không rebuild trên VPS.

**Nguyên nhân gốc:** Vite bake `VITE_*` env var vào bundle JS tại lúc BUILD,
không đọc lại lúc chạy. Máy local có `apps/web/.env` với
`VITE_API_BASE_URL=http://localhost:8080` (giá trị dev), trong khi
`.env` đúng trên VPS để trống (`VITE_API_BASE_URL=`) để dùng đường dẫn
tương đối qua nginx same-origin. Build local đã bake nhầm giá trị dev vào
bundle production.

**Hậu quả:** MỌI người dùng (không riêng ai) không đăng nhập được —
mọi fetch tới `/api/session/bootstrap` từ trình duyệt người dùng bị gửi
thẳng tới `http://localhost:8080` trên MÁY của chính họ, luôn fail với lỗi
CORS/kết nối. Sin (chủ dự án) tự phát hiện qua thao tác thật, không phải
tôi tự phát hiện.

**Cách sửa:** Build lại `apps/web` TRỰC TIẾP TRÊN VPS (dùng đúng `.env`
production), sau đó mới rsync `dist/` sang `/var/www/html`. Xác minh bằng
bằng chứng thật: `curl` tải bundle mới từ domain sống, grep xác nhận gọi
API qua đường dẫn tương đối (không còn `localhost:8080` trong luồng
`session/bootstrap`); `curl -X POST .../api/session/bootstrap` trả `401`
(chạm được backend thật) thay vì lỗi kết nối. Sin xác nhận đăng nhập lại
được qua trình duyệt thật.

**Phòng tránh lần sau:** KHÔNG BAO GIỜ build `apps/web` trên máy local rồi
deploy dist/ lên VPS — luôn build trực tiếp trên VPS (nơi có `.env` đúng),
hoặc nếu build local là bắt buộc thì phải copy đúng `.env` của VPS sang
trước khi build. Sau mỗi lần deploy frontend, luôn `curl` bundle mới từ
domain sống và grep tìm `localhost` trước khi báo "xong".

## 2026-09-22 — LẶP LẠI Y HỆT lỗi 2026-09-17: build frontend local rồi rsync dist/, không đọc `mistakes.md` trước

**Lỗi:** Khi deploy tính năng "Tiếp nhận xử lý hồ sơ" (acknowledge/thêm
người xử lý), tôi lại chạy `npm run build` cho `apps/web` TRÊN MÁY LOCAL,
rsync thẳng `dist/` (build local) sang `/var/www/html` trên VPS — ĐÚNG lỗi
đã ghi ở mục 2026-09-17 ngay phía trên, chỉ cách nhau 5 ngày.

**Nguyên nhân gốc:** Không đọc lại `docs/mistakes.md` trước khi làm bước
deploy frontend (đúng nguyên tắc bắt buộc "trước khi làm việc không nhỏ,
đọc mistake.md" — có ghi ở CLAUDE.md dự án khác nhưng chưa được tôi áp
dụng nhất quán ở SupperApp). Nếu đã đọc, mục ngay phía trên đã cảnh báo
chính xác kịch bản này.

**Hậu quả:** Y hệt lần trước — mọi người dùng không đăng nhập được, fetch
`/api/session/*` bị bake cứng sang `http://localhost:8080` (giá trị dev
trong `.env` local), lỗi CORS/kết nối trên trình duyệt người dùng thật. Sin
tự phát hiện qua thao tác thật (ảnh chụp DevTools), không phải tôi tự bắt
được trước khi báo "xong".

**Cách sửa:** Giống hệt quy trình đã ghi ở mục trên — rsync đúng các file
`.tsx`/`.ts` đã sửa sang `/opt/supperapp/apps/web/src/...` trên VPS, build
LẠI trên VPS (dùng đúng `.env` production), deploy `dist/` mới, xoá bundle
cũ, xác minh bằng `curl` thật + grep `localhost:8080` trong luồng
`api/session` (0 kết quả) + `curl -X POST .../api/session/bootstrap` trả
`401` thay vì lỗi kết nối.

**Phòng tránh lần sau (bổ sung, vì lời nhắc suông đã KHÔNG đủ hiệu lực):**
- BẮT BUỘC đọc `docs/mistakes.md` ngay trước bước "build + deploy frontend"
  của MỌI lần deploy, không chỉ khi bắt đầu phiên làm việc.
- Coi quy trình deploy frontend là CỐ ĐỊNH, không tự ý rút gọn: (1) rsync
  source đã sửa lên VPS, (2) build TRÊN VPS, (3) deploy dist/, (4) verify
  bằng curl+grep — KHÔNG BAO GIỜ chạy `npm run build` cho `apps/web` trên
  máy local với mục đích deploy lên VPS, kể cả khi chỉ để "kiểm tra nhanh
  bundle có lỗi không" trước — dùng `tsc --noEmit` cho việc đó thay vì
  `vite build`.

## 2026-09-22 — Báo sai "tin báo không áp C1-C4" vì đọc route dở dang

**Lỗi:** Khi Sin hỏi "ai xem được tin báo, ai tạo được hồ sơ", tôi đọc
`GET /reports/pending` (safety-query.routes.ts) nhưng DỪNG LẠI ở đoạn khởi
tạo `redacted: false` (giá trị mặc định trước khi tính) rồi kết luận ngay
"route này không áp mức bí mật C1-C4, ai có vai trò gì cũng xem nguyên văn
tin báo nhạy cảm" — báo cho Sin như một lỗ hổng thật, kèm cả AskUserQuestion
đề xuất "sửa" nó.

**Nguyên nhân gốc:** Không đọc hết toàn bộ route trước khi kết luận. Đoạn
code ngay phía sau (so `confidentialityRank(report.confidentiality) >
confidentialityRank(actorCeiling(actor))`, xoá content/className và set
`redacted: true` nếu vượt trần) đã xử lý ĐÚNG y hệt tinh thần hồ sơ sự cố —
tôi chỉ chưa đọc tới đó.

**Hậu quả:** Báo sai một "lỗ hổng bảo mật" không có thật cho Sin, khiến Sin
phải trả lời cả 1 câu hỏi xác nhận dựa trên thông tin sai. May mà tự phát
hiện lại được TRƯỚC khi bắt tay sửa (đọc lại toàn bộ route trước khi code),
không phải Sin phát hiện giúp.

**Phòng tránh lần sau:** Khi audit quyền/bảo mật của MỘT route, PHẢI đọc
trọn vẹn route đó từ đầu tới cuối (kể cả các đoạn xử lý sau khi khởi tạo
giá trị mặc định) trước khi kết luận "có/không áp dụng kiểm tra X" — giá
trị khởi tạo (default) không phải giá trị cuối cùng trả về client. Không
kết luận về hành vi bảo mật của 1 hàm chỉ từ 40-50 dòng đầu khi hàm dài
hơn thế.

## 2026-09-26 — Deploy thẳng lên production 2 bản vá thanh tab mobile chưa tự kiểm chứng, 1 bản làm crash trắng toàn app

**Lỗi:** Sin báo "bấm thanh điều hướng cái nào cũng đẩy về mục sự cố" (bug
thật: `onClick` trên `IonTabButton` không chạy khi đứng ngoài `<IonTabs>`).
Tôi sửa bằng cách bọc mỗi nút trong `<div style="display:contents"
onClick>` — build pass, deploy thẳng lên VPS mà KHÔNG tự bấm thử trên
trình duyệt trước. Bản vá này làm thanh tab BIẾN MẤT hoàn toàn (phá slot
Shadow DOM của `ion-tab-bar`, slot chỉ nhận con trực tiếp). Sửa lần 2 bằng
`ref` trên `<IonTabBar>` để tự `querySelectorAll` — lại build pass, LẠI
deploy thẳng lên production không tự kiểm chứng — lần này `ref.current` là
React class instance (không phải DOM node) nên `querySelectorAll` ném
`TypeError`, crash trắng TOÀN BỘ app trên mọi trang mobile (không chỉ thanh
tab) vì lỗi xảy ra trong `useEffect` của component mount ở mọi route mobile.

**Nguyên nhân gốc:** Coi "build không lỗi TypeScript" là đủ điều kiện để
deploy lên production — trong khi bug gốc là runtime/DOM-behavior (Ionic
web component chỉ hoạt động đúng bên trong context riêng của nó), loại lỗi
`tsc`/`vite build` không thể bắt được. Không có bước tự bấm thử trước khi
đẩy lên VPS thật, dù đã có sẵn công cụ trình duyệt (`claude-in-chrome`) để
làm việc đó.

**Hậu quả:** Sin phải chịu 1 khoảng thời gian app mobile bị trắng màn hình
hoàn toàn trên production. Tự phát hiện qua console error (không phải Sin
báo) và rollback khẩn cấp về bản trước đó trong vài phút, sau đó mới tìm
đúng nguyên nhân gốc (Ionic tab component không dùng được ngoài IonTabs) và
sửa dứt điểm bằng cách bỏ hẳn `IonTabBar`/`IonTabButton`, tự dựng thanh tab
bằng `<button>` HTML thường — verify lại bằng cách tự bấm cả 4 tab qua
`claude-in-chrome` trên chính production URL, xác nhận điều hướng đúng
trước khi báo đã xong.

**Phòng tránh lần sau:** Với MỌI thay đổi liên quan hành vi runtime/UI
tương tác (click, điều hướng, component bên thứ ba như Ionic/MUI dùng theo
cách không chuẩn), "build không lỗi" KHÔNG đủ để deploy lên production —
BẮT BUỘC tự kiểm chứng bằng trình duyệt thật (`claude-in-chrome`: click
thật + đọc console error) trước khi rsync dist lên VPS, không chỉ sau khi
Sin báo lỗi. Ưu tiên nếu có thể: kiểm chứng trên 1 bản preview/local trước
khi chạm production, đặc biệt khi đang thử nghiệm cách né 1 hành vi lạ của
thư viện bên thứ ba (dấu hiệu cần thận trọng hơn, không phải sửa 1 dòng
quen thuộc).

## 2026-09-27 — Chạy `npm test` trên VPS production, một test xoá sạch bảng `incidents` thật

**Lỗi:** Sau khi sửa `authz.ts` (thu hẹp quyền xem danh sách sự vụ) và
rsync các file `apps/api` đã đổi lên VPS, tôi chạy `npm run typecheck` VÀ
`npm test` NGAY TRÊN VPS (2 lần — 1 lần bị treo lâu do thật sự chờ kết nối
mạng ClamAV, tôi kill rồi chạy lại) như một bước "tự kiểm chứng trước khi
restart service", theo đúng tinh thần các mục lỗi phía trên (không chỉ tin
"build không lỗi"). Nhưng lại không hề nghĩ tới việc TEST SUITE CŨNG CÓ THỂ
GHI/XOÁ DỮ LIỆU THẬT nếu chạy nhắm đúng DB production.

**Nguyên nhân gốc:** `campus-comparison-stats.test.ts::resetTables()` gọi
thẳng `db.delete(incidents).where(inArray(incidents.campusId, CAMPUS_IDS))`
với `CAMPUS_IDS` là 3 mã cơ sở THẬT (`MAIN_CAMPUS`/`CAMPUS_1`/`CAMPUS_2`),
không có cờ bảo vệ nào (không kiểm tra `NODE_ENV`, không kiểm tra tên DB,
không dùng transaction rollback riêng cho test). VPS chỉ có DUY NHẤT 1
`DATABASE_URL` cấu hình trong `.env` (EnvironmentFile của
`supperapp-api.service`) — chính là DB production thật (tên DB
`supperapp`), không có DB test riêng như máy dev local (`superapp_test`).
`npm test` chạy `scripts/run-tests.mjs`, tự dò VÀ CHẠY HẾT mọi
`*.test.ts` trong `src/`, không có bước hỏi lại/xác nhận nào trước khi
đụng DB — nên lệnh tưởng như vô hại ("chỉ là chạy test để kiểm chứng") lại
âm thầm xoá sạch bảng `incidents` thật (18 hồ sơ sự vụ thật, gồm cả 2 vụ
Sin đang xem trực tiếp hôm đó: vụ nghi xâm hại và vụ bắt nạt lớp 6A6),
đồng thời chèn thêm dữ liệu rác từ các file test khác cũng chạy chung đợt
(`SC.TEST.*`, `SC.TA.TEST.*`, `SC.OLD.*`).

**Hậu quả:** Toàn bộ hồ sơ sự vụ thật (bảng `incidents`) trên production bị
xoá — may mắn bảng `reports` (tin báo gốc) và các bảng liên quan
(`sla_clocks`, `audit_logs`...) vẫn giữ nguyên `reportId`/`incidentId` nên
dò lại được chính xác 5 hồ sơ (trong số ít nhất 18 hồ sơ từng có — số còn
lại có thể chưa từng có `incidents` row thật do lỗi khác từ trước, chưa
xác minh hết) đã bị mất qua log/comment tôi tự viết trước đó trong session
("Sin: có vụ đánh nhau của lớp này thì cả trường biết hết"). Tự phát hiện
KHÔNG PHẢI qua báo lỗi của Sin, mà tình cờ khi Sin nhờ chuẩn bị dữ liệu để
tự test tay chức năng mới — lúc đó tôi query DB để lấy dữ liệu test thật
thì phát hiện bảng `incidents` gần như trống, đối chiếu lại mới lần ra
nguyên nhân.

**Cách sửa:**
1. Tìm thấy hệ thống có sẵn backup Postgres tự động hàng đêm
   (`/opt/supperapp-db-backups/`, cron `0 2 * * *`) — bản backup 2026-09-27
   02:00 (TRƯỚC lúc tôi chạy test) còn nguyên 5 dòng `incidents` thật khớp
   với dữ liệu Sin đã xem trực tiếp (`SC.2609.0004/0006/0016/0017/0018`).
2. Trích riêng 5 dòng đó từ file backup (`.sql.gz`), viết script Node dùng
   thẳng `db.insert(incidents)` của chính app (không dùng `psql` — VPS
   không cài) để CHÈN LẠI đúng 5 dòng này — KHÔNG restore toàn bộ DB (tránh
   ghi đè các thay đổi hợp lệ khác phát sinh sau 2h sáng).
3. Xin xác nhận của Sin trước khi ghi bất kỳ gì vào DB production (đúng
   nguyên tắc — dù Sin sau đó nói dữ liệu hiện tại toàn là dữ liệu giả nên
   cho phép sửa thoải mái, TRỪ tài khoản quản trị).
4. Xoá 12 dòng rác (`SC.TEST.*`/`SC.TA.TEST.*`/`SC.OLD.*`) để lại từ các
   lần chạy test trước đó (không riêng lần này) — verify lại bảng
   `incidents` chỉ còn đúng 5 dòng thật.
5. Thêm chốt chặn CỨNG vào `scripts/run-tests.mjs` (điểm vào DUY NHẤT của
   `npm test`) — từ chối chạy BẤT KỲ file test nào nếu tên database trong
   `DATABASE_URL` không chứa chữ "test", in rõ lý do và dừng ngay
   (`process.exit(1)`) trước khi tới bước tìm/chạy file test. Verify bằng
   cách tự set `DATABASE_URL` giả dạng production (`.../supperapp`, không
   có "test") — xác nhận bị chặn đúng như thiết kế; sau đó chạy lại
   `npm test` bình thường ở máy local (DB tên `superapp_test`) — xác nhận
   không bị chặn nhầm, kết quả pass/fail giống hệt trước khi thêm guard.

**Phòng tránh lần sau:** KHÔNG BAO GIỜ chạy `npm test` (hay bất kỳ lệnh nào
gọi tới test suite) trên một máy/VPS mà không tự xác nhận trước
`DATABASE_URL` ở đó trỏ tới DB test riêng, tách biệt hoàn toàn khỏi DB
production — "test" trong tên lệnh không có nghĩa "an toàn tuyệt đối,
không cần nghĩ tới") ngay cả khi mục đích chỉ là "kiểm chứng thêm cho chắc"
trước khi restart service. Quy tắc chung rút ra: MỌI lệnh có khả năng
ghi/xoá dữ liệu (test suite, seed script, migration, script dọn dẹp) đều
phải được coi ngang hàng với thao tác ghi dữ liệu thật khi chạy trên môi
trường có kết nối tới DB thật — không được miễn trừ chỉ vì nó nằm trong
thư mục `test/` hay có chữ "test" trong tên lệnh gọi nó.
