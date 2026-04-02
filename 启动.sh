#!/bin/bash

echo "=========================================="
echo "  📊 股票智能分析系统 - 启动脚本"
echo "=========================================="
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python3，请先安装 Python3"
    exit 1
fi

echo "✅ 检查 Python3 ... OK"

# 检查是否安装了依赖
if [ ! -d "venv" ]; then
    echo ""
    echo "📦 第一次运行，正在安装依赖..."
    echo ""
    
    # 创建虚拟环境
    python3 -m venv venv
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 安装依赖
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    
    echo ""
    echo "✅ 依赖安装完成！"
else
    # 激活虚拟环境
    source venv/bin/activate
fi

echo ""
echo "🚀 正在启动服务..."
echo ""
echo "📱 访问地址: http://localhost:3000"
echo "⏹️  按 Ctrl+C 停止服务"
echo ""
echo "=========================================="
echo ""

# 启动服务器
python3 server_akshare.py
