// pm2 ecosystem file — giữ apps/api sống, tự restart khi crash.
//
// Cách dùng (trên VPS, sau khi `cd apps/api && npm ci && npm run build`):
//   npm install -g pm2
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save            # ghi lại danh sách process để pm2 startup dùng
//   pm2 startup         # in ra lệnh cần chạy 1 lần để pm2 tự khởi động
//                        # cùng VPS sau khi reboot — LÀM ĐÚNG lệnh nó in
//                        # ra, không copy nguyên văn lệnh dưới đây.
//
// Xem log: `pm2 logs superapp-api`. Restart sau khi deploy code mới:
// `pm2 reload superapp-api` (reload không downtime, khác `restart`).
module.exports = {
  apps: [
    {
      name: 'superapp-api',
      cwd: __dirname + '/../apps/api',
      script: 'dist/server.js',
      instances: 1, // single-tenant, 1 trường — không cần cluster nhiều instance
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        // .env thật được `dotenv/config` tự đọc từ apps/api/.env lúc chạy
        // (xem dòng đầu server.ts) — KHÔNG cần khai lại biến ở đây, file
        // này chỉ điều khiển process, không phải nguồn cấu hình.
      }
    }
  ]
};
