#!/bin/bash
# ==========================================
#   股债分析系统 - 环境检测（macOS/Linux）
# ==========================================

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUE_COUNT=0

echo ""
echo -e "${GREEN}=========================================="
echo "  股债分析系统 - 环境检测"
echo "==========================================${NC}"
echo ""

# ---- Python 版本 ----
echo "[1] Python 版本"
if command -v python3 &> /dev/null; then
    PYVER=$(python3 -c 'import sys; print(sys.version_info[1])')
    PYVER_STR=$(python3 --version)
    if [ "$PYVER" -lt 10 ]; then
        echo -e "      ${RED}[  错误  ] $PYVER_STR，过低（需要 3.10+）${NC}"
        ISSUE_COUNT=$((ISSUE_COUNT + 1))
    else
        echo -e "      [${GREEN}  OK  ${NC}] $PYVER_STR"
    fi
else
    echo -e "      ${RED}[  错误  ] 未安装 Python${NC}"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# ---- 虚拟环境 ----
echo ""
echo "[2] 虚拟环境"
if [ -d ".venv" ]; then
    echo -e "      [${GREEN}  OK  ${NC}] 已创建"
else
    echo -e "      ${RED}[  错误  ] 不存在（运行 ./install.sh）${NC}"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# ---- 核心依赖 ----
echo ""
echo "[3] 核心依赖"
if [ -d ".venv" ]; then
    source .venv/bin/activate

    pip show flask      2>/dev/null | grep "Version" && echo -e "      [${GREEN}  OK  ${NC}] Flask"      || { echo -e "      ${RED}[  错误  ] Flask 未安装${NC}";      ISSUE_COUNT=$((ISSUE_COUNT + 1)); }
    pip show akshare   2>/dev/null | grep "Version" && echo -e "      [${GREEN}  OK  ${NC}] akshare"   || echo -e "      ${YELLOW}[  警告  ] akshare 未安装（A股不可用）${NC}"
    pip show openbb    2>/dev/null | grep "Version" && echo -e "      [${GREEN}  OK  ${NC}] openbb"    || echo -e "      ${YELLOW}[  警告  ] openbb 未安装（美股不可用）${NC}"
    pip show yfinance  2>/dev/null | grep "Version" && echo -e "      [${GREEN}  OK  ${NC}] yfinance"  || echo -e "      ${YELLOW}[  警告  ] yfinance 未安装${NC}"
    pip show dashscope 2>/dev/null | grep "Version" && echo -e "      [${GREEN}  OK  ${NC}] dashscope" || echo -e "      ${YELLOW}[  警告  ] dashscope 未安装（AI对话不可用）${NC}"
else
    echo "      跳过（虚拟环境不存在）"
fi

# ---- 端口占用 ----
echo ""
echo "[4] 后端服务状态"
PORT_PID=$(lsof -ti:3000 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
    echo -e "      [${GREEN}  OK  ${NC}] 端口 3000 正在运行 (pid=$PORT_PID)"
else
    echo -e "      [${YELLOW}  警告  ${NC}] 端口 3000 未监听（后端未运行）"
fi

# ---- 配置文件 ----
echo ""
echo "[5] 配置文件"
if [ -f ".env" ]; then
    echo -e "      [${GREEN}  OK  ${NC}] .env 已存在"
    if grep -q "DASHSCOPE_API_KEY=$" .env 2>/dev/null; then
        echo -e "      ${YELLOW}[  警告  ] DASHSCOPE_API_KEY 未填写（AI对话不可用）${NC}"
    else
        echo -e "      [${GREEN}  OK  ${NC}] DASHSCOPE_API_KEY 已配置"
    fi
else
    echo -e "      ${YELLOW}[  警告  ] .env 不存在（AI对话不可用）${NC}"
fi

# ---- 网络检测 ----
echo ""
echo "[6] 网络连接"
if curl -s --connect-timeout 5 https://pypi.org > /dev/null 2>&1; then
    echo -e "      [${GREEN}  OK  ${NC}] PyPI 连接正常"
else
    echo -e "${RED}[  错误  ] 无法连接 PyPI${NC}"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

echo ""
echo "=========================================="
if [ $ISSUE_COUNT -gt 0 ]; then
    echo -e "${RED}  发现 $ISSUE_COUNT 个问题，请解决后再启动${NC}"
else
    echo -e "${GREEN}  环境检测通过！${NC}"
fi
echo "=========================================="
echo ""
echo "  启动后端: ./start.sh"
echo "  安装依赖: ./install.sh"
echo ""
