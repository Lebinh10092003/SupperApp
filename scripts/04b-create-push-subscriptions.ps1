param([string]$ProjectId="thcs-giangvo",[string]$Region="asia-southeast1")
$ErrorActionPreference="Stop"
$url=gcloud run services describe si-api --region $Region --project $ProjectId --format="value(status.url)"
$sa="si-pubsub-push@$ProjectId.iam.gserviceaccount.com"
gcloud pubsub subscriptions create si-meet-push --topic=si-meet-events --push-endpoint="$url/events/meet" --push-auth-service-account=$sa --push-auth-token-audience=$url --project $ProjectId 2>$null
gcloud pubsub subscriptions create si-classroom-push --topic=si-classroom-events --push-endpoint="$url/events/classroom" --push-auth-service-account=$sa --push-auth-token-audience=$url --project $ProjectId 2>$null
