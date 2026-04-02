import akshare as ak
import sys

print('=== 探索AkShare所有可用的K线接口 ===\n')

test_code = "600118"
print(f'📊 测试股票: {test_code} (中国卫星)\n')

print('='*60)
print('📈 尝试1: 直接列出akshare的所有可用函数...')
print('='*60)

import inspect
modules = dir(ak)
print(f'AkShare模块共有 {len(modules)} 个函数/属性')

print('\n📋 查找包含 "kline", "hist", "history" 的函数:')
for name in modules:
    if any(keyword in name.lower() for keyword in ['kline', 'hist', 'history']):
        print(f'  - {name}')

print('\n'+'='*60)
print('📈 尝试2: 测试几个常见的K线接口...')
print('='*60)

interfaces_to_try = [
    ('stock_zh_a_hist', '东方财富日线'),
    ('stock_zh_a_hist_tx', '腾讯日线'),
    ('stock_zh_a_hist_sina', '新浪日线'),
    ('stock_zh_a_hist_163', '网易日线'),
    ('stock_individual_history_em', '东方财富个股历史'),
]

for func_name, desc in interfaces_to_try:
    try:
        if hasattr(ak, func_name):
            print(f'\n🔍 测试 {func_name} ({desc})...')
            func = getattr(ak, func_name)
            sig = inspect.signature(func)
            print(f'  函数签名: {sig}')
            
            try:
                df = func(symbol=test_code)
                if df is not None and len(df) > 0:
                    print(f'  ✅ 成功! 共 {len(df)} 条数据')
                    print(f'  列: {list(df.columns)}')
                    print(f'  最新5条:')
                    print(df.tail())
            except Exception as e:
                print(f'  ⚠️  参数错误: {e}')
                print(f'  尝试其他参数组合...')
                
        else:
            print(f'\n⚠️  {func_name} 函数不存在')
            
    except Exception as e:
        print(f'\n❌ 测试 {func_name} 失败: {e}')

print('\n'+'='*60)
print('📈 尝试3: 雪球相关接口...')
print('='*60)

xq_functions = [name for name in modules if 'xq' in name.lower()]
print(f'雪球相关函数: {xq_functions}')

for func_name in xq_functions:
    try:
        func = getattr(ak, func_name)
        sig = inspect.signature(func)
        print(f'\n🔍 {func_name}: {sig}')
    except:
        pass

print('\n=== 探索完成 ===')
