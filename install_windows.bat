@echo off
chcp 65001 >nul
title 股债分析系统 - 安装程序
echo ==========================================
echo    股债分析系统 - Windows 安装程序
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/6] 检测 Python 版本...
python --version 2>nul
if errorlevel 1 (
    echo [错误] 未找到 Python，请先从 https://python.org 下载安装 Python 3.10 或 3.11
    echo 安装时记得勾选 "Add Python to PATH"
    pause
    exit /b 1
)
for /f "delims=" %%v in ('python -c "import sys; print(sys.version_info[1])"') do set PYVER=%%v
if %PYVER% LSS 10 (
    echo [错误] Python 版本过低，需要 Python 3.10 或 3.11
    pause
    exit /b 1
)
echo    Python 版本检测通过

echo.
echo [2/6] 创建虚拟环境...
if exist ".venv" (
    echo    虚拟环境已存在，跳过
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo [错误] 虚拟环境创建失败
        pause
        exit /b 1
    )
    echo    创建完成
)

echo.
echo [3/6] 激活虚拟环境并安装依赖（请耐心等待）...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo [错误] 虚拟环境激活失败
    pause
    exit /b 1
)

echo    升级 pip...
python -m pip install --upgrade pip --quiet

echo    安装 Flask...
pip install flask==3.0.3 --quiet
if errorlevel 1 ( echo    [警告] Flask 安装失败，继续... )

echo    安装 flask-cors...
pip install flask-cors==4.0.1 --quiet

echo    安装 requests...
pip install requests==2.32.3 --quiet

echo    安装 pandas...
pip install pandas==2.2.3 --quiet

echo    安装 akshare（较大，请等待）...
pip install akshare==1.14.20 --quiet
if errorlevel 1 ( echo    [警告] akshare 安装失败，继续... )

echo    安装 yfinance...
pip install yfinance==0.2.41 --quiet

echo    安装 dashscope...
pip install dashscope==1.20.0 --quiet

echo    安装 openbb（较大，请等待约 2-5 分钟）...
pip install openbb --quiet
if errorlevel 1 ( echo    [警告] openbb 安装失败，继续... )

echo    安装辅助工具...
pip install qrcode[pil]==8.0 --quiet
pip install pillow==11.2.0 --quiet
pip install gunicorn==23.0.0 --quiet

echo.
echo [4/6] 验证安装...
python -c "import flask, flask_cors, requests, akshare, pandas, yfinance, dashscope, openbb; from openbb import obb; print('ALL OK')" 2>nul
if errorlevel 1 (
    echo    [警告] 部分依赖验证失败，请检查网络后重试
    echo    核心功能（Flask/akshare）应该正常
) else (
    echo    验证通过
)

echo.
echo [5/6] 配置文件检查...
if not exist ".env" (
    if exist "config.example.py" (
        echo    建议复制 config.example.py 为 config.py 并填入 API Key
        echo    或创建 .env 文件：
        echo    DASHSCOPE_API_KEY=your-key-here
    )
)

echo.
echo [6/6] 安装完成！
echo ==========================================
echo.
echo 下一步：
echo   1. 双击 START.bat 启动后端
echo   2. 用浏览器打开 index.html
echo   或 VS Code 安装 Live Server，右键 index.html ^> Open with Live Server
echo.
echo 如需配置 AI 对话功能，创建 .env 文件：
echo   DASHSCOPE_API_KEY=your-dashscope-api-key
echo.
pause
