param([string]$ProjectId="thcs-giangvo")
$ErrorActionPreference="Stop"
foreach($t in @("si-classroom-events","si-meet-events")){gcloud pubsub topics describe $t --project $ProjectId *> $null;if($LASTEXITCODE -ne 0){gcloud pubsub topics create $t --project $ProjectId}}
