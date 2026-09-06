# Firestore Data Model — School Classroom Intelligence

Không gian dữ liệu phân định theo từng trường (multi-tenant):
`siSchools/{schoolId}`

```text
siSchools/{schoolId}
├── dashboard/current                    # Snapshot KPI hiện tại toàn trường
├── users/{uid}                          # Hồ sơ người dùng, phân quyền RBAC & phạm vi truy cập (UserScope)
├── googleConnections/{connectionId}     # Quản lý kết nối Google (Chế độ A: OAuth, Chế độ B: DWD)
├── classes/{classId}                    # Lớp học hành chính chuẩn (6A1, 6A2, 7A1...)
├── subjectMappings/{mappingId}          # Ánh xạ Classroom -> Môn học chuẩn (Toán, Ngữ văn, KHTN...)
├── classMappings/{mappingId}            # Ánh xạ Classroom -> Lớp hành chính chuẩn
├── schoolYears/{yearId}                 # Danh mục năm học chuẩn (2025-2026...)
├── semesters/{semesterId}               # Danh mục học kỳ (HK1, HK2)
├── people/{personId}                    # Hồ sơ giáo viên, học sinh đồng bộ từ Workspace/Classroom
├── courses/{courseId}                   # Google Classroom Courses
│   ├── members/{userId}                 # Giáo viên, Học sinh trong lớp (Teachers & Students)
│   ├── coursework/{workId}              # Bài tập, câu hỏi, bài kiểm tra (CourseWork)
│   ├── submissions/{submissionId}       # Bài nộp học sinh (StudentSubmissions)
│   ├── materials/{materialId}           # Tài liệu học tập (CourseWork Materials)
│   ├── announcements/{announcementId}   # Thông báo của lớp (Announcements)
│   └── topics/{topicId}                 # Chủ đề bài học (Topics)
├── schedules/{scheduleId}               # Thời khóa biểu
├── liveSessions/{conferenceId}          # Phiên Google Meet trực tiếp
├── meetSessions/{conferenceId}          # Nhật ký phiên Google Meet
│   └── attendance/{userId}              # Chuyên cần tự động học sinh
├── metricsDaily/{yyyy-MM-dd}            # Snapshot dữ liệu theo ngày
├── studentAnalytics/{studentId}         # Hồ sơ Student 360 & Health Score tính toán
├── courseAnalytics/{courseId}           # Phân tích theo Classroom
├── subjectAnalytics/{subjectId}         # Phân tích chuyên sâu theo bộ môn
├── teacherAnalytics/{teacherId}         # Phân tích hiệu suất & khối lượng giáo viên
├── alertRules/{ruleId}                  # Quy tắc cảnh báo động cho Hiệu trưởng
├── alerts/{alertId}                     # Các cảnh báo phát hiện kèm bằng chứng (Evidence)
├── systemAuditLogs/{logId}              # Nhật ký kiểm toán bảo mật ứng dụng
├── auditEvents/{eventId}                # Nhật ký kiểm toán từ Admin SDK Reports API
├── syncJobs/{jobId}                     # Lịch sử và trạng thái các tiến trình đồng bộ
└── subscriptions/{subscriptionId}       # Google Pub/Sub Webhook subscriptions
```

## Nguyên tắc lưu trữ & bảo vệ dữ liệu:
1. **Phân tách dữ liệu nguồn & phân tích**: Dữ liệu Google gốc (`courses`, `coursework`, `submissions`) và dữ liệu phân tích (`studentAnalytics`, `metricsDaily`, `alerts`) được lưu ở các collection riêng biệt. Không bao giờ ghi đè dữ liệu thô bằng dữ liệu tổng hợp.
2. **Khóa quyền ghi trực tiếp từ Client**: Tất cả các cập nhật role, mapping, rules, sync và connection đều phải thông qua Cloud Run Backend Service API. Client chỉ có quyền đọc dựa trên RBAC đã xác thực.
3. **Trạng thái dữ liệu chuẩn mực**: `COMPLETE | LIMITED_ACCESS | PARTIAL | STALE | ERROR`.
