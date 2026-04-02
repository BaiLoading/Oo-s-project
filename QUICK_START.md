# 🚀 快速开始指南 - 5分钟上手指南

## 方案一：最简单 - 使用 Railway（推荐）⭐

### 步骤1: 准备 GitHub 仓库

```bash
# 初始化 git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 创建 GitHub 仓库并推送
# 访问 https://github.com/new 创建新仓库
# 然后按提示推送代码
```

### 步骤2: 在 Railway 部署

1. 访问 https://railway.app
2. 使用 GitHub 登录
3. 点击 "New Project" → "Deploy from repo"
4. 选择你的仓库
5. 等待 2-3 分钟，部署完成！

### 步骤3: 获取你的H5链接

Railway 会给你一个类似这样的链接：
```
https://your-stock-app.up.railway.app
```

### 步骤4: 生成 H5 二维码

```bash
# 安装依赖
pip install qrcode[pil] pillow

# 生成二维码（替换为你的实际链接）
python generate_qrcode.py --url "https://your-stock-app.up.railway.app" --type h5
```

完成！现在你可以用手机扫描 `h5_qrcode.png` 访问了！

---

## 方案二：小程序开发（需要约30分钟）

### 前置准备

1. 注册微信小程序：https://mp.weixin.qq.com
2. 下载微信开发者工具
3. 获取小程序 AppID

### 配置和运行

```bash
# 进入小程序目录
cd mini-program

# 安装依赖
npm install

# 修改配置
# 1. 编辑 project.config.json - 填入你的 AppID
# 2. 编辑 config/prod.js - 修改 API_BASE_URL 为你的后端地址

# 开发微信小程序
npm run dev:weapp
```

### 在微信开发者工具中预览

1. 打开微信开发者工具
2. 导入项目，选择 `mini-program/dist` 目录
3. 填入你的 AppID
4. 点击"编译"即可预览！

---

## 本地开发和测试

### 启动后端服务

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python server_akshare.py
```

### 访问 H5 页面

打开浏览器访问：http://localhost:3000

### 生成本地测试二维码

```bash
python generate_qrcode.py --url "http://localhost:3000" --type h5
```

---

## 文件说明

### 后端文件
- `server_akshare.py` - 主服务器（Flask + AkShare）
- `requirements.txt` - Python 依赖

### 前端文件
- `index.html` - H5 页面
- `script.js` - 前端逻辑
- `style.css` - 样式文件

### 部署相关文件
- `Dockerfile` - Docker 配置
- `docker-compose.yml` - Docker Compose 配置
- `Procfile` - Heroku/Railway 配置
- `serverless.yml` - 腾讯云 Serverless 配置
- `vercel.json` - Vercel 配置

### 小程序相关
- `mini-program/` - Taro 小程序项目
  - `src/pages/` - 页面代码
  - `config/` - 配置文件

### 工具文件
- `generate_qrcode.py` - 二维码生成工具
- `DEPLOY.md` - 详细部署文档
- `QUICK_START.md` - 本文件

---

## 下一步

- 详细部署指南：查看 [DEPLOY.md](./DEPLOY.md)
- 小程序开发：参考 `mini-program/` 目录
- 问题排查：查看 [DEPLOY.md](./DEPLOY.md#常见问题)

---

**需要帮助？查看 [DEPLOY.md](./DEPLOY.md) 获取更详细的说明！**
