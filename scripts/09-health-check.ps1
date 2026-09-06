param([string]$ProjectId="thcs-giangvo",[string]$Region="asia-southeast1")
$url=gcloud run services describe si-api --region $Region --project $ProjectId --format="value(status.url)"
Invoke-RestMethod -Uri "$url/health" | ConvertTo-Json -Depth 5
