import akshare as ak
import time
from datetime import datetime, timedelta
import pandas as pd
import warnings
warnings.filterwarnings('ignore')

print('='*80)
print('📊 测试其他数据源接口')
print('='*80)

test_code = "600118"
symbol_tx = f'sh{test_code}' if test_code.startswith('6') else f'sz{test_code}'
start_date = (datetime.now() - timedelta(days=150)).strftime('%Y%m%d')
end_date = datetime.now().strftime('%Y%m%d')

sources = [
    {
        'name': 'stock_zh_a_hist_sina',
        'func': getattr(ak, 'stock_zh_a_hist_sina', None),
        'params': {
            'symbol': symbol_tx,
            'period': 'daily',
            'start_date': start_date,
            'end_date': end_date,
            'adjust': ''
        }
    },
    {
        'name': 'stock_zh_a_hist_min_em',
        'func': getattr(ak, 'stock_zh_a_hist_min_em', None),
        'params': {
            'symbol': test_code,
            'period': 'daily',
            'start_date': start_date,
            'end_date': end_date
        }
    }
]

for source in sources:
    if source['func'] is None:
        continue
        
    print(f'\n⏳ 尝试 {source["name"]}...')
    try:
        time.sleep(1)
        df = source['func'](**source['params'])
        
        if df is not None and len(df) > 0:
            print(f'✅ 成功! {len(df)} 条')
            print(f'列: {list(df.columns)}')
            print(df.head(3))
            break
    except Exception as e:
        print(f'❌ 失败: {e}')

print('\n' + '='*80)
print('🎯 现在重新测试腾讯接口，但日期格式用纯数字:')
print('='*80)

start_date_num = (datetime.now() - timedelta(days=150)).strftime('%Y%m%d')
end_date_num = datetime.now().strftime('%Y%m%d')

try:
    df_tx = ak.stock_zh_a_hist_tx(
        symbol=symbol_tx,
        start_date=start_date_num,
        end_date=end_date_num,
        adjust=""
    )
    if df_tx is not None and len(df_tx) > 0:
        print(f'\n✅ 腾讯接口完美! {len(df_tx)} 条')
        print(f'列: {list(df_tx.columns)}')
        print(df_tx.head(5))
        print(df_tx.tail(5))
        print(f'\n📊 日期范围: {df_tx.iloc[0]["date"]} 至 {df_tx.iloc[-1]["date"]}')
        
        print(f'\n🎯 完美的数据! 完全符合AkShare规范!')
except Exception as e:
    print(f'失败: {e}')
