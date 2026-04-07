# 📈 股债分析系统

> A股 / 美股 / 加密货币行情 + 技术分析 + AI 对话

使用本地 SQLite（文件：strategy_db.sqlite3）保存策略、回测与模拟交易数据。

---

## 系统要求

| 项目 | 要求 |
|------|------|
| Python | 3.10 或 3.11（推荐 3.11） |
| 内存 | 4GB+（推荐 8GB+，openbb 较耗内存） |
| 网络 | 需要访问互联网获取行情数据 |

---

## 🪟 Windows 安装

### 方式一：双击安装（推荐）

1. 双击 `install_windows.bat`，等待 3-8 分钟
2. 双击 `START.bat` 启动后端
3. 用浏览器打开 `index.html`

### 方式二：检查环境

```bash
# 检测依赖是否齐全
CHECK.bat
```

---

## 🍎 macOS / Linux 安装

```bash
# 1. 下载代码后，进入项目目录
cd Oo-s-project

# 2. 添加执行权限（仅首次需要）
chmod +x install.sh start.sh CHECK.sh

# 3. 一键安装
./install.sh

# 4. 启动后端
./start.sh

# 5. 用浏览器打开 http://127.0.0.1:3000 （推荐）
#    不推荐直接双击 index.html / Live Server（会导致 /api 404）
```

---

## 配置 AI 对话（可选）

AI 对话功能需要通义千问 API Key。

### 获取 API Key

1. 打开 https://dashscope.console.aliyun.com/apiKey
2. 创建 API Key
3. 复制 `.env.example` 为 `.env`，再填入：

```
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
```

> 无 API Key 也能正常使用行情功能，AI 对话不可用

---

## 发布与安全（必须）

- 严禁提交：Futu 账号/密码、API Key/Token、AWS 密钥、本地 `.env`
- 需要对外发布前，建议先清理本地运行数据（保留策略库与表结构）：`python tools/sanitize_db.py`

---

## 启动前端（重要）

统一使用后端地址打开：

- http://127.0.0.1:3000

---

## 接口文档

后端运行在 `http://localhost:3000`

| 接口 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/stock/quote` | GET | code, market | 实时报价 |
| `/api/stock/kline` | GET | code, days, interval, market | K线数据 |
| `/api/stock/full` | GET | code, market | 完整行情 |
| `/api/stock/financial/income` | GET | code | 利润表 |
| `/api/stock/financial/balance` | GET | code | 资产负债表 |
| `/api/stock/financial/cash` | GET | code | 现金流量表 |
| `/api/stock/metrics` | GET | code | 估值指标 |
| `/api/stock/management` | GET | code | 管理层信息 |
| `/api/stock/ranking` | GET | - | 热门榜单 |
| `/api/stock/picker` | GET | - | 智能选股 |
| `/api/stock/related-news` | GET | code | 个股新闻 |
| `/api/news` | GET | - | 财经新闻 |
| `/api/ai/analysis` | GET | code | AI 技术分析 |
| `/api/ai/chat` | POST | message | AI 对话 |
| `/api/technical/dashboard` | GET | code | 技术指标仪表盘 |
| `/api/strategy` | GET/POST | - | 策略管理 |

---

## Futu OpenD（真实模拟盘交易）

本项目已集成 Futu OpenD 的调用封装（仅默认允许 SIMULATE 环境），包括：

- 连接/解锁/账户列表/行情快照
- 从策略库读取策略，使用分钟线（K_1M/K_5M 等）计算信号并自动下单（可启动监控）

### 安全约束

- 默认禁止 REAL 下单（需要显式设置环境变量 `ENABLE_FUTU_REAL=1` 才允许解锁 REAL）
- 严禁把 Futu 账号/密码/Token 写入代码或提交到 Git

### 运行前准备

1. 在本机安装并启动 OpenD（端口默认 11111）
2. 安装 Python 依赖：`pip install -r requirements.txt`
3. 启动后端：`python server.py`
4. 浏览器打开：http://127.0.0.1:3000 → 交易 → 模拟交易 → 真实模拟盘交易（Futu）

### market 参数说明

| 值 | 市场 | 示例 |
|----|------|------|
| `cn` | A股 | 600519（茅台） |
| `us` | 美股 | AAPL、TSLA |
| `hk` | 港股 | 0700（腾讯） |
| `crypto` | 加密货币 | BTC、ETH |

---

## 常见问题

### Q: install.bat 失败怎么办？

1. 检查网络是否正常
2. 以管理员身份运行
3. 检查 Python 是否在 PATH 中：运行 `python --version`

### Q: 提示 "Too Many Requests"（美股数据）

正常，Yahoo Finance 有请求限制。内置了重试机制，稍等片刻再试。

### Q: A股数据获取失败

1. 检查是否安装了 akshare：`CHECK.bat`
2. akshare 需要网络能访问国内金融网站

### Q: AI 对话返回错误

1. 检查 `.env` 是否配置了 `DASHSCOPE_API_KEY`
2. 检查 API Key 是否有效

### Q: 想修改后端端口

编辑 `server.py`，找到 `app.run(port=3000)` 改成其他端口。

---

## 公网部署

### 方案 A：ngrok（最简单）

```bash
# 安装 ngrok
ngrok http 3000

# 将生成的公网地址填入前端
```

### 方案 B：云服务器

1. 在云服务器上运行 `install.sh`
2. 运行 `start.sh`
3. 配置 nginx 反向代理到 3000 端口
4. 域名解析到服务器 IP

### 方案 C：Docker

```bash
docker build -t stock-server .
docker run -d -p 3000:3000 stock-server
```

---

## 数据来源

| 市场 | 数据源 |
|------|--------|
| A股 | akshare（东方财富、同花顺等） |
| 美股 | Yahoo Finance（via openbb / yfinance） |
| 港股 | akshare |
| 加密货币 | Yahoo Finance（via openbb） |

---

## 项目结构

```
Oo-s-project/
├── server.py          # 后端入口（Flask）
├── index.html         # 前端主页
├── script.js          # 前端逻辑
├── style.css          # 样式
├── .env               # 配置文件（勿提交）
├── .env.example       # 配置模板
├── requirements.txt   # Python 依赖
├── START.bat          # Windows 启动脚本
├── START.sh           # macOS/Linux 启动脚本
├── install_windows.bat  # Windows 安装脚本
├── install.sh         # macOS/Linux 安装脚本
├── CHECK.bat          # Windows 环境检测
├── CHECK.sh           # macOS/Linux 环境检测
└── README.md          # 本文件
```

---

## 一键安装命令（手动）

```bash
# Windows PowerShell
irm https://raw.githubusercontent.com/xxx/install.ps1 | iex

# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/xxx/install.sh | bash
```
