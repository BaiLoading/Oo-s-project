# 检查 DynamoDB 表结构

from dynamodb_config import get_dynamodb_client, get_table, DYNAMODB_TABLE_NAME

# 获取表信息
client = get_dynamodb_client()

response = client.describe_table(TableName=DYNAMODB_TABLE_NAME)

table_info = response['Table']

print("=== 表结构信息 ===\n")
print(f"表名：{table_info['TableName']}")
print(f"状态：{table_info['TableStatus']}")
print(f"项目数量：{table_info['ItemCount']}")
print(f"表大小 (字节): {table_info['TableSizeBytes']}")
print("")

print("=== 键结构 ===")
for key in table_info.get('KeySchema', []):
    print(f"  - {key['AttributeName']} ({key['KeyType']})")
print("")

print("=== 属性定义 ===")
for attr in table_info.get('AttributeDefinitions', []):
    print(f"  - {attr['AttributeName']}: {attr['AttributeType']}")
print("")

print("=== 全局二级索引 (GSI) ===")
for gsi in table_info.get('GlobalSecondaryIndexes', []):
    print(f"  - {gsi['IndexName']}")
    for key in gsi['KeySchema']:
        print(f"      {key['AttributeName']} ({key['KeyType']})")
print("")

print("=== 本地二级索引 (LSI) ===")
for lsi in table_info.get('LocalSecondaryIndexes', []):
    print(f"  - {lsi['IndexName']}")
print("")
