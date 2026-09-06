param([string]$ProjectId="thcs-giangvo",[string]$Region="asia-southeast1")
$ErrorActionPreference="Stop"
$svc=gcloud run services describe si-api --region $Region --project $ProjectId --format=json | ConvertFrom-Json
$image=$svc.spec.template.spec.containers[0].image
$envs=@();foreach($e in $svc.spec.template.spec.containers[0].env){if($e.name -and $null -ne $e.value){$envs += "$($e.name)=$($e.value)"}};$envString=$envs -join ','
gcloud run jobs deploy si-full-sync --image $image --region $Region --project $ProjectId --service-account "si-runtime@$ProjectId.iam.gserviceaccount.com" --command node --args dist/jobs/full-sync.js --set-env-vars $envString
gcloud run jobs deploy si-renew-subscriptions --image $image --region $Region --project $ProjectId --service-account "si-runtime@$ProjectId.iam.gserviceaccount.com" --command node --args dist/jobs/renew-subscriptions.js --set-env-vars $envString
