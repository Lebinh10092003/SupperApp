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
