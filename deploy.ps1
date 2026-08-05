param(
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Deploy AppDgriffeDois ===" -ForegroundColor Cyan

$accountId = $env:CLOUDFLARE_ACCOUNT_ID
$apiToken = $env:CLOUDFLARE_API_TOKEN

if (-not $accountId -or -not $apiToken) {
    Write-Host "ERRO: Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN como variaveis de ambiente." -ForegroundColor Red
    Write-Host "Exemplo:" -ForegroundColor Yellow
    Write-Host "  `$env:CLOUDFLARE_ACCOUNT_ID = 'seu_account_id'" -ForegroundColor Yellow
    Write-Host "  `$env:CLOUDFLARE_API_TOKEN = 'seu_cfat_token'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[1/2] Buildando frontend..." -ForegroundColor Yellow
npm run build

Write-Host "`n[2/2] Deployando para Cloudflare Pages (assets + functions)..." -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name appdgriffedois --commit-dirty=true

Write-Host "`n[deploy] Concluido!" -ForegroundColor Green
Write-Host "URL: https://appdgriffedois.pages.dev" -ForegroundColor Green