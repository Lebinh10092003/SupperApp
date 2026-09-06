# Deploy Windows PowerShell

## 1. Chuẩn bị

```powershell
firebase login
gcloud auth login
gcloud config set project thcs-giangvo
.\scripts\00-check-prerequisites.ps1
```

## 2. Hạ tầng

```powershell
.\scripts\01-enable-apis.ps1
.\scripts\02-create-service-accounts.ps1
.\scripts\03-configure-iam.ps1
.\scripts\04-create-pubsub.ps1
```

Cấp DWD cho Client ID của `si-workspace-dwd` theo `docs/DWD_SCOPES.md`.

## 3. API

```powershell
.\scripts\05-deploy-api.ps1 `
  -WorkspaceDomain "example.edu.vn" `
  -AdminSubject "admin@example.edu.vn" `
  -BootstrapAdminEmails "admin@example.edu.vn" `
  -TeacherOuPrefixes "/GiaoVien,/Teachers" `
  -StudentOuPrefixes "/HocSinh,/Students"
```

## 4. Classroom OAuth

Tạo OAuth Web Client callback:

`https://<CLOUD_RUN_URL>/oauth/classroom/callback`

Ghi client ID/secret vào Secret Manager. SYSTEM_ADMIN mở trang Quản trị → Kết nối Classroom Push.

## 5. Pub/Sub, Jobs, Scheduler

```powershell
.\scripts\04b-create-push-subscriptions.ps1
.\scripts\06-deploy-jobs.ps1
.\scripts\07-create-scheduler.ps1
```

## 6. Frontend

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
notepad apps\web\.env.local
.\scripts\08-deploy-web.ps1
.\scripts\09-health-check.ps1
.\scripts\10-first-sync.ps1
```

## Shared Firestore
Không deploy rules/indexes trực tiếp từ repo này. Merge fragment trong `firestore/` vào cấu hình master.
