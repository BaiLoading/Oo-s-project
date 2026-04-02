# 🚀 股票分析系统 - 部署指南

本文档将帮助你将股票分析系统部署到线上，支持H5和小程序访问。

---

## 📋 目录

1. [快速开始](#快速开始)
2. [云端部署方案](#云端部署方案)
3. [H5部署](#h5部署)
4. [小程序部署](#小程序部署)
5. [二维码生成](#二维码生成)
6. [常见问题](#常见问题)

---

## 快速开始

### 本地测试

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
python server_akshare.py

# 3. 访问 http://localhost:3000
```

---

## 云端部署方案

### 方案1: 使用 Railway（推荐，免费）

Railway 提供免费额度，适合快速部署。

#### 部署步骤：

1. **注册 Railway 账号**
   - 访问: https://railway.app
   - 使用 GitHub 账号登录

2. **准备代码仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # 推送到 GitHub
   ```

3. **在 Railway 部署**
   - 点击 "New Project"
   - 选择 "Deploy from repo"
   - 选择你的 GitHub 仓库
   - 等待部署完成

4. **配置**
   - Railway 会自动检测 Procfile
   - 部署后会分配一个域名，如: `your-app.up.railway.app`

---

### 方案2: 使用 Heroku

#### 部署步骤：

1. **安装 Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # 或访问: https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **登录并创建应用**
   ```bash
   heroku login
   heroku create your-stock-app-name
   ```

3. **部署**
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

4. **打开应用**
   ```bash
   heroku open
   ```

---

### 方案3: 使用 Docker + 云服务器

适用于阿里云、腾讯云、AWS等。

#### 部署步骤：

1. **购买云服务器**
   - 推荐配置: 2核4G, 带宽5Mbps
   - 系统: Ubuntu 20.04+

2. **安装 Docker**
   ```bash
   # 登录服务器后
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

3. **上传代码并部署**
   ```bash
   # 上传代码到服务器
   scp -r /path/to/project user@your-server:/home/user/
   
   # 登录服务器
   ssh user@your-server
   cd /home/user/project
   
   # 使用 Docker Compose 启动
   docker-compose up -d
   ```

4. **配置 Nginx（可选但推荐）**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

5. **配置 HTTPS（使用 Let's Encrypt）**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## H5部署

H5页面部署完成后，可以通过以下方式访问：

### 1. 直接访问域名

部署完成后，直接访问分配的域名即可：
- `https://your-app.up.railway.app`
- `https://your-app.herokuapp.com`
- `https://your-domain.com`

### 2. 移动端适配

当前页面已支持响应式设计，在手机浏览器中打开即可获得良好体验。

### 3. 添加到主屏幕（PWA）

用户可以在浏览器中：
- iOS: 分享 → 添加到主屏幕
- Android: 菜单 → 添加到主屏幕

---

## 小程序部署

### 使用 Taro 框架（推荐）

我们已为你准备好了 Taro 小程序项目框架，位于 `mini-program/` 目录。

#### 步骤1: 准备小程序开发

1. **注册微信小程序**
   - 访问: https://mp.weixin.qq.com
   - 注册小程序账号
   - 获取 AppID

2. **安装开发工具**
   - 下载微信开发者工具: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

#### 步骤2: 配置小程序项目

1. **修改配置**
   - 编辑 `mini-program/project.config.json`
   - 将 `appid` 字段替换为你的小程序 AppID

2. **修改 API 地址**
   - 编辑 `mini-program/config/prod.js`
   - 将 `API_BASE_URL` 修改为你的后端地址

#### 步骤3: 开发和调试

```bash
# 进入小程序目录
cd mini-program

# 安装依赖
npm install

# 开发模式（微信小程序）
npm run dev:weapp

# 开发模式（H5）
npm run dev:h5
```

#### 步骤4: 发布小程序

1. **在微信开发者工具中打开**
   - 打开微信开发者工具
   - 选择 "导入项目"
   - 选择 `mini-program/dist` 目录
   - 填入你的 AppID

2. **上传代码**
   - 点击 "上传" 按钮
   - 填写版本号和项目备注

3. **提交审核**
   - 登录微信公众平台
   - 进入 "版本管理"
   - 提交审核
   - 审核通过后点击 "发布"

---

## 二维码生成

### 生成 H5 二维码

我们提供了 Python 脚本快速生成二维码：

```bash
# 安装依赖
pip install qrcode[pil] pillow

# 生成二维码
python generate_qrcode.py --url "https://your-domain.com" --type h5
```

这会生成 `h5_qrcode.png` 文件。

### 小程序码生成

**方式1: 微信开发者工具（推荐）**

1. 打开微信开发者工具
2. 点击顶部菜单 "工具" → "生成小程序码"
3. 输入页面路径，例如: `pages/index/index`
4. 点击 "生成" 并保存

**方式2: 使用微信 API**

需要在服务器端调用微信 API：

```python
import requests

def get_miniprogram_code(access_token, page='pages/index/index'):
    url = f'https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token={access_token}'
    data = {
        'page': page,
        'width': 430
    }
    response = requests.post(url, json=data)
    return response.content
```

---

## 常见问题

### Q1: AkShare 在服务器上运行慢？

A: 可以考虑：
- 使用国内服务器（推荐阿里云/腾讯云）
- 配置代理（如果服务器在国外）
- 使用缓存机制减少 API 调用

### Q2: 小程序无法请求后端？

A: 需要：
1. 在微信公众平台配置服务器域名（request 合法域名）
2. 后端必须使用 HTTPS
3. 域名需要备案（中国大陆）

### Q3: 如何添加更多小程序页面？

A: 参考 `mini-program/src/pages/index/` 的结构创建新页面，然后在 `app.config.js` 中注册。

### Q4: 可以支持其他小程序平台吗？

A: 可以！Taro 支持：
- 微信小程序
- 支付宝小程序
- 百度小程序
- 抖音小程序
- QQ小程序
- H5

只需运行对应的构建命令即可。

---

## 📞 技术支持

如有问题，请查看：
- AkShare 文档: https://akshare.akfamily.xyz/
- Taro 文档: https://taro-docs.jd.com/
- Flask 文档: https://flask.palletsprojects.com/

---

**祝你部署顺利！🎊**
