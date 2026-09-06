param([string]$ProjectId="thcs-giangvo",[string]$Region="asia-southeast1")
$sa="si-runtime@$ProjectId.iam.gserviceaccount.com"
$uri="https://run.googleapis.com/v2/projects/$ProjectId/locations/$Region/jobs/si-full-sync`:run"
gcloud scheduler jobs create http si-nightly-full-sync --location $Region --project $ProjectId --schedule "30 2 * * *" --uri $uri --http-method POST --oauth-service-account-email $sa --time-zone "Asia/Ho_Chi_Minh" 2>$null
