param([string]$ProjectId="thcs-giangvo")
$ErrorActionPreference="Stop"
$runtime="si-runtime@$ProjectId.iam.gserviceaccount.com";$dwd="si-workspace-dwd@$ProjectId.iam.gserviceaccount.com"
foreach($role in @("roles/datastore.user","roles/secretmanager.secretAccessor","roles/secretmanager.secretVersionAdder","roles/logging.logWriter")){gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$runtime" --role=$role --quiet | Out-Null}
gcloud iam service-accounts add-iam-policy-binding $dwd --member="serviceAccount:$runtime" --role="roles/iam.serviceAccountTokenCreator" --project $ProjectId --quiet | Out-Null
