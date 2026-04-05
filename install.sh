#!/bin/bash
# ==========================================
#   股债分析系统 - macOS/Linux 安装脚本
# ==========================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  股债分析系统 - 安装脚本"
echo "=========================================="

# ---- 检测 Python ----
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 python3，请先安装 Python 3.10+"
    exit 1
fi

PYVER=$(python3 -c 'import sys; print(sys.version_info[1])')
if [ "$PYVER" -lt 10 ]; then
    echo "[错误] Python 版本过低，需要 Python 3.10 或 3.11"
    exit 1
fi
echo "  Python 版本检测通过"

# ---- 创建虚拟环境 ----
echo ""
echo "[2/5] 创建虚拟环境..."
if [ -d ".venv" ]; then
    echo "  虚拟环境已存在，跳过"
else
    python3 -m venv .venv
    echo "  创建完成"
fi

# ---- 激活虚拟环境 ----
echo ""
echo "[3/5] 激活虚拟环境并安装依赖（请耐心等待）..."
source .venv/bin/activate

pip install --upgrade pip --quiet

echo "  安装核心依赖..."
pip install flask==3.0.3 --quiet
pip install flask-cors==4.0.1 --quiet
pip install requests==2.32.3 --quiet
pip install pandas==2.2.3 --quiet
pip install akshare==1.14.20 --quiet
pip install yfinance==0.2.41 --quiet
pip install dashscope==1.20.0 --quiet
pip install openbb --quiet
pip install qrcode[pil]==8.0 --quiet
pip install pillow==11.2.0 --quiet
pip install gunicorn==23.0.0 --quiet

# ---- 验证安装 ----
echo ""
echo "[4/5] 验证安装..."
if python3 -c "import flask, flask_cors, requests, akshare, pandas, yfinance, dashscope, openbb; from openbb import obb; print('ALL OK')" 2>/dev/null; then
    echo "  验证通过"
else
    echo "  [警告] 部分依赖验证失败，请检查网络后重试"
fi

# ---- 配置文件 ----
echo ""
echo "[5/5] 配置检查..."
if [ ! -f ".env" ] && [ -f "config.example.py" ]; then
    echo "  建议复制 config.example.py 为 config.py 并填入 API Key"
    echo "  或创建 .env 文件："
    echo "  DASHSCOPE_API_KEY=your-key-here"
fi

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 运行 ./start.sh 启动后端"
echo "  2. 用浏览器打开 index.html"
echo ""
echo "如需配置 AI 对话功能，创建 .env 文件："
echo "  DASHSCOPE_API_KEY=your-dashscope-api-key"
echo ""
