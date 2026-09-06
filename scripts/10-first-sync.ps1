param([string]$ProjectId="thcs-giangvo",[string]$Region="asia-southeast1")
gcloud run jobs execute si-full-sync --region $Region --project $ProjectId --wait
