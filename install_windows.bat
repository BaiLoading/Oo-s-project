@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title 股债分析系统 - 安装程序

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo.
echo  ==================================================
echo    股债分析系统 - Windows 一键安装程序
echo  ==================================================
echo.

:: ============================================================
:: [1/7] 检测 Python
:: ============================================================
echo [1/7] 检测 Python 版本...
python --version 2>nul >nul
if errorlevel 1 (
    echo.
    echo  [错误] 未找到 Python！
    echo  请先从 https://python.org 下载安装 Python 3.10 或 3.11
    echo  安装时务必勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('python -c "import sys; print(sys.version_info[1])"') do set PYVER=%%v
if !PYVER! LSS 10 (
    echo.
    echo  [错误] Python 版本过低（!PYVER!.x），需要 Python 3.10 或 3.11
    echo  请升级：https://python.org
    echo.
    pause
    exit /b 1
)
echo     OK - Python !PYVER!.x

:: ============================================================
:: [2/7] 检测网络（轻量检查）
:: ============================================================
echo [2/7] 检测网络连接...
curl -s --connect-timeout 5 https://pypi.org >nul 2>&1
if errorlevel 1 (
    echo     警告：无法连接 PyPI，网络可能不稳定
    echo     尝试使用国内镜像加速...
    set "PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple"
    set "PIP_EXTRA=https://pypi.org/simple"
) else (
    set "PIP_INDEX="
)
echo     OK

:: ============================================================
:: [3/7] 创建/更新虚拟环境
:: ============================================================
echo [3/7] 创建 Python 虚拟环境...
if exist ".venv" (
    echo     虚拟环境已存在，跳过创建
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo     [错误] 虚拟环境创建失败
        echo.
        pause
        exit /b 1
    )
    echo     创建完成
)

:: ============================================================
:: [4/7] 安装核心依赖（分批，含重试）
:: ============================================================
echo [4/7] 安装 Python 依赖（约需 3-8 分钟）...
call .venv\Scripts\activate.bat >nul 2>&1
if errorlevel 1 (
    echo.
    echo     [错误] 虚拟环境激活失败
    pause
    exit /b 1
)

:: pip 升级
echo     [1/9] 升级 pip...
pip install --upgrade pip -q
if errorlevel 1 ( echo     警告: pip 升级失败，继续... )

:: Flask
echo     [2/9] 安装 Flask...
call :pip_install flask==3.0.3 --quiet
if errorlevel 1 ( echo     警告: Flask 安装失败 )

:: flask-cors
echo     [3/9] 安装 flask-cors...
call :pip_install flask-cors==4.0.1 --quiet

:: requests
echo     [4/9] 安装 requests...
call :pip_install requests==2.32.3 --quiet

:: pandas
echo     [5/9] 安装 pandas...
call :pip_install pandas==2.2.3 --quiet

:: yfinance
echo     [6/9] 安装 yfinance...
call :pip_install yfinance==0.2.41 --quiet

:: dashscope
echo     [7/9] 安装 dashscope（通义千问）...
call :pip_install dashscope==1.20.0 --quiet

:: akshare（较大）
echo     [8/9] 安装 akshare（较大，需等待 1-3 分钟）...
call :pip_install akshare==1.14.20 -q
if errorlevel 1 (
    echo     警告: akshare 安装失败，A股数据将不可用
) else (
    echo     OK
)

:: openbb（最大，最耗时）
echo     [9/9] 安装 openbb（需等待 2-5 分钟，首次安装较慢）...
call :pip_install openbb -q
if errorlevel 1 (
    echo     警告: openbb 安装失败，美股数据将不可用
) else (
    echo     OK
)

:: 辅助工具
pip install qrcode[pil]==8.0 -q
pip install pillow==11.2.0 -q
pip install gunicorn==23.0.0 -q

:: ============================================================
:: [5/7] 验证安装
:: ============================================================
echo.
echo [5/7] 验证安装结果...
set "CHECK_ERR=0"

python -c "import flask; print('Flask OK')" 2>nul
if errorlevel 1 ( set CHECK_ERR=1 && echo     Flask: 失败 )

python -c "import flask_cors; print('flask-cors OK')" 2>nul
if errorlevel 1 ( set CHECK_ERR=1 && echo     flask-cors: 失败 )

python -c "import requests; print('requests OK')" 2>nul
if errorlevel 1 ( set CHECK_ERR=1 && echo     requests: 失败 )

python -c "import pandas; print('pandas OK')" 2>nul
if errorlevel 1 ( set CHECK_ERR=1 && echo     pandas: 失败 )

python -c "import yfinance; print('yfinance OK')" 2>nul
if errorlevel 1 ( set CHECK_ERR=1 && echo     yfinance: 失败 )

python -c "import dashscope; print('dashscope OK')" 2>nul
if errorlevel 1 ( echo     dashscope: 失败（AI对话不可用，不影响主要功能）)

python -c "import akshare; print('akshare OK')" 2>nul
if errorlevel 1 ( echo     akshare: 失败（A股数据不可用，不影响主要功能）)

python -c "from openbb import obb; print('openbb OK')" 2>nul
if errorlevel 1 ( echo     openbb: 失败（美股数据不可用，不影响主要功能）)

if "!CHECK_ERR!"=="1" (
    echo.
    echo     核心依赖缺失，请检查网络后重新运行 install.bat
)

:: ============================================================
:: [6/7] 配置 .env
:: ============================================================
echo.
echo [6/7] 配置 AI 对话（可选）...
if not exist ".env" (
    (
        echo # 通义千问 API Key（用于 AI 对话功能，可选）
        echo # 获取地址：https://dashscope.console.aliyun.com/apiKey
        echo DASHSCOPE_API_KEY=
        echo.
        echo # 如需调用远程 OpenBB Server，填入其地址
        echo # OPENBB_API_BASE_URL=http://192.168.1.100:6900
    ) > .env
    echo     已创建 .env 配置文件
    echo     请编辑 .env 填入 DASHSCOPE_API_KEY（如需 AI 对话功能）
) else (
    echo     .env 已存在，跳过
)

:: ============================================================
:: [7/7] 完成
:: ============================================================
echo.
echo ==================================================
echo     安装完成！
echo ==================================================
echo.
echo     下一步：
echo     1. 双击 START.bat           启动后端（保持窗口打开）
echo     2. 打开 index.html          开始使用
echo.
echo     配置文件：.env
echo     启动脚本：START.bat
echo     使用手册：README.md
echo.
echo     如启动报错，请运行 CHECK.bat 检查环境
echo.
pause
exit /b 0

:: ============================================================
:: :pip_install - 带镜像和重试的 pip 安装
:: ============================================================
:pip_install
setlocal
set "PKG=%~1"
set "REST=%~2"

:: 先尝试默认源，失败后尝试国内镜像
pip install %PKG% %REST% %PIP_INDEX% %PIP_EXTRA% >nul 2>&1
if not errorlevel 1 goto :pip_ok

:: 重试1：使用清华镜像
pip install %PKG% %REST% -i https://pypi.tuna.tsinghua.edu.cn/simple -- trusted-host pypi.tuna.tsinghua.edu.cn >nul 2>&1
if not errorlevel 1 goto :pip_ok

:: 重试2：使用阿里镜像
pip install %PKG% %REST% -i https://mirrors.aliyun.com/pypi/simple -- trusted-host mirrors.aliyun.com >nul 2>&1
if errorlevel 1 (
    endlocal
    exit /b 1
)
:pip_ok
endlocal
exit /b 0
