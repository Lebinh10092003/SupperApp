param([string]$ProjectId="thcs-giangvo")
$ErrorActionPreference="Stop"
node --version
npm --version
firebase --version
gcloud --version | Select-Object -First 1
Write-Host "Target: $ProjectId"
