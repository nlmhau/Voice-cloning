# -*- coding: utf-8 -*-
# Script chay Demo Buoc 7b - VoiceLab Studio
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$env:TTS_SERVER_URL = if ($env:TTS_SERVER_URL) { $env:TTS_SERVER_URL } else { 'http://127.0.0.1:8000' }
$env:DEMO_HOST = '127.0.0.1'
$env:DEMO_PORT = '8765'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  VOICELAB STUDIO v2.0 - DEMO BUOC 7b (NHAN DANG MAU)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Server TTS mac dinh : $env:TTS_SERVER_URL" -ForegroundColor Gray
Write-Host "Trinh duyet demo    : http://127.0.0.1:8765" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"

# Kiem tra Python
$pythonCmd = 'python'
if (-not (Get-Command $pythonCmd -ErrorAction SilentlyContinue)) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCmd = 'py'
    } else {
        Write-Host "[X] Khong tim thay Python. Vui long cai Python tu python.org." -ForegroundColor Red
        exit 1
    }
}

# Kiem tra thu vien trong Python hien tai
$checkLib = & $pythonCmd -c "import numpy, scipy, soundfile, sklearn, joblib; print('OK')" 2>$null
if ($checkLib -eq 'OK') {
    Write-Host "[✓] Moi truong Python da co day du thu vien (numpy, scipy, sklearn, soundfile, joblib)." -ForegroundColor Green
} else {
    Write-Host "[i] Dang kiem tra / cai dat thu vien can thiet vao .venv..." -ForegroundColor Yellow
    if (-not (Test-Path '.venv\Scripts\python.exe')) {
        & $pythonCmd -m venv .venv
    }
    & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    $pythonCmd = '.\.venv\Scripts\python.exe'
}

Write-Host "`nDang khoi dong may chu Demo VoiceLab..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:8765"
& $pythonCmd app.py
