## AWS 部署（EC2 / Ubuntu 示例）

## Elastic Beanstalk（Docker Compose）

如果使用 EB 的 Docker Compose 平台，首次部署需要在实例上执行 `docker compose build`，依赖下载可能超过默认命令超时，导致部署被 EB 中止（TimedOut/Aborted）。

本项目已提供：

- [.ebextensions/01_command_timeout.config](file:///Users/irene/Documents/GitHub/Oo-s-project/.ebextensions/01_command_timeout.config) 将 EB 命令超时提升到 60 分钟
- [.dockerignore](file:///Users/irene/Documents/GitHub/Oo-s-project/.dockerignore) 缩小 build context，避免传输过大

### 1) 上传与解压

将 zip 上传到服务器（例如 /opt/oos），然后：

```bash
sudo mkdir -p /opt/oos
sudo unzip Oo-s-project_release_20260404.zip -d /opt/oos
cd /opt/oos
```

### 2) 安装系统依赖

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip unzip
```

### 3) 安装项目依赖

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

### 4) 配置环境变量（不要写进仓库）

推荐在服务器上创建一个仅 root 可读的环境文件：

```bash
sudo bash -lc 'cat > /etc/oos.env <<EOF
OPENAI_API_KEY=
OPENBB_API_BASE_URL=http://127.0.0.1:6900
ENABLE_FUTU_REAL=0
FUTU_PY_HOME=/opt/oos/.futu_runtime
EOF'
sudo chmod 600 /etc/oos.env
```

### OpenBB 说明

项目读取美股/加密货币数据时会优先走 OpenBB（Python package 或 OpenBB HTTP Server）。在服务器上推荐使用 OpenBB HTTP Server，并在 `/etc/oos.env` 中配置：

```
OPENBB_API_BASE_URL=http://127.0.0.1:6900
```

若没有单独部署 OpenBB Server，也可以不设置该变量，系统会回退到 yfinance 等数据源（功能受限但可运行）。

### 5) 启动（最简单）

```bash
source /etc/oos.env
source .venv/bin/activate
python server.py
```

浏览器访问：

- http://<your-ec2-ip>:3000

### 6) TradingAgents 安装（可选）

TradingAgents 使用独立虚拟环境 `.venv_tradingagents`：

```bash
source .venv/bin/activate
python tools/install_tradingagents.py
```

安装完成后，检查：

- http://<your-ec2-ip>:3000/api/ai/tradingagents/health

### 7) 生产部署建议

- 使用 gunicorn + nginx 反代
- 用 systemd 管理进程
- OpenAI Key 存放在 AWS SSM Parameter Store / Secrets Manager，再注入到环境变量
