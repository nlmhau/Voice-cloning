# Khởi động đồng thời cả 2 hệ sinh thái: VoiceLab (8765) + OmDiOm (8000)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  KHOI DONG DONG THOI: VOICELAB (8765) & OMDIOM STUDIO (8000)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -File `"$PSScriptRoot\chay_omdiom.ps1`""
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -File `"$PSScriptRoot\chay_lab.ps1`""

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:8765"
Start-Process "http://127.0.0.1:8000"
