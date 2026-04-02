import requests
import time
import json
from datetime import datetime, timedelta

print('=== 直接从雪球API获取K线数据 ===\n')

test_stocks = [
    ('SH600118', '中国卫星'),
    ('SH600519', '贵州茅台'),
    ('SZ000858', '五粮液'),
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Origin': 'https://xueqiu.com',
    'Referer': 'https://xueqiu.com/',
}

session = requests.Session()
session.headers.update(headers)

for code, name in test_stocks:
    try:
        print(f'📊 获取 {code} ({name}) K线数据...')
        
        begin_date = datetime.now() - timedelta(days=120)
        begin_ts = int(begin_date.timestamp() * 1000)
        
        url = f"https://stock.xueqiu.com/v5/stock/chart/kline.json"
        params = {
            'symbol': code,
            'begin': begin_ts,
            'period': 'day',
            'type': 'before',
            'count': -120,
            'indicator': 'kline,pe,pb,ps,pcf,market_capital,agt,ggt,balance'
        }
        
        r = session.get(url, params=params, timeout=10)
        
        if r.status_code == 200:
            data = r.json()
            if data.get('error_code') == 0:
                items = data.get('data', {}).get('item', [])
                columns = data.get('data', {}).get('column', [])
                
                print(f'  ✅ 成功获取 {len(items)} 条K线数据')
                print(f'  列: {columns}')
                
                if len(items) > 0:
                    print(f'  最新数据:')
                    latest = items[-1]
                    print(f'    日期: {datetime.fromtimestamp(latest[0]/1000).strftime("%Y-%m-%d")}')
                    print(f'    开盘: {latest[1]}')
                    print(f'    最高: {latest[2]}')
                    print(f'    最低: {latest[3]}')
                    print(f'    收盘: {latest[4]}')
                    print(f'    成交量: {latest[5]}')
                    print(f'    成交额: {latest[6]}')
                    print(f'    换手率: {latest[8] if len(latest) > 8 else "N/A"}%')
            else:
                print(f'  ❌ API错误: {data.get("error_description")}')
        else:
            print(f'  ❌ HTTP错误: {r.status_code}')
            print(f'  响应: {r.text[:200]}')
            
    except Exception as e:
        print(f'  ❌ 获取失败: {e}')
        import traceback
        traceback.print_exc()
    
    print()
    time.sleep(1)

print('=== 测试完成 ===')
