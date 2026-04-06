# DynamoDB 配置
# 用于连接 AWS DynamoDB 量化策略表

import os
import boto3
from botocore.config import Config

# ==================== 配置区域 ====================

# AWS 凭证（建议通过环境变量或 AWS Secrets Manager 管理）
# 方式 1：环境变量（推荐生产环境）
#   export AWS_ACCESS_KEY_ID=your_key
#   export AWS_SECRET_ACCESS_KEY=your_secret
#   export AWS_DEFAULT_REGION=us-east-2

# 方式 2：代码中配置（仅用于本地开发测试）
# ⚠️ 生产环境请使用环境变量或 AWS Secrets Manager
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "YOUR_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "YOUR_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-2")

# DynamoDB 表配置
DYNAMODB_TABLE_NAME = "quant_strategy_tb"
DYNAMODB_TABLE_ARN = "arn:aws:dynamodb:us-east-2:387219500725:table/quant_strategy_tb"

# ==================== 客户端初始化 ====================

def get_dynamodb_resource():
    """
    获取 DynamoDB Resource 对象（用于 ORM 风格操作）
    返回：boto3.resources.factory.dynamodb.ServiceResource
    """
    return boto3.resource(
        'dynamodb',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_DEFAULT_REGION,
        config=Config(
            retries={'max_attempts': 3, 'mode': 'standard'}
        )
    )

def get_dynamodb_client():
    """
    获取 DynamoDB Client 对象（用于低级 API 操作）
    返回：boto3.DynamoDB.Client
    """
    return boto3.client(
        'dynamodb',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_DEFAULT_REGION,
        config=Config(
            retries={'max_attempts': 3, 'mode': 'standard'}
        )
    )

def get_table():
    """
    获取量化策略表对象
    返回：boto3.resources.factory.dynamodb.Table
    """
    dynamodb = get_dynamodb_resource()
    return dynamodb.Table(DYNAMODB_TABLE_NAME)

# ==================== 连接测试 ====================

def test_connection():
    """
    测试 DynamoDB 连接是否正常
    返回：dict - 包含连接状态和表信息
    """
    try:
        table = get_table()
        response = table.load()
        
        return {
            "success": True,
            "table_name": table.name,
            "status": "connected",
            "message": f"成功连接到表：{table.name}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "DynamoDB 连接失败"
        }

# ==================== 使用示例 ====================

if __name__ == "__main__":
    # 测试连接
    result = test_connection()
    print(f"连接测试结果：{result}")
    
    # 示例：查询表
    # table = get_table()
    # response = table.get_item(Key={'strategy_id': 'test_001'})
    # print(response)
