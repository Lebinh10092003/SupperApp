# Cấu trúc theo chức năng

```text
Dashboard
├─ Frontend: apps/web/src/features/dashboard/
└─ Backend:  apps/api/src/modules/dashboard/

Classroom
├─ Frontend: apps/web/src/features/classroom/
└─ Backend:  apps/api/src/modules/classroom/

Meet + Attendance
├─ Frontend: apps/web/src/features/meet/, attendance/, today/
└─ Backend:  apps/api/src/modules/meet/, attendance/

Schedules
├─ Frontend: apps/web/src/features/schedules/
└─ Backend:  apps/api/src/modules/schedules/
```

Quy tắc: UI chức năng ở `features/<feature>`, business logic ở `modules/<feature>`, `server.ts` chỉ ghép route.
