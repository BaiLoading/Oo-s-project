import akshare as ak
from datetime import datetime, timedelta
import time
import pandas as pd

print('='*80)
print('📊 尝试多个数据源获取历史K线')
print('='*80)

test_code = "600118"
print(f'\n测试股票: {test_code} (中国卫星)\n')

start_date = (datetime.now() - timedelta(days=100)).strftime('%Y%m%d')
end_date = datetime.now().strftime('%Y%m%d')

sources = [
    {
        'name': '东方财富接口 (stock_zh_a_hist_em)',
        'func': ak.stock_zh_a_hist_em,
        'params': {
            'symbol': test_code,
            'period': 'daily',
            'start_date': start_date,
            'end_date': end_date,
            'adjust': ''
        }
    },
    {
        'name': '新浪接口 (stock_zh_a_hist_sina)',
        'func': ak.stock_zh_a_hist_sina,
        'params': {
            'symbol': test_code,
            'period': 'daily',
            'start_date': start_date,
            'end_date': end_date,
            'adjust': ''
        }
    },
    {
        'name': '腾讯接口 (stock_zh_a_hist_tx)',
        'func': ak.stock_zh_a_hist_tx,
        'params': {
            'symbol': f'sh{test_code}' if test_code.startswith('6') else f'sz{test_code}',
            'start_date': start_date,
            'end_date': end_date,
            'adjust': ''
        }
    },
    {
        'name': '历史行情接口 (stock_history_em)',
        'func': ak.stock_history_em,
        'params': {
            'symbol': test_code,
            'period': 'daily',
            'start_date': start_date,
            'end_date': end_date
        }
    }
]

success_df = None
success_name = ''

for source in sources:
    print(f'\n⏳ 尝试: {source["name"]}')
    try:
        time.sleep(1)
        df = source['func'](**source['params'])
        
        if df is not None and len(df) > 0:
            print(f'✅ 成功! 获得 {len(df)} 条数据')
            print(f'   列名: {list(df.columns)}')
            print(f'   数据预览:')
            print(df.head(3))
            print(f'   ...')
            print(df.tail(3))
            
            success_df = df
            success_name = source['name']
            break
        else:
            print(f'⚠️  返回数据为空')
            
    except Exception as e:
        print(f'❌ 失败: {type(e).__name__}: {e}')

print('\n' + '='*80)
if success_df is not None:
    print(f'🎉 成功获取历史数据: {success_name}')
    
    print('\n📊 数据样例:')
    print(success_df)
    
    print(f'\n📈 数据统计:')
    print(f'   总天数: {len(success_df)}')
    if '日期' in success_df.columns:
        print(f'   日期范围: {success_df.iloc[0]["日期"]} 至 {success_df.iloc[-1]["日期"]}')
    
else:
    print('😢 所有数据源都不可用')
print('='*80)
