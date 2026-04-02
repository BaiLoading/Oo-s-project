import akshare as ak
import inspect
import sys
from datetime import datetime, timedelta

print('='*80)
print('📊 全面测试AkShare股票历史数据接口')
print('='*80)

test_code = "600118"
print(f'\n测试股票: {test_code} (中国卫星)\n')

modules = dir(ak)
stock_functions = [name for name in modules if any(keyword in name.lower() for keyword in ['stock', 'zh', 'a_'])]
print(f'找到 {len(stock_functions)} 个可能的股票相关函数\n')

successful_functions = []

for func_name in stock_functions:
    try:
        func = getattr(ak, func_name)
        sig = inspect.signature(func)
        params = list(sig.parameters.values())
        
        print(f'📌 {func_name}')
        print(f'   参数: {[p.name for p in params]}')
        
        if 'symbol' in [p.name for p in params]:
            print(f'   ⚡ 尝试调用...')
            try:
                call_params = {}
                for param in params:
                    if param.name == 'symbol':
                        call_params['symbol'] = test_code
                    elif param.name == 'period' and param.default != inspect.Parameter.empty:
                        call_params['period'] = 'daily'
                    elif param.name == 'start_date' and param.default != inspect.Parameter.empty:
                        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y%m%d')
                        call_params['start_date'] = thirty_days_ago
                    elif param.name == 'end_date' and param.default != inspect.Parameter.empty:
                        call_params['end_date'] = datetime.now().strftime('%Y%m%d')
                    elif param.name == 'adjust' and param.default != inspect.Parameter.empty:
                        call_params['adjust'] = ''
                
                print(f'   调用参数: {call_params}')
                df = func(**call_params)
                
                if df is not None and len(df) > 0:
                    print(f'   ✅ 成功! 共 {len(df)} 条数据')
                    print(f'   列名: {list(df.columns)}')
                    print(f'   前3条数据:')
                    print(df.head(3))
                    print(f'   后3条数据:')
                    print(df.tail(3))
                    successful_functions.append((func_name, df.columns.tolist(), len(df)))
                    print('\n' + '='*80)
                else:
                    print(f'   ⚠️  没有数据返回')
            except Exception as e:
                print(f'   ❌ 调用失败: {type(e).__name__}: {e}')
        print()
    except Exception as e:
        print(f'❌ {func_name} 解析失败: {e}\n')

print('\n' + '='*80)
print('🎉 成功的接口汇总:')
print('='*80)
for name, cols, count in successful_functions:
    print(f'✅ {name}: {count}条数据, 列={cols}')
print(f'\n总计: {len(successful_functions)} 个接口可用')
print('='*80)
