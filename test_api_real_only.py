import requests
import json

base_url = 'http://127.0.0.1:3000'

print('='*70)
print('📊 测试完全真实的A股API数据')
print('='*70)

test_stocks = ['600118', '600000', '000858']

for code in test_stocks:
    print(f'\n📊 测试 {code}...')
    try:
        r = requests.get(f'{base_url}/api/stock/full', params={'code': code})
        data = r.json()
        
        if r.status_code == 200:
            quote = data.get('quote', {})
            kline = data.get('kline', [])
            
            print(f'  ✅ 成功获取')
            print(f'  名称: {quote["name"]}')
            print(f'  现价: {quote["price"]}')
            print(f'  昨收: {quote["preClose"]}')
            print(f'  今开: {quote["open"]}')
            print(f'  最高: {quote["high"]}')
            print(f'  最低: {quote["low"]}')
            print(f'  成交量: {quote["volume"]:,}')
            print(f'  成交额: {quote["amount"]:,.0f}')
            print(f'  是模拟数据: {quote.get("isMock", "unknown")}')
            
            if len(kline) > 0:
                print(f'\n  K线数据 (共 {len(kline)} 条):')
                for i, k in enumerate(kline):
                    print(f'    {i+1}. {k["date"]}: 开={k["open"]}, 高={k["high"]}, 低={k["low"]}, 收={k["close"]}, 量={k["volume"]}, 额={k["amount"]}')
            else:
                print(f'\n  ⚠️  无K线数据')
        else:
            print(f'  ❌ 失败: {data}')
    except Exception as e:
        print(f'  ❌ 错误: {e}')

print('\n' + '='*70)
print('测试完成')
print('='*70)
