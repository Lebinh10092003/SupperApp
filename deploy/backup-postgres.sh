#!/usr/bin/env bash
# Backup hằng ngày cho Postgres production — 1 trường/deployment, 1
# database duy nhất (xem DECISIONS.md, single-tenant per deployment).
#
# Cách dùng:
#   1. Copy file này lên VPS, chmod +x, sửa 3 biến DB_NAME/DB_USER/BACKUP_DIR
#      bên dưới cho khớp thật (đọc từ DATABASE_URL trong apps/api/.env).
#   2. Thêm vào crontab (`crontab -e`), chạy mỗi ngày lúc 2 giờ sáng:
#        0 2 * * * /path/to/backup-postgres.sh >> /var/log/superapp-backup.log 2>&1
#   3. QUAN TRỌNG: BACKUP_DIR ở đây chỉ là nơi lưu TẠM trên chính VPS — vẫn
#      cần tự đẩy thư mục này ra ngoài VPS (rsync sang server khác, hoặc
#      đồng bộ lên object storage) để không mất dữ liệu nếu VPS chính
#      hỏng/mất. Việc đẩy-ra-ngoài KHÔNG nằm trong script này, tự thêm
#      theo nơi bạn chọn lưu trữ ngoài.
#
# Đây là điểm bắt đầu, KHÔNG phải giải pháp backup hoàn chỉnh — trước khi
# tin tưởng, PHẢI thử khôi phục ít nhất 1 lần từ 1 file .sql.gz thật (xem
# DEPLOYMENT_CHECKLIST.md mục 9 "Backup thử").

set -euo pipefail

DB_NAME="superapp_production"   # đổi khớp DATABASE_URL thật
DB_USER="superapp_app"          # đổi khớp DATABASE_URL thật — KHÔNG dùng
                                 # superuser postgres cho backup định kỳ
BACKUP_DIR="/var/backups/superapp-postgres"
RETENTION_DAYS=14               # xoá backup cũ hơn N ngày, tránh đầy đĩa

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$OUT_FILE"

echo "[$(date -Iseconds)] Backup OK: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Dọn backup cũ quá RETENTION_DAYS ngày.
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

# Gợi ý khôi phục thử (chạy tay, KHÔNG tự động trong script này):
#   gunzip -c "$OUT_FILE" | psql -U "$DB_USER" -h localhost -d ten_db_test_khoi_phuc
