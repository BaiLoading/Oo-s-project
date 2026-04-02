import requests
import json

base_url = 'http://127.0.0.1:3000'

print('='*70)
print('📊 测试新功能：财经新闻和AI分析')
print('='*70)

print('\n1️⃣ 测试财经新闻API...')
try:
    r = requests.get(f'{base_url}/api/news')
    data = r.json()
    if data.get('success'):
        print(f'✅ 成功获取 {len(data["data"])} 条新闻')
        for i, news in enumerate(data['data'][:3], 1):
            print(f'   {i}. {news["title"]} ({news["time"]})')
    else:
        print('❌ 失败')
except Exception as e:
    print(f'❌ 错误: {e}')

print('\n2️⃣ 测试AI分析API...')
test_code = '600118'
try:
    r = requests.get(f'{base_url}/api/ai/analysis', params={'code': test_code})
    data = r.json()
    if data.get('success'):
        print(f'✅ AI分析成功: {data["stock"]["name"]}')
        print(f'   置信度: {data["analysis"]["confidence"]}%')
        print(f'   风险等级: {data["analysis"]["risk_level"]}')
        print(f'   建议: {data["analysis"]["recommendation"][:50]}...')
    else:
        print(f'❌ 失败: {data}')
except Exception as e:
    print(f'❌ 错误: {e}')
    import traceback
    traceback.print_exc()

print('\n3️⃣ 测试股票数据API（验证K线恢复）...')
try:
    r = requests.get(f'{base_url}/api/stock/data', params={'code': test_code})
    data = r.json()
    if 'data' in data:
        print(f'✅ 成功获取K线数据: {len(data["data"])} 天')
        latest = data['data'][-1]
        print(f'   最新: {latest["date"]} 开={latest["open"]} 收={latest["close"]}')
    else:
        print('❌ 失败')
except Exception as e:
    print(f'❌ 错误: {e}')

print('\n' + '='*70)
print('测试完成')
print('='*70)
