# A股/美股/加密货币 统一分析平台

## 启动流程

### 1. 启动后端
```powershell
cd D:\代码仓库\Oo-s-project
python server.py
```
服务地址：`http://localhost:3000`

### 2. 访问前端
```
http://localhost:3000
```

---

## 技术架构

### 数据源

| 市场 | 数据源 | 接口 |
|------|--------|------|
| A股（沪深） | akshare（主） | `/api/stock/full?code=600519&market=cn` |
| 美股 | OpenBB Package | `/api/stock/full?code=MU&market=us` |
| 港股 | OpenBB Package | `/api/stock/full?code=0700.HK&market=hk` |
| 加密货币 | OpenBB Package | `/api/stock/full?code=BTC-USD&market=crypto` |

### 统一接口

- `GET /api/stock/full?code=代码&market=类型` — 完整行情 + K线
- `GET /api/stock/quote?code=代码&market=类型` — 实时报价
- `GET /api/stock/kline?code=代码&market=类型&days=120` — 历史K线
- `GET /api/news` — 财经新闻
- `GET /api/stock/ranking` — 热门股票榜单
- `GET /api/stock/picker` — 智能选股（akshare + 通义千问理由）
- `GET /api/stock/related-news?code=代码` — 个股新闻
- `GET /api/ai/analysis?code=代码` — AI 技术分析
- `GET /api/ai/chat` (POST) — AI 聊天（带记忆）
- `GET /api/technical/dashboard?code=代码` — 技术指标仪表盘（RSI/MACD/KDJ/布林带/ADX/EMA）
- `GET /api/stock/financial/income?code=代码` — 利润表
- `GET /api/stock/financial/balance?code=代码` — 资产负债表
- `GET /api/stock/financial/cash?code=代码` — 现金流量表
- `GET /api/stock/metrics?code=代码` — 估值指标（PE/ROE/市值等）
- `GET /api/stock/management?code=代码` — 管理层信息
- `POST /api/ai/tradingagents/report` — TradingAgents 研报（需 OPENAI_API_KEY）
- `GET /api/strategy` — 投资策略管理

### 冲突接口双格式兼容

`/api/stock/quote`、`/api/stock/kline`、`/api/stock/full` 同时返回两套字段名，兼容新旧前端：

```json
{
  "price": 1680,
  "last_price": 1680,
  "preClose": 1670,
  "prev_close": 1670,
  "changePercent": 2.35,
  "change_percent": 0.0235
}
```

---

## 环境要求

- Python 3.11+
- akshare
- OpenBB (`pip install openbb`)
- dashscope（可选，通义千问 API）
- Flask + flask-cors

安装依赖：
```bash
pip install -r requirements.txt
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `server.py` | **唯一的**后端服务器（统一版本） |
| `index.html` | 前端页面 |
| `script.js` | 前端逻辑 |
| `style.css` | 前端样式 |
| `config.example.py` | 配置文件示例 |
| `tradingagents_runner.py` | TradingAgents 研报 runner |
| `investment_strategies.json` | 策略存储（运行时生成） |
| `user_memory.json` | AI 聊天记忆（运行时生成） |
