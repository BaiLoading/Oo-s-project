# 配置文件模板
# 复制此文件为 config.py 并填入你的真实配置

# ==================== 阿里云通义千问配置 ====================

# 阿里云通义千问 API Key
# 获取地址：https://dashscope.console.aliyun.com/apiKey
DASHSCOPE_API_KEY = "your-api-key-here"

# 选择使用的模型
# 可选模型：qwen-turbo, qwen-plus, qwen-max
DASHSCOPE_MODEL = "qwen-turbo"

# ==================== AWS DynamoDB 配置 ====================

# AWS Access Key（建议通过环境变量管理）
# AWS_ACCESS_KEY_ID = "your-access-key-id"
# AWS_SECRET_ACCESS_KEY = "your-secret-access-key"
# AWS_DEFAULT_REGION = "us-east-2"

# DynamoDB 表名
DYNAMODB_TABLE_NAME = "quant_strategy_tb"
