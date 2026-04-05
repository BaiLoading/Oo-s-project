@echo off
chcp 65001 >nul
title 股债分析系统 - 后端服务
cd /d "%~dp0"

echo.
echo  ==================================================
echo     股债分析系统 - 启动后端
echo  ==================================================
echo.

:: [1] 检查虚拟环境
echo [1/4] 检查虚拟环境...
if not exist ".venv\Scripts\activate.bat" (
    echo.
    echo     [错误] 虚拟环境不存在！
    echo     请先运行 install_windows.bat
    echo.
    pause
    exit /b 1
)
echo     OK

:: [2] 激活虚拟环境
echo [2/4] 激活虚拟环境...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo     [错误] 激活失败
    pause
    exit /b 1
)
echo     OK

:: [3] 检查端口占用
echo [3/4] 检查端口 3000 是否被占用...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo     [警告] 端口 3000 已被占用！
    echo     可能已有实例在运行。
    echo.
    echo     要强制停止旧进程并继续吗？ (Y/N)
    choice /t 3 /c YN /d Y >nul 2>&1
    if errorlevel 2 (
        echo     已取消启动
        pause
        exit /b 0
    )
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        echo     停止旧进程 pid=%%a ...
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 >nul
)
echo     OK

:: [4] 启动 Flask
echo [4/4] 启动后端服务...
echo.
echo  ==================================================
echo     后端地址: http://localhost:3000
echo     停止服务: 按 Ctrl+C 或关闭此窗口
echo  ==================================================
echo.
python server.py

pause
