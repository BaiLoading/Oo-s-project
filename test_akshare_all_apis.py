import akshare as ak
import datetime

print('='*80)
print('📊 全面测试AkShare所有可用接口')
print('='*80)

print(f'\n🔍 AkShare版本: {ak.__version__}')

print('\n' + '='*80)
print('1️⃣ 测试 stock_zh_a_hist_em 接口 (东方财富来源)')
print('='*80)

end_date = datetime.datetime.now().strftime('%Y%m%d')
start_date = (datetime.datetime.now() - datetime.timedelta(days=60)).strftime('%Y%m%d')

try:
    df = ak.stock_zh_a_hist_em(
        symbol="600519",
        period="daily",
        start_date=start_date,
        end_date=end_date,
        adjust=""
    )
    print(f'✅ 成功获取 {len(df)} 天数据')
    print(f'   列名: {list(df.columns)}')
    print(df.head())
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n' + '='*80)
print('2️⃣ 测试 stock_individual_info_em 接口')
print('='*80)

try:
    df_info = ak.stock_individual_info_em(symbol="600519")
    print(f'✅ 成功获取个股信息')
    print(df_info)
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n' + '='*80)
print('3️⃣ 测试 stock_zh_a_spot_em 接口 (实时行情)')
print('='*80)

try:
    df_spot = ak.stock_zh_a_spot_em()
    print(f'✅ 成功获取 {len(df_spot)} 只股票实时行情')
    print(f'   列名: {list(df_spot.columns)}')
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n' + '='*80)
print('4️⃣ 测试 stock_zh_a_hist_min_em 接口 (分钟K线)')
print('='*80)

try:
    df_min = ak.stock_zh_a_hist_min_em(symbol="600519", period="1", start_date=start_date, end_date=end_date, adjust="")
    print(f'✅ 成功获取 {len(df_min)} 条分钟数据')
    print(f'   列名: {list(df_min.columns)}')
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n' + '='*80)
print('5️⃣ 测试 stock_zh_a_hist_sina 接口 (新浪来源)')
print('='*80)

try:
    df_sina = ak.stock_zh_a_hist_sina(symbol="sh600519", period="daily", start_date=start_date, end_date=end_date, adjust="")
    print(f'✅ 成功获取 {len(df_sina)} 天数据')
    print(f'   列名: {list(df_sina.columns)}')
    print(df_sina.head())
except Exception as e:
    print(f'❌ 失败: {e}')
