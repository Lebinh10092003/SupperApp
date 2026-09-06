param([string]$ProjectId="thcs-giangvo")
$ErrorActionPreference="Stop"

if (-not (Test-Path apps/web/.env.local) -and -not (Test-Path apps/web/.env)) {
  Write-Host "Chưa có apps/web/.env.local, tự động khởi tạo từ apps/web/.env.example..." -ForegroundColor Yellow
  Copy-Item apps/web/.env.example apps/web/.env.local
}

Write-Host "Đang build bản dựng web cho Firebase Hosting..." -ForegroundColor Cyan
npm --workspace apps/web run build

Write-Host "Đang deploy lên Firebase Hosting (Project: $ProjectId)..." -ForegroundColor Cyan
firebase deploy --only hosting --project $ProjectId

Write-Host "✅ Hoàn tất deploy Firebase Hosting!" -ForegroundColor Green
