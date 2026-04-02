import akshare as ak
import sys

print('=== 测试AkShare其他接口 ===\n')

print('📊 测试接口1: stock_zh_a_spot_em (实时行情)...')
try:
    df = ak.stock_zh_a_spot_em()
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取 {len(df)} 只股票的实时行情')
        print(f'  前5只:')
        print(df[['代码', '名称', '最新价', '涨跌幅']].head())
    else:
        print('  ⚠️  未获取到数据')
except Exception as e:
    print(f'  ❌ 失败: {e}')
    import traceback
    traceback.print_exc()

print('\n📊 测试接口2: stock_zh_index_daily_em (上证指数)...')
try:
    df = ak.stock_zh_index_daily_em(symbol="sh000001", start_date="20240101", end_date="")
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取上证指数 {len(df)} 条数据')
        print(f'  最新:')
        print(df.iloc[-1])
    else:
        print('  ⚠️  未获取到数据')
except Exception as e:
    print(f'  ❌ 失败: {e}')
    import traceback
    traceback.print_exc()

print('\n📊 测试接口3: stock_individual_spot_xq (个股行情)...')
test_code = "SH600519"
try:
    df = ak.stock_individual_spot_xq(symbol=test_code)
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取 {test_code} 数据')
        print(df)
    else:
        print('  ⚠️  未获取到数据')
except Exception as e:
    print(f'  ❌ 失败: {e}')
    import traceback
    traceback.print_exc()

print('\n📊 测试接口4: stock_zh_a_hist_min_em (分钟线)...')
try:
    df = ak.stock_zh_a_hist_min_em(symbol="600519", period="1", start_date="2024-01-01 09:30:00", end_date="", adjust="")
    if df is not None and len(df) > 0:
        print(f'  ✅ 成功获取分钟线 {len(df)} 条数据')
        print(df.head())
    else:
        print('  ⚠️  未获取到数据')
except Exception as e:
    print(f'  ❌ 失败: {e}')
    import traceback
    traceback.print_exc()

print('\n=== 测试完成 ===')
