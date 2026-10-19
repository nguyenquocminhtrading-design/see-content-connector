@echo off
chcp 65001 > nul
echo ===================================================
echo   SEE CONTENT CONNECTOR - KHOI DONG HE THONG
echo ===================================================
echo.
echo [1/2] Dang kiem tra dependencies...
if not exist "node_modules" (
    echo Cai dat root dependencies...
    call npm install
)
if not exist "frontend\node_modules" (
    echo Cai dat frontend dependencies...
    call npm --prefix frontend install
)
if not exist "backend\node_modules" (
    echo Cai dat backend dependencies...
    call npm --prefix backend install
)

echo.
echo [2/2] Dang khoi dong Backend (Port 4000) va Frontend (Port 3002)...
echo.
echo ===================================================
echo Backend API : http://localhost:4000/api/health
echo Frontend Web: http://localhost:3002
echo ===================================================
echo.
npm run dev
pause
