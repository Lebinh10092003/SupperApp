param([string]$ProjectId="thcs-giangvo")
$ErrorActionPreference="Stop"
foreach($n in @("si-runtime","si-workspace-dwd","si-pubsub-push")){ gcloud iam service-accounts describe "$n@$ProjectId.iam.gserviceaccount.com" --project $ProjectId *> $null; if($LASTEXITCODE -ne 0){ gcloud iam service-accounts create $n --project $ProjectId } }
foreach($s in @("si-classroom-oauth-client-id","si-classroom-oauth-client-secret","si-classroom-oauth-refresh-token")){ gcloud secrets describe $s --project $ProjectId *> $null; if($LASTEXITCODE -ne 0){ gcloud secrets create $s --replication-policy=automatic --project $ProjectId } }
gcloud iam service-accounts describe "si-workspace-dwd@$ProjectId.iam.gserviceaccount.com" --project $ProjectId --format="value(oauth2ClientId)"
