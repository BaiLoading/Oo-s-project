#!/bin/bash
# ==========================================
#   股债分析系统 - 启动后端（macOS/Linux）
# ==========================================

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "[错误] 虚拟环境不存在，请先运行 install.sh"
    exit 1
fi

source .venv/bin/activate

echo "启动 Flask 后端..."
echo "  后端地址: http://localhost:3000"
echo "  按 Ctrl+C 停止服务"
echo ""

python server.py
