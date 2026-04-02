import requests
import json

def test_dfcf_api():
    """测试东方财富API"""
    api_url = 'https://mkapi2.dfcfs.com/finskillshub/api/claw/query'
    api_key = 'mkt_WjPL1KOa-ShxeB2s9PkTAgt-85zKAS0yXSxwV-6fG3k'
    
    print('=' * 80)
    print('📊 测试东方财富API - 获取历史K线数据')
    print('=' * 80)
    
    # 测试不同的查询语句
    test_queries = [
        "贵州茅台 600519 每日收盘价 最近30天",
        "贵州茅台 600519 历史K线 最近30天",
        "贵州茅台 600519 日K线数据",
        "贵州茅台 600519 每日开盘价收盘价最高价最低价 最近30天"
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f'\n🔍 测试 {i}/{len(test_queries)}: {query}')
        print('-' * 80)
        
        try:
            payload = {"toolQuery": query}
            headers = {
                "Content-Type": "application/json",
                "apikey": api_key
            }
            
            response = requests.post(api_url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                print(f'✅ 请求成功！')
                
                # 打印数据结构
                print(f'\n📋 数据结构:')
                if 'data' in data:
                    print(f'  - 顶层data键: {list(data["data"].keys())}')
                    
                    if 'data' in data['data']:
                        print(f'  - 内层data键: {list(data["data"]["data"].keys())}')
                        
                        inner_data = data['data']['data']
                        if 'searchDataResultDTO' in inner_data:
                            search_result = inner_data['searchDataResultDTO']
                            print(f'  - searchDataResultDTO键: {list(search_result.keys())}')
                            
                            if 'dataTableDTOList' in search_result:
                                data_tables = search_result['dataTableDTOList']
                                print(f'  - 找到 {len(data_tables)} 个表格')
                                
                                for j, table in enumerate(data_tables):
                                    print(f'\n    📊 表格 {j+1}:')
                                    print(f'       - 标题: {table.get("title", "N/A")}')
                                    print(f'       - 证券代码: {table.get("code", "N/A")}')
                                    
                                    if 'table' in table:
                                        table_data = table['table']
                                        print(f'       - 表格数据键: {list(table_data.keys())}')
                                        
                                        # 打印一些数据样本
                                        for key, values in table_data.items():
                                            if key != 'headName':
                                                print(f'         {key}: {values[:5]}...')
                    
                # 保存完整响应到文件
                with open(f'dfcf_response_{i}.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f'\n💾 完整响应已保存到 dfcf_response_{i}.json')
                
            else:
                print(f'❌ 请求失败，状态码: {response.status_code}')
                print(f'   响应内容: {response.text[:200]}')
                
        except Exception as e:
            print(f'❌ 测试失败: {e}')
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    test_dfcf_api()
