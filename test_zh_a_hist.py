import akshare as ak
import time
from datetime import datetime, timedelta
import pandas as pd
import warnings
warnings.filterwarnings('ignore')

print('='*80)
print('📊 直接测试stock_zh_a_hist接口')
print('='*80)

test_code = "600118"
start_date = (datetime.now() - timedelta(days=200)).strftime('%Y%m%d')
end_date = datetime.now().strftime('%Y%m%d')

print(f'\n测试代码: {test_code}')
print(f'日期范围: {start_date} 到 {end_date}\n')

attempts = 3
df = None

for i in range(attempts):
    print(f'尝试 {i+1}/{attempts}...')
    try:
        time.sleep(2)
        df = ak.stock_zh_a_hist(
            symbol=test_code,
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust=""
        )
        
        if df is not None and len(df) > 0:
            print(f'✅ 成功! 获得 {len(df)} 条数据\n')
            break
        else:
            print('⚠️  返回数据为空')
            
    except Exception as e:
        print(f'❌ 失败: {type(e).__name__}: {e}')

if df is not None and len(df) > 0:
    print('='*80)
    print('📊 数据详情:')
    print('='*80)
    
    print(f'\n列名: {list(df.columns)}')
    print(f'\n数据形状: {df.shape}')
    
    print(f'\n前10条数据:')
    print(df.head(10))
    
    print(f'\n后10条数据:')
    print(df.tail(10))
    
    print(f'\n数据类型:')
    print(df.dtypes)
    
    print(f'\n日期范围:')
    print(f'  开始: {df.iloc[0]["日期"]}')
    print(f'  结束: {df.iloc[-1]["日期"]}')
    
    print(f'\n统计信息:')
    print(f'  开盘价范围: {df["开盘"].min():.2f} - {df["开盘"].max():.2f}')
    print(f'  收盘价范围: {df["收盘"].min():.2f} - {df["收盘"].max():.2f}')
    print(f'  最高价范围: {df["最高"].min():.2f} - {df["最高"].max():.2f}')
    print(f'  最低价范围: {df["最低"].min():.2f} - {df["最低"].max():.2f}')
    print(f'  成交量范围: {df["成交量"].min():.0f} - {df["成交量"].max():.0f}')
    print(f'  成交额范围: {df["成交额"].min():.0f} - {df["成交额"].max():.0f}')
    
    print('\n' + '='*80)
    print('🎯 找到完整接口，可以使用!')
    print('='*80)
    
    df.to_csv(f'test_data_{test_code}.csv', index=False)
    print(f'\n数据已保存到: test_data_{test_code}.csv')
    
else:
    print('\n' + '='*80)
    print('😢 接口暂时不可用')
    print('='*80)
