import requests
import json

print('=== 测试真实A股API数据 ===\n')

test_stocks = [
    '600118',
    '600000',
    '000858',
]

base_url = 'http://127.0.0.1:3000'

for code in test_stocks:
    try:
        print(f'📊 测试 {code}...')
        
        r = requests.get(f'{base_url}/api/stock/data', params={'code': code}, timeout=10)
        
        if r.status_code == 200:
            data = r.json()
            print(f'  ✅ 成功获取')
            print(f'  名称: {data.get("name")}')
            print(f'  现价: {data.get("price")}')
            print(f'  涨跌: {data.get("change")} ({data.get("changePercent")}%)')
            print(f'  成交量: {data.get("volume"):,}')
            
            kline = data.get('data', [])
            if len(kline) > 0:
                latest = kline[-1]
                print(f'  最新K线:')
                print(f'    日期: {latest.get("date")}')
                print(f'    今开: {latest.get("open")}')
                print(f'    最高: {latest.get("high")}')
                print(f'    最低: {latest.get("low")}')
                print(f'    收盘: {latest.get("close")}')
                print(f'    成交量: {latest.get("volume"):,}')
                print(f'    成交额: {latest.get("amount"):,.0f}')
                
                if len(kline) > 1:
                    prev = kline[-2]
                    print(f'  前一天K线:')
                    print(f'    日期: {prev.get("date")}')
                    print(f'    今开: {prev.get("open")}')
                    print(f'    最高: {prev.get("high")}')
                    print(f'    最低: {prev.get("low")}')
                    print(f'    收盘: {prev.get("close")}')
        else:
            print(f'  ❌ HTTP错误: {r.status_code}')
            
    except Exception as e:
        print(f'  ❌ 请求失败: {e}')
        import traceback
        traceback.print_exc()
    
    print()

print('=== 测试完成 ===')
