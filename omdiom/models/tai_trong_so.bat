@echo off
chcp 65001 >nul
echo ======================================================================
echo   TẢI / ĐỒNG BỘ TRỌNG SỐ MÔ HÌNH (OMDIOM & OMNIVOICE)
echo ======================================================================
cd /d "%~dp0"
python tai_trong_so.py
pause
