@echo off
chcp 65001 >nul
title 股债分析系统 - 环境检测
cd /d "%~dp0"

echo ==========================================
echo    股债分析系统 - 环境检测
echo ==========================================
echo.

echo [Python 版本]
python --version 2>nul || echo   未安装
echo.

echo [虚拟环境]
if exist ".venv\Scripts\activate.bat" (
    echo   已创建
) else (
    echo   未创建（需要运行 install_windows.bat）
)
echo.

echo [后端服务是否运行]
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo   运行中
) else (
    echo   未运行
)
echo.

echo [已安装的核心依赖]
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat >nul 2>&1
    pip show flask     2>nul | findstr "Version" || echo   Flask: 未安装
    pip show akshare  2>nul | findstr "Version" || echo   akshare: 未安装
    pip show openbb   2>nul | findstr "Version" || echo   openbb: 未安装
    pip show dashscope 2>nul | findstr "Version" || echo   dashscope: 未安装
) else (
    echo   虚拟环境不存在，无法检测
)
echo.

echo ==========================================
echo 按任意键退出...
pause >nul
