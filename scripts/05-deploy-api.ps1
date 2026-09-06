param([string]$ProjectId="thcs-giangvo",[string]$Region="asia-southeast1",[Parameter(Mandatory=$true)][string]$WorkspaceDomain,[Parameter(Mandatory=$true)][string]$AdminSubject,[string]$BootstrapAdminEmails=$AdminSubject,[string]$TeacherOuPrefixes="",[string]$StudentOuPrefixes="")
$ErrorActionPreference="Stop"
$runtime="si-runtime@$ProjectId.iam.gserviceaccount.com";$dwd="si-workspace-dwd@$ProjectId.iam.gserviceaccount.com"
gcloud run deploy si-api --source apps/api --region $Region --project $ProjectId --service-account $runtime --allow-unauthenticated --set-env-vars "PROJECT_ID=$ProjectId,REGION=$Region,SCHOOL_ID=giang-vo,SCHOOL_NAME=Trường THCS Giảng Võ,WORKSPACE_DOMAIN=$WorkspaceDomain,WORKSPACE_ADMIN_SUBJECT=$AdminSubject,DWD_SERVICE_ACCOUNT_EMAIL=$dwd,BOOTSTRAP_ADMIN_EMAILS=$BootstrapAdminEmails,TEACHER_OU_PREFIXES=$TeacherOuPrefixes,STUDENT_OU_PREFIXES=$StudentOuPrefixes,CLASSROOM_TOPIC=projects/$ProjectId/topics/si-classroom-events,MEET_TOPIC=projects/$ProjectId/topics/si-meet-events"
$url=gcloud run services describe si-api --region $Region --project $ProjectId --format="value(status.url)"
gcloud run services update si-api --region $Region --project $ProjectId --set-env-vars "API_BASE_URL=$url,PUBSUB_PUSH_AUDIENCE=$url,WEB_ORIGIN=https://$ProjectId.web.app,PUBSUB_PUSH_SERVICE_ACCOUNT=si-pubsub-push@$ProjectId.iam.gserviceaccount.com" | Out-Null
Write-Host $url
