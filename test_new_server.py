import requests
import json
from pprint import pprint

base_url = 'http://127.0.0.1:3000'
test_code = '600118'

print('='*80)
print('📊 测试新服务器 - 腾讯+雪球双数据源')
print('='*80)

print(f'\n1️⃣ 测试股票数据API (/api/stock/data)')
print('-'*80)
try:
    r = requests.get(f'{base_url}/api/stock/data', params={'code': test_code})
    data = r.json()
    if 'data' in data:
        print(f'✅ 成功获取数据: {data["name"]} ({data["code"]})')
        print(f'   现价: {data["price"]}, 涨跌: {data["change"]} ({data["changePercent"]}%)')
        print(f'   K线数据: {len(data["data"])} 天')
        print(f'   首日K线: {data["data"][0]["date"]} 开={data["data"][0]["open"]} 收={data["data"][0]["close"]}')
        print(f'   末日K线: {data["data"][-1]["date"]} 开={data["data"][-1]["open"]} 收={data["data"][-1]["close"]}')
        if data.get('pe'):
            print(f'   PE: {data["pe"]}')
        if data.get('pb'):
            print(f'   PB: {data["pb"]}')
    else:
        print(f'❌ 失败: {data}')
except Exception as e:
    print(f'❌ 错误: {e}')

print(f'\n2️⃣ 测试实时行情API (/api/stock/quote)')
print('-'*80)
try:
    r = requests.get(f'{base_url}/api/stock/quote', params={'code': test_code})
    data = r.json()
    if 'name' in data:
        print(f'✅ 成功获取行情')
        pprint(data)
    else:
        print(f'❌ 失败: {data}')
except Exception as e:
    print(f'❌ 错误: {e}')

print(f'\n3️⃣ 测试AI分析API (/api/ai/analysis)')
print('-'*80)
try:
    r = requests.get(f'{base_url}/api/ai/analysis', params={'code': test_code})
    data = r.json()
    if data.get('success'):
        print(f'✅ AI分析成功')
        print(f'   置信度: {data["analysis"]["confidence"]}%')
        print(f'   风险等级: {data["analysis"]["risk_level"]}')
        print(f'   建议: {data["analysis"]["recommendation"]}')
    else:
        print(f'❌ 失败: {data}')
except Exception as e:
    print(f'❌ 错误: {e}')

print(f'\n4️⃣ 测试财经新闻API (/api/news)')
print('-'*80)
try:
    r = requests.get(f'{base_url}/api/news')
    data = r.json()
    if data.get('success'):
        print(f'✅ 成功获取 {len(data["data"])} 条新闻')
        for i, news in enumerate(data['data'][:3], 1):
            print(f'   {i}. {news["title"]} ({news["time"]})')
    else:
        print(f'❌ 失败: {data}')
except Exception as e:
    print(f'❌ 错误: {e}')

print('\n' + '='*80)
print('✅ 所有测试完成！')
print('='*80)
