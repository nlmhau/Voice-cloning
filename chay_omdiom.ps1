# Chạy OmDiOm Studio (Máy chủ Neural TTS & Nhân bản giọng nói GPU)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  OMDIOM STUDIO - MAY CHU NHAN BAN & TONG HOP GIONG NOI" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Dia chi Web: http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "  Nhan Ctrl+C de dung may chu." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

$env:PYTHONPATH = "$PSScriptRoot\omdiom\server;$PSScriptRoot\omdiom"
$env:OMDIOM_VOICES = "$PSScriptRoot\omdiom\voices"
$env:OMDIOM_MOCK = "0"
$env:OMDIOM_PRELOAD = "1"

python -m uvicorn app:app --app-dir "$PSScriptRoot\omdiom\server" --host 127.0.0.1 --port 8000
