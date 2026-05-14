@echo off
echo Iniciando CRM SaaS...
echo.
echo Abrindo API (porta 3001) e Web (porta 3000)...
echo Para parar: feche as janelas ou pressione Ctrl+C
echo.
start "API - CRM" cmd /k "cd /d %~dp0apps\api && pnpm dev"
timeout /t 3 /nobreak >nul
start "WEB - CRM" cmd /k "cd /d %~dp0apps\web && pnpm dev"
echo.
echo Acesse: http://localhost:3000
echo API:    http://localhost:3001
