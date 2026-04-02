import akshare as ak
import datetime

print('='*80)
print('📊 测试更多AkShare接口')
print('='*80)

print('\n🔍 测试 stock_zh_index_daily_em 接口 (指数)')
try:
    df_index = ak.stock_zh_index_daily_em(symbol="sh000001")
    print(f'✅ 成功获取 {len(df_index)} 天指数数据')
    print(df_index.tail())
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n🔍 测试 stock_zh_a_daily 接口')
try:
    df_daily = ak.stock_zh_a_daily(symbol="sh600519", adjust="")
    print(f'✅ 成功获取 {len(df_daily)} 天数据')
    print(df_daily.tail())
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n🔍 测试 stock_info_a_code_name 接口 (股票代码和名称)')
try:
    df_code = ak.stock_info_a_code_name()
    print(f'✅ 成功获取 {len(df_code)} 只股票')
    print(df_code.head())
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n🔍 测试 stock_fund_individual_spot_em 接口')
try:
    df_fund = ak.stock_fund_individual_spot_em(symbol="600519")
    print(f'✅ 成功获取资金数据')
    print(df_fund)
except Exception as e:
    print(f'❌ 失败: {e}')

print('\n🔍 检查之前保存的真实数据文件...')
import os
if os.path.exists('akshare_test_data.csv'):
    print('✅ 找到 akshare_test_data.csv 文件')
    import pandas as pd
    df = pd.read_csv('akshare_test_data.csv')
    print(f'   数据行数: {len(df)}')
    print(f'   列名: {list(df.columns)}')
    print(f'   最新数据:')
    print(df.tail())
else:
    print('❌ 未找到 akshare_test_data.csv')
