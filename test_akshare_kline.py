import akshare as ak
import sys

print('=== 测试AkShare雪球K线接口 ===\n')

test_code = "SH600118"

print(f'📊 测试 {test_code} 的K线接口...\n')

print('📈 尝试1: stock_individual_history_em...')
try:
    df = ak.stock_individual_history_em(symbol=test_code[2:])
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取 {len(df)} 条数据')
        print(df.tail())
except Exception as e:
    print(f'  ❌ 失败: {e}')

print('\n📈 尝试2: stock_zh_a_hist_tx...')
try:
    df = ak.stock_zh_a_hist_tx(symbol=test_code[2:], period="daily", start_date="20240101", end_date="", adjust="")
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取 {len(df)} 条数据')
        print(df.tail())
except Exception as e:
    print(f'  ❌ 失败: {e}')

print('\n📈 尝试3: stock_zh_a_hist_163...')
try:
    df = ak.stock_zh_a_hist_163(symbol=test_code[2:], period="daily", start_date="20240101", end_date="")
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取 {len(df)} 条数据')
        print(df.tail())
except Exception as e:
    print(f'  ❌ 失败: {e}')

print('\n📈 尝试4: stock_individual_fund_flow_xq...')
try:
    df = ak.stock_individual_fund_flow_xq(symbol=test_code)
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取 {len(df)} 条数据')
        print(df.head())
except Exception as e:
    print(f'  ❌ 失败: {e}')

print('\n📈 尝试5: stock_individual_kline_fund_xq...')
try:
    df = ak.stock_individual_kline_fund_xq(symbol=test_code)
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取 {len(df)} 条数据')
        print(df.tail())
except Exception as e:
    print(f'  ❌ 失败: {e}')

print('\n📈 尝试6: 直接用requests尝试雪球API...')
try:
    import requests
    url = f"https://stock.xueqiu.com/v5/stock/chart/kline.json?symbol={test_code}&begin=1704067200000&period=day&type=before&count=-100&indicator=kline,pe,pb,ps,pcf,market_capital,agt,ggt,balance"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        data = r.json()
        if data.get('error_code') == 0:
            print(f'  ✅ 雪球API成功!')
            items = data.get('data', {}).get('item', [])
            columns = data.get('data', {}).get('column', [])
            print(f'  共 {len(items)} 条K线数据')
            if len(items) > 0:
                print(f'  列: {columns}')
                print(f'  最新: {items[-1]}')
except Exception as e:
    print(f'  ❌ 失败: {e}')
    import traceback
    traceback.print_exc()

print('\n=== 测试完成 ===')
