import akshare as ak
import inspect
import sys

print('='*70)
print('📊 全面探索AkShare所有可用的K线接口')
print('='*70)

test_code = "600118"
print(f'\n测试股票: {test_code} (中国卫星)\n')

modules = dir(ak)
kline_functions = [name for name in modules if any(keyword in name.lower() for keyword in ['kline', 'hist', 'history', 'chart'])]
print(f'找到 {len(kline_functions)} 个可能的K线相关函数:\n')

for func_name in kline_functions:
    try:
        func = getattr(ak, func_name)
        sig = inspect.signature(func)
        print(f'📌 {func_name}')
        print(f'   签名: {sig}')
        
        if 'symbol' in [param.name for param in sig.parameters.values()]:
            print(f'   ⚡ 尝试调用...')
            try:
                if 'period' in [param.name for param in sig.parameters.values()]:
                    df = func(symbol=test_code, period='daily')
                elif 'start_date' in [param.name for param in sig.parameters.values()]:
                    df = func(symbol=test_code, start_date='20240101', end_date='20250325')
                else:
                    df = func(symbol=test_code)
                
                if df is not None and len(df) > 0:
                    print(f'   ✅ 成功! 共 {len(df)} 条数据')
                    print(f'   列: {list(df.columns)}')
                    print(f'   最新5条:')
                    print(df.tail())
                    print('\n' + '='*70)
                    print('🎉 找到可用接口了!')
                    print('='*70)
                    sys.exit(0)
                else:
                    print(f'   ⚠️  没有数据返回')
            except Exception as e:
                print(f'   ❌ 调用失败: {e}')
        print()
    except Exception as e:
        print(f'❌ {func_name} 解析失败: {e}\n')

print('\n' + '='*70)
print('尝试一些常见的组合...')
print('='*70)

common_interfaces = [
    ('stock_zh_a_hist', '东方财富日线'),
    ('stock_zh_a_hist_tx', '腾讯日线'),
    ('index_zh_a_hist', '指数日线'),
    ('stock_us_hist', '美股日线'),
]

for func_name, desc in common_interfaces:
    if hasattr(ak, func_name):
        print(f'\n📌 尝试 {func_name} ({desc})...')
        func = getattr(ak, func_name)
        try:
            sig = inspect.signature(func)
            print(f'   签名: {sig}')
            
            params = {}
            for param in sig.parameters.values():
                if param.name == 'symbol':
                    params['symbol'] = test_code
                elif param.name == 'period':
                    params['period'] = 'daily'
                elif param.name == 'start_date':
                    params['start_date'] = '20240101'
                elif param.name == 'end_date':
                    params['end_date'] = '20250325'
                elif param.name == 'adjust':
                    params['adjust'] = ''
            
            df = func(**params)
            
            if df is not None and len(df) > 0:
                print(f'   ✅ 成功! 共 {len(df)} 条数据')
                print(f'   列: {list(df.columns)}')
                print(f'   最新5条:')
                print(df.tail())
                print('\n' + '='*70)
                print('🎉 找到可用接口了!')
                print('='*70)
                sys.exit(0)
            else:
                print(f'   ⚠️  没有数据')
        except Exception as e:
            print(f'   ❌ 失败: {e}')
            import traceback
            traceback.print_exc()

print('\n' + '='*70)
print('探索完成')
print('='*70)
