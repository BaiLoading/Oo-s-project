# 股债智能分析系统

股债数据分析平台，支持 A股、美股、加密货币的技术分析、财报、新闻、AI 对话。

---

## 快速开始

### Windows 一键安装（首次运行）

双击运行：

```
install_windows.bat
```

按提示操作即可。安装完成后双击 `START.bat` 启动后端。

### macOS / Linux 安装

```bash
chmod +x install.sh
./install.sh
```

启动后端：`./start.sh`

---

## 系统要求

| 项目 | 要求 |
|------|------|
| Python | 3.10 或 3.11（推荐 3.11） |
| 内存 | 建议 8GB+（OpenBB 较耗内存） |
| 网络 | 需要访问 akshare、Yahoo Finance、通义千问 API |

---

## 安装详解

### 第一步：安装 Python 依赖

#### Windows

运行 `install_windows.bat`，脚本会自动：

1. 检测 Python 版本（需 3.10+）
2. 创建虚拟环境 `.venv`
3. 安装所有 Python 依赖
4. 验证安装是否成功

#### macOS / Linux

```bash
# 创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate   # macOS/Linux

# 安装依赖
pip install --upgrade pip
pip install flask==3.0.3
pip install flask-cors==4.0.1
pip install requests==2.32.3
pip install pandas==2.2.3
pip install akshare==1.14.20
pip install yfinance==0.2.41
pip install dashscope==1.20.0
pip install openbb
pip install qrcode[pil]==8.0
pip install pillow==11.2.0
pip install gunicorn==23.0.0
```

### 第二步：配置（可选）

如果需要 AI 对话功能，在项目根目录创建 `.env` 文件：

```
# .env 文件（从 config.example.py 复制修改）
DASHSCOPE_API_KEY=your-dashscope-api-key-here
DASHSCOPE_MODEL=qwen-turbo
```

获取通义千问 API Key：https://dashscope.console.aliyun.com/apiKey

不配置 `.env` 也能运行，只是 AI 对话功能不可用。

### 第三步：启动后端

#### Windows

双击 `START.bat`

#### macOS / Linux

```bash
source .venv/bin/activate
python server.py
```

后端启动后访问：**http://localhost:3000**

### 第四步：打开前端

**方式 A（推荐）：VS Code Live Server**

1. VS Code 安装 "Live Server" 插件
2. 右键 `index.html` → "Open with Live Server"
3. 自动打开浏览器

**方式 B：直接双击 index.html**

直接双击 `index.html` 文件用浏览器打开（文件协议，无跨域问题）

---

## 项目结构

```
D:\代码仓库\Oo-s-project\
├── index.html          前端页面（无需构建，直接浏览器打开）
├── script.js          前端逻辑
├── style.css          前端样式
├── server.py          Flask 后端（所有 API 接口）
├── config.example.py  配置文件模板
├── requirements.txt   Python 依赖列表
│
├── install_windows.bat Windows 一键安装脚本
├── install.sh          macOS/Linux 安装脚本
├── START.bat          Windows 快速启动后端
├── start.sh           macOS/Linux 启动后端
│
├── .venv              Python 虚拟环境（安装后自动生成）
├── .env               你的配置文件（创建 .env 后才有）
└── user_memory.json   AI 对话记忆（运行时自动生成）
```

---

## 接口文档

### 主要接口

| 接口 | 说明 |
|------|------|
| `GET /api/stock/full?code=600519&market=cn` | A股完整行情 |
| `GET /api/stock/full?code=MU&market=us` | 美股完整行情 |
| `GET /api/stock/quote?code=600519` | 实时报价 |
| `GET /api/stock/kline?code=600519&days=120` | 历史K线 |
| `GET /api/news` | 财经新闻 |
| `GET /api/stock/ranking` | 热门股票榜单 |
| `GET /api/stock/related-news?code=600519` | 个股新闻 |
| `POST /api/enhanced/analysis` | AI 技术分析 |
| `POST /api/ai/chat` | AI 聊天 |
| `GET /api/technical/dashboard?code=MU` | 技术指标仪表盘 |
| `GET /api/stock/financial/income?code=MU` | 利润表 |
| `GET /api/stock/financial/balance?code=MU` | 资产负债表 |
| `GET /api/stock/financial/cash?code=MU` | 现金流量表 |
| `GET /api/stock/metrics?code=MU` | 估值指标 |
| `GET /api/stock/management?code=MU` | 管理层信息 |
| `POST /api/ai/tradingagents/report` | TradingAgents 研报 |
| `GET /api/strategy` | 投资策略 |

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Flask 3.0 + Python |
| 数据源 A股 | akshare（东方财富等） |
| 数据源 美股 | Yahoo Finance（via OpenBB） |
| AI 对话 | 通义千问（阿里云） |
| 前端 | 原生 HTML/CSS/JS（无需构建） |
| 图表 | Chart.js |

---

## 常见问题

### Q: 启动报错 "No module named 'flask'"
A: 虚拟环境未激活。运行 `.venv\Scripts\activate`（Windows）或 `source .venv/bin/activate`（macOS/Linux）

### Q: 启动报错 "Too Many Requests"（429）
A: Yahoo Finance 请求频率限制，系统已内置重试机制，等几秒再试即可

### Q: AI 对话功能不可用
A: 需要配置 `.env` 文件填入 `DASHSCOPE_API_KEY`

### Q: A股数据获取失败
A: akshare 数据源有时不稳定，稍后重试即可

### Q: 想在另一台设备访问？
A: 后端支持局域网访问，地址为 `http://你的电脑IP:3000`，在同一局域网内的手机/电脑可直接访问

---

## 部署到云端（可选）

如需公网访问，有以下方案：

### 方案 A：ngrok 内网穿透（免费/简单）
```bash
ngrok http 3000
# 然后用 ngrok 提供的公网地址访问
```

### 方案 B：部署到服务器
```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:3000 server:app
```

### 方案 C：Docker 部署
```bash
docker build -t stock-server .
docker run -p 3000:3000 stock-server
```

---

## 版本信息

- server.py 最后更新：2026-04-05
- OpenBB 版本：4.7.1
- Python：3.11
