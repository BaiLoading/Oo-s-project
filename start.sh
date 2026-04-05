#!/bin/bash
# ==========================================
#   股债分析系统 - 启动后端（macOS/Linux）
# ==========================================

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${GREEN}=========================================="
echo "  股债分析系统 - 启动后端"
echo "==========================================${NC}"
echo ""

# ---- 检测虚拟环境 ----
if [ ! -d ".venv" ]; then
    echo -e "${RED}[  错误  ] 虚拟环境不存在！${NC}"
    echo ""
    echo "  请先运行安装脚本："
    echo "    ./install.sh"
    echo ""
    exit 1
fi

# ---- 激活虚拟环境 ----
source .venv/bin/activate
echo -e "[${GREEN}  OK  ${NC}] 虚拟环境已激活"

# ---- 端口检测 ----
echo ""
echo "[  INFO  ] 检查端口 3000..."
PORT_PID=$(lsof -ti:3000 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
    echo -e "${YELLOW}[  警告  ] 端口 3000 已被占用 (pid=$PORT_PID)${NC}"
    read -p "  是否停止旧进程并继续？ [Y/n] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "  已取消启动"
        exit 0
    fi
    kill $PORT_PID 2>/dev/null || true
    sleep 2
    echo -e "[${GREEN}  OK  ${NC}] 已停止旧进程"
fi

# ---- 启动 Flask ----
echo ""
echo "=========================================="
echo -e "  后端地址: ${GREEN}http://localhost:3000${NC}"
echo "  停止服务: ${YELLOW}Ctrl+C${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}启动中...${NC}"
python server.py
