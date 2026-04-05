#!/bin/bash
# ==========================================
#   股债分析系统 - macOS/Linux 安装脚本
# ==========================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${GREEN}=========================================="
echo "  股债分析系统 - 安装脚本"
echo "==========================================${NC}"
echo ""

# ---- 检测操作系统 ----
OS_TYPE="$(uname -s)"
echo "[  INFO  ] 检测操作系统: $OS_TYPE"

# ---- 检测 Python ----
if ! command -v python3 &> /dev/null; then
    echo ""
    echo -e "${RED}[  错误  ] 未找到 python3，请先安装 Python 3.10+${NC}"
    echo "   macOS: brew install python@3.11"
    echo "  Ubuntu/Debian: sudo apt install python3.11 python3.11-venv"
    exit 1
fi

PYVER=$(python3 -c 'import sys; print(sys.version_info[1])')
if [ "$PYVER" -lt 10 ]; then
    echo ""
    echo -e "${RED}[  错误  ] Python 版本过低 ($PYVER.x)，需要 Python 3.10 或 3.11${NC}"
    exit 1
fi
echo -e "[${GREEN}  OK  ${NC}] Python $PYVER.x"

# ---- 检测网络 ----
echo ""
echo "[  INFO  ] 检测网络连接..."
if curl -s --connect-timeout 5 https://pypi.org > /dev/null 2>&1; then
    PIP_INDEX=""
    echo -e "[${GREEN}  OK  ${NC}] PyPI 连接正常"
else
    echo -e "${YELLOW}[  警告  ] PyPI 连接慢，使用国内镜像加速${NC}"
    PIP_INDEX="-i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn"
fi

# ---- 创建虚拟环境 ----
echo ""
echo "[  2/7  ] 创建/更新虚拟环境..."
if [ -d ".venv" ]; then
    echo -e "         虚拟环境已存在，删除旧环境重新创建..."
    rm -rf .venv
fi
python3 -m venv .venv
echo -e "[${GREEN}  OK  ${NC}] 创建完成"

# ---- 激活虚拟环境 ----
echo ""
echo "[  3/7  ] 激活虚拟环境..."
source .venv/bin/activate
echo -e "[${GREEN}  OK  ${NC}] 已激活"

# ---- pip 升级 ----
echo ""
echo "[  4/7  ] 安装 Python 依赖（约需 3-8 分钟）..."

pip install --upgrade pip $PIP_INDEX -q

# ---- 带重试的 pip 安装函数 ----
pip_install() {
    local pkg="$1"
    local retries=2
    local delay=3
    for i in $(seq 1 $retries); do
        if pip install "$pkg" $PIP_INDEX -q 2>/dev/null; then
            return 0
        fi
        if [ $i -lt $retries ]; then
            echo -e "${YELLOW}         重试 $i/$retries ...${NC}"
            sleep $delay
        fi
    done
    return 1
}

# ---- 核心依赖安装 ----
install_ok=true

echo "         [1/9] Flask..."
pip_install "flask==3.0.3" || { echo -e "${RED}         失败${NC}"; install_ok=false; }

echo "         [2/9] flask-cors..."
pip_install "flask-cors==4.0.1" || { echo -e "${RED}         失败${NC}"; install_ok=false; }

echo "         [3/9] requests..."
pip_install "requests==2.32.3" || { echo -e "${RED}         失败${NC}"; install_ok=false; }

echo "         [4/9] pandas..."
pip_install "pandas==2.2.3" || { echo -e "${RED}         失败${NC}"; install_ok=false; }

echo "         [5/9] yfinance..."
pip_install "yfinance==0.2.41" || { echo -e "${RED}         失败${NC}"; install_ok=false; }

echo "         [6/9] dashscope（通义千问）..."
pip_install "dashscope==1.20.0" || { echo -e "${RED}         失败${NC}"; install_ok=false; }

echo "         [7/9] akshare（A股数据，需等待 1-3 分钟）..."
if pip_install "akshare==1.14.20"; then
    echo -e "         [${GREEN}  OK  ${NC}] akshare"
else
    echo -e "${YELLOW}         警告: akshare 安装失败，A股数据不可用${NC}"
fi

echo "         [8/9] openbb（美股数据，需等待 2-5 分钟，首次安装慢）..."
if pip_install "openbb"; then
    echo -e "         [${GREEN}  OK  ${NC}] openbb"
else
    echo -e "${YELLOW}         警告: openbb 安装失败，美股数据不可用${NC}"
fi

echo "         [9/9] 辅助工具..."
pip_install "qrcode[pil]==8.0" -q
pip_install "pillow==11.2.0" -q
pip_install "gunicorn==23.0.0" -q

# ---- 验证安装 ----
echo ""
echo "[  5/7  ] 验证安装结果..."
$install_ok && echo -e "[${GREEN}  OK  ${NC}] 核心依赖安装成功" || echo -e "${RED}[  错误  ] 部分依赖安装失败${NC}"

echo ""
echo "[  6/7  ] 验证模块导入..."
python3 -c "import flask; print('  Flask OK')" 2>/dev/null || echo -e "${RED}  Flask: 失败${NC}"
python3 -c "import flask_cors; print('  flask-cors OK')" 2>/dev/null || echo -e "${RED}  flask-cors: 失败${NC}"
python3 -c "import pandas; print('  pandas OK')" 2>/dev/null || echo -e "${RED}  pandas: 失败${NC}"
python3 -c "import yfinance; print('  yfinance OK')" 2>/dev/null || echo -e "${RED}  yfinance: 失败${NC}"
python3 -c "import dashscope; print('  dashscope OK')" 2>/dev/null || echo -e "${YELLOW}  dashscope: 失败（AI对话不可用）${NC}"
python3 -c "import akshare; print('  akshare OK')" 2>/dev/null || echo -e "${YELLOW}  akshare: 失败（A股不可用）${NC}"
python3 -c "from openbb import obb; print('  openbb OK')" 2>/dev/null || echo -e "${YELLOW}  openbb: 失败（美股不可用）${NC}"

# ---- 配置文件 ----
echo ""
echo "[  7/7  ] 配置文件..."
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# 通义千问 API Key（用于 AI 对话功能，可选）
# 获取地址：https://dashscope.console.aliyun.com/apiKey
DASHSCOPE_API_KEY=

# OpenBB Server 地址（可选，本地开发填 http://127.0.0.1:6900）
OPENBB_API_BASE_URL=
EOF
    echo -e "[${GREEN}  OK  ${NC}] 已创建 .env 配置文件"
    echo -e "${YELLOW}  请编辑 .env 填入 DASHSCOPE_API_KEY（如需 AI 对话）${NC}"
else
    echo "  .env 已存在，跳过"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  安装完成！${NC}"
echo "=========================================="
echo ""
echo "  下一步："
echo "    1. ./start.sh              启动后端"
echo "    2. 打开 index.html         开始使用"
echo ""
echo "  其他命令："
echo "    ./CHECK.sh                检查环境"
echo "    ./start.sh                启动后端"
echo ""
