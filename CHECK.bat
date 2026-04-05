@echo off
chcp 65001 >nul
title 股债分析系统 - 环境检测
cd /d "%~dp0"

echo.
echo  ==================================================
echo     股债分析系统 - 环境检测
echo  ==================================================
echo.

set "ISSUE_COUNT=0"

:: Python 版本
echo [1] Python 版本
python --version 2>nul
if errorlevel 1 (
    echo     [错误] 未安装 Python
    set /a ISSUE_COUNT+=1
) else (
    for /f "delims=" %%v in ('python -c "import sys; print(sys.version_info[1])"') do set PYVER=%%v
    if !PYVER! LSS 10 (
        echo     [错误] Python 版本 !PYVER!.x 过低，需要 3.10+
        set /a ISSUE_COUNT+=1
    ) else (
        echo     [OK] Python !PYVER!.x
    )
)

:: 虚拟环境
echo.
echo [2] 虚拟环境
if exist ".venv\Scripts\activate.bat" (
    echo     [OK] 已创建
) else (
    echo     [错误] 未创建（运行 install_windows.bat）
    set /a ISSUE_COUNT+=1
)

:: 核心依赖
echo.
echo [3] 核心依赖
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat >nul 2>&1

    pip show flask     2>nul | findstr "Version" && echo     [OK] Flask     || (echo     [错误] Flask 未安装  && set /a ISSUE_COUNT+=1)
    pip show akshare  2>nul | findstr "Version" && echo     [OK] akshare   || echo     [  ] akshare 未安装（A股数据不可用）
    pip show openbb   2>nul | findstr "Version" && echo     [OK] openbb    || echo     [  ] openbb 未安装（美股数据不可用）
    pip show yfinance 2>nul | findstr "Version" && echo     [OK] yfinance  || echo     [  ] yfinance 未安装
    pip show dashscope 2>nul | findstr "Version" && echo     [OK] dashscope || echo     [  ] dashscope 未安装（AI对话不可用）
) else (
    echo     跳过（虚拟环境不存在）
)

:: 端口占用
echo.
echo [4] 后端服务状态
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo     [  ] 端口 3000 未监听（后端未运行）
) else (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        echo     [OK] 端口 3000 正在运行 (pid=%%a)
    )
)

:: .env 配置
echo.
echo [5] 配置文件
if exist ".env" (
    echo     [OK] .env 已存在
    findstr "DASHSCOPE_API_KEY" .env | findstr /v "DASHSCOPE_API_KEY=$" >nul 2>&1
    if errorlevel 1 (
        echo     [  ] DASHSCOPE_API_KEY 未填写（AI 对话功能不可用）
    ) else (
        echo     [OK] DASHSCOPE_API_KEY 已配置
    )
) else (
    echo     [  ] .env 不存在（AI 对话功能不可用）
)

:: 网络检测
echo.
echo [6] 网络连接
curl -s --connect-timeout 5 https://pypi.org >nul 2>&1
if errorlevel 1 (
    echo     [错误] 无法连接 PyPI（网络问题）
    set /a ISSUE_COUNT+=1
) else (
    echo     [OK] PyPI 连接正常
)

echo.
echo ==================================================
if %ISSUE_COUNT% GTR 0 (
    echo  发现 %ISSUE_COUNT% 个问题，请解决后再启动
) else (
    echo  环境检测通过！
)
echo ==================================================
echo.
echo  启动后端: START.bat
echo  安装依赖: install_windows.bat
echo.
pause
