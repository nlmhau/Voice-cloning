@echo off
chcp 65001 >nul
echo ======================================================================
echo   TẢI VÀ ĐỒNG BỘ TRỌNG SỐ CHO OMDIOM STUDIO & VOICELAB
echo ======================================================================
cd /d "%~dp0"
python omdiom\models\tai_trong_so.py
pause
