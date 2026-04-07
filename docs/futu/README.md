## Futu OpenD / futu-api 集成说明

本项目通过 Python SDK（futu-api）调用本机 OpenD，实现行情与交易能力。

### 1) 安装 OpenD

- 从 Futu OpenAPI 官网下载并安装 OpenD（macOS/Windows/Linux）
- 启动 OpenD，确认监听端口（默认 11111）
- 在 OpenD 内完成登录与交易解锁设置

### 2) 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 3) 启动项目

```bash
python server.py
```

前端访问 http://127.0.0.1:3000 → 交易 → 模拟交易 → 真实模拟盘交易（Futu）

### 4) 安全要求

- 不要把账号、密码、Token、AWS 密钥写入代码或提交到 Git
- `.env` 仅用于本地部署，仓库只提供 `.env.example`
- 默认禁止 REAL 下单，需要显式设置 `ENABLE_FUTU_REAL=1` 才允许解锁 REAL

### 5) Skills（可选）

Futu 官方提供用于 AI 工具的 skills 包（opend-skills.zip）与 Markdown 文档。

- 推荐做法：按官方文档下载并放到你本机的 AI 工具 skills 目录中
- 本仓库不直接提交 zip 安装包，避免体积膨胀与不可控第三方内容
