@echo off
chcp 65001 >nul
echo ==========================================
echo   📊 股票智能分析系统 - 启动脚本
echo ==========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

echo ✅ 检查 Python ... OK
echo.

REM 检查是否安装了依赖
if not exist "venv" (
    echo 📦 第一次运行，正在安装依赖...
    echo.
    
    REM 创建虚拟环境
    python -m venv venv
    
    REM 激活虚拟环境
    call venv\Scripts\activate.bat
    
    REM 安装依赖
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    
    echo.
    echo ✅ 依赖安装完成！
) else (
    REM 激活虚拟环境
    call venv\Scripts\activate.bat
)

echo.
echo 🚀 正在启动服务...
echo.
echo 📱 访问地址: http://localhost:3000
echo ⏹️  按 Ctrl+C 停止服务
echo.
echo ==========================================
echo.

REM 启动服务器
python server_akshare.py

pause
