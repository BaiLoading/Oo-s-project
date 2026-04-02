import akshare as ak
import time
from datetime import datetime, timedelta
import pandas as pd
import warnings
warnings.filterwarnings('ignore')
import inspect

print('='*80)
print('📊 测试腾讯接口 (stock_zh_a_hist_tx)')
print('='*80)

func = getattr(ak, 'stock_zh_a_hist_tx')
sig = inspect.signature(func)
print(f'\n函数签名: {sig}')

test_code = "600118"
symbol_tx = f'sh{test_code}'

start_date = (datetime.now() - timedelta(days=100)).strftime('%Y-%m-%d')
end_date = datetime.now().strftime('%Y-%m-%d')

print(f'\n测试参数:')
print(f'  symbol: {symbol_tx}')
print(f'  start_date: {start_date}')
print(f'  end_date: {end_date}')

attempts = 3
df = None

for i in range(attempts):
    print(f'\n尝试 {i+1}/{attempts}...')
    try:
        time.sleep(1)
        df = func(
            symbol=symbol_tx,
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
        import traceback
        traceback.print_exc()

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
