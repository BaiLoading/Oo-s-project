@echo off
chcp 65001 >nul
title 股债分析系统 - 后端服务
cd /d "%~dp0"

echo [1] 检查虚拟环境...
if not exist ".venv\Scripts\activate.bat" (
    echo [错误] 虚拟环境不存在，请先运行 install_windows.bat
    pause
    exit /b 1
)

echo [2] 激活虚拟环境...
call .venv\Scripts\activate.bat

echo [3] 启动 Flask 后端...
echo.
echo    后端地址: http://localhost:3000
echo    按 Ctrl+C 停止服务
echo.
python server.py

pause
