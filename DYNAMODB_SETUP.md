# DynamoDB 配置指南

## 📦 已配置资源

- **表名：** `quant_strategy_tb`
- **ARN：** `arn:aws:dynamodb:us-east-2:387219500725:table/quant_strategy_tb`
- **区域：** `us-east-2`（俄亥俄）

---

## 🔧 安装依赖

```bash
cd /Users/99sghost/IdeaProjects/Oo-s-project
pip install boto3
```

---

## 🔐 配置 AWS 凭证

### 方式一：环境变量（推荐）

```bash
# 添加到 ~/.zshrc 或 ~/.bash_profile
export AWS_ACCESS_KEY_ID="你的 Access Key ID"
export AWS_SECRET_ACCESS_KEY="你的 Secret Access Key"
export AWS_DEFAULT_REGION="us-east-2"

# 使配置生效
source ~/.zshrc
```

### 方式二：AWS 凭证文件

```bash
# 创建/编辑 ~/.aws/credentials
[default]
aws_access_key_id = 你的 Access Key ID
aws_secret_access_key = 你的 Secret Access Key

# 创建/编辑 ~/.aws/config
[default]
region = us-east-2
output = json
```

### 方式三：代码中配置（仅本地开发）

编辑 `dynamodb_config.py`，填入你的凭证：

```python
AWS_ACCESS_KEY_ID = "你的 Access Key ID"
AWS_SECRET_ACCESS_KEY = "你的 Secret Access Key"
AWS_DEFAULT_REGION = "us-east-2"
```

⚠️ **注意：** 不要将包含真实凭证的代码提交到 Git！

---

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `dynamodb_config.py` | DynamoDB 连接配置（核心文件） |
| `dynamodb_example.py` | CRUD 操作示例代码 |
| `config.example.py` | 配置文件模板（已更新 DynamoDB 配置项） |

---

## 🚀 快速开始

### 1. 测试连接

```bash
python dynamodb_config.py
```

### 2. 运行示例

```bash
python dynamodb_example.py
```

### 3. 在代码中使用

```python
from dynamodb_config import get_table, test_connection

# 测试连接
result = test_connection()
if result["success"]:
    print("✅ 连接成功")
    
    # 获取表对象
    table = get_table()
    
    # 查询数据
    response = table.get_item(Key={'strategy_id': 'your_strategy_id'})
    print(response['Item'])
```

---

## 📊 表结构建议

根据 `quant_strategy_tb` 表名，建议的表结构：

| 字段名 | 类型 | 说明 | 是否主键 |
|--------|------|------|----------|
| `strategy_id` | String | 策略唯一标识 | ✅ 分区键 |
| `strategy_name` | String | 策略名称 | |
| `strategy_type` | String | 策略类型 | |
| `params` | Map | 策略参数 | |
| `status` | String | 状态（active/testing/paused） | |
| `created_at` | String | 创建时间（ISO 格式） | |
| `updated_at` | String | 更新时间（ISO 格式） | |
| `performance` | Map | 绩效数据（可选） | |

---

## 🔒 安全建议

1. **使用 IAM 角色**（如果在 EC2/Lambda 上运行）
2. **最小权限原则**：只授予必要的 DynamoDB 操作权限
3. **使用 Secrets Manager**：生产环境不要硬编码凭证
4. **启用 CloudTrail**：审计所有 DynamoDB API 调用

---

## 📚 参考文档

- [AWS DynamoDB 官方文档](https://docs.aws.amazon.com/dynamodb/)
- [Boto3 DynamoDB 指南](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/dynamodb.html)
- [AWS 凭证配置](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)

---

## ❓ 常见问题

### Q: 连接失败怎么办？
A: 检查以下几点：
1. AWS 凭证是否正确
2. 区域是否匹配（us-east-2）
3. 表名是否正确
4. IAM 权限是否足够

### Q: 如何在 Flask 中集成？
A: 在应用启动时初始化连接：

```python
from flask import Flask
from dynamodb_config import get_table

app = Flask(__name__)
dynamodb_table = get_table()

@app.route('/strategies')
def list_strategies():
    response = dynamodb_table.scan()
    return {'strategies': response['Items']}
```

### Q: 如何本地测试？
A: 使用 DynamoDB Local：

```bash
# 下载并启动 DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# 修改配置连接到本地
dynamodb = boto3.resource('dynamodb', endpoint_url='http://localhost:8000')
```
