param([string]$ProjectId="thcs-giangvo")
$ErrorActionPreference="Stop"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com classroom.googleapis.com meet.googleapis.com workspaceevents.googleapis.com admin.googleapis.com cloudscheduler.googleapis.com --project $ProjectId
