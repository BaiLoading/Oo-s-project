import akshare as ak
import inspect
from datetime import datetime, timedelta

print('='*80)
print('📊 专门测试AkShare历史K线数据接口')
print('='*80)

test_code = "600118"
print(f'\n测试股票: {test_code} (中国卫星)\n')

kline_candidates = [
    'stock_zh_a_hist',
    'stock_zh_a_hist_em',
    'stock_zh_a_hist_sina',
    'stock_zh_a_hist_tx',
    'stock_zh_a_kline_em',
    'stock_history_em',
    'stock_hist',
    'stock_kline',
]

for func_name in kline_candidates:
    if hasattr(ak, func_name):
        try:
            func = getattr(ak, func_name)
            sig = inspect.signature(func)
            print(f'\n📌 {func_name}')
            print(f'   签名: {sig}')
            
            params = {}
            for param in sig.parameters.values():
                if param.name == 'symbol':
                    params['symbol'] = test_code
                elif param.name == 'period':
                    params['period'] = 'daily'
                elif param.name == 'start_date':
                    thirty_days_ago = (datetime.now() - timedelta(days=90)).strftime('%Y%m%d')
                    params['start_date'] = thirty_days_ago
                elif param.name == 'end_date':
                    params['end_date'] = datetime.now().strftime('%Y%m%d')
                elif param.name == 'adjust':
                    params['adjust'] = ''
            
            print(f'   尝试调用: {params}')
            df = func(**params)
            
            if df is not None and len(df) > 0:
                print(f'   ✅ SUCCESS! 共 {len(df)} 条数据')
                print(f'   列名: {list(df.columns)}')
                print(f'   数据预览:')
                print(df.head())
                print(df.tail())
                
                print(f'\n   🎯 找到可用接口！')
                break
            else:
                print(f'   ⚠️  无数据')
                
        except Exception as e:
            print(f'   ❌ 失败: {type(e).__name__}: {e}')
            import traceback
            traceback.print_exc()

print('\n' + '='*80)
print('现在尝试一些常见的组合...')
print('='*80)

test_cases = [
    ('stock_zh_a_hist', {'symbol': '600118', 'period': 'daily', 'start_date': '20240101', 'end_date': '20260325'}),
    ('stock_zh_a_hist', {'symbol': '600118', 'period': 'daily', 'start_date': '20240101', 'end_date': '20260325', 'adjust': ''}),
    ('stock_zh_a_hist_em', {'symbol': '600118', 'period': 'daily', 'start_date': '20240101', 'end_date': '20260325'}),
]

for func_name, params in test_cases:
    if hasattr(ak, func_name):
        try:
            func = getattr(ak, func_name)
            print(f'\n尝试 {func_name} with {params}...')
            df = func(**params)
            if df is not None and len(df) > 0:
                print(f'✅ 成功! {len(df)} 条')
                print(f'列: {list(df.columns)}')
                print(df.head(3))
                print(df.tail(3))
                break
        except Exception as e:
            print(f'❌ 失败: {e}')
