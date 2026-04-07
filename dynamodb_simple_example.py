# DynamoDB 简单使用示例
# 量化策略表 (quant_strategy_tb) - 单主键 user_id

from dynamodb_config import get_table, test_connection
from decimal import Decimal
from datetime import datetime
import json

# ==================== 测试连接 ====================

if __name__ == "__main__":
    # 先测试连接
    result = test_connection()
    print(f"连接测试：{result}\n")
    
    if not result["success"]:
        print("⚠️  请先在 dynamodb_config.py 中配置正确的 AWS 凭证")
        exit(1)

# ==================== 保存策略 ====================

def save_strategy(user_id, strategy_data):
    """
    保存用户策略（如果 user_id 已存在则覆盖）
    
    Args:
        user_id: 用户 ID（主键）
        strategy_data: 策略数据字典
    
    Returns:
        dict: 保存结果
    """
    table = get_table()
    
    item = {
        'user_id': user_id,
        'updated_at': datetime.now().isoformat()
    }
    
    # 合并用户提供的数据
    item.update(strategy_data)
    
    response = table.put_item(Item=item)
    
    return {
        "success": True,
        "user_id": user_id,
        "message": f"策略数据保存成功"
    }

# ==================== 查询策略 ====================

def get_strategy(user_id):
    """
    根据用户 ID 查询策略
    
    Args:
        user_id: 用户 ID
    
    Returns:
        dict: 策略数据
    """
    table = get_table()
    
    response = table.get_item(Key={'user_id': user_id})
    
    if 'Item' in response:
        return {
            "success": True,
            "data": response['Item']
        }
    else:
        return {
            "success": False,
            "message": f"用户 {user_id} 的策略不存在"
        }

# ==================== 删除策略 ====================

def delete_strategy(user_id):
    """
    删除用户策略
    
    Args:
        user_id: 用户 ID
    
    Returns:
        dict: 删除结果
    """
    table = get_table()
    
    response = table.delete_item(Key={'user_id': user_id})
    
    return {
        "success": True,
        "message": f"用户 {user_id} 的策略已删除"
    }

# ==================== 扫描所有策略 ====================

def scan_all_strategies():
    """
    扫描所有策略
    
    Returns:
        dict: 策略列表
    """
    table = get_table()
    
    response = table.scan()
    items = response.get('Items', [])
    
    # 处理分页
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))
    
    return {
        "success": True,
        "count": len(items),
        "data": items
    }

# ==================== 使用示例 ====================

if __name__ == "__main__":
    print("=== DynamoDB 操作示例 ===\n")
    
    # 测试用户 ID
    test_user_id = "user_99sghost"
    
    # 1. 保存策略
    print("1️⃣  保存策略")
    result = save_strategy(
        user_id=test_user_id,
        strategy_data={
            "strategies": [
                {
                    "strategy_id": "strategy_001",
                    "strategy_name": "动量策略 V1",
                    "strategy_type": "momentum",
                    "params": {
                        "lookback_period": 20,
                        "threshold": Decimal("0.05"),
                        "rebalance_days": 5
                    },
                    "status": "active",
                    "created_at": datetime.now().isoformat()
                }
            ],
            "total_count": 1
        }
    )
    print(result)
    
    # 2. 查询策略
    print("\n2️⃣  查询策略")
    result = get_strategy(test_user_id)
    if result["success"]:
        print(f"✅ 查询成功")
        print(json.dumps(result["data"], indent=2, default=str))
    else:
        print(result)
    
    # 3. 更新策略（添加新策略）
    print("\n3️⃣  更新策略")
    existing = get_strategy(test_user_id)
    if existing["success"]:
        strategies = existing["data"].get("strategies", [])
        strategies.append({
            "strategy_id": "strategy_002",
            "strategy_name": "均值回归策略",
            "strategy_type": "mean_reversion",
            "params": {
                "window": 30,
                "entry_threshold": Decimal("-2.0"),
                "exit_threshold": Decimal("0.5")
            },
            "status": "testing",
            "created_at": datetime.now().isoformat()
        })
        
        result = save_strategy(
            user_id=test_user_id,
            strategy_data={
                "strategies": strategies,
                "total_count": len(strategies)
            }
        )
        print(result)
    
    # 4. 扫描所有策略
    print("\n4️⃣  扫描所有策略")
    result = scan_all_strategies()
    print(f"共找到 {result['count']} 个用户的策略")
    for item in result['data']:
        print(f"  - 用户：{item['user_id']}, 策略数：{item.get('total_count', 0)}")
    
    # 5. 删除策略（注释掉，需要时再打开）
    # print("\n5️⃣  删除策略")
    # result = delete_strategy(test_user_id)
    # print(result)
