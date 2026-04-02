import akshare as ak

print('='*70)
print('📊 雪球接口详细信息探索')
print('='*70)

test_codes = ['SH600118', 'SZ000858', 'SH600000']

for code in test_codes:
    print(f'\n📌 测试 {code}...')
    try:
        df = ak.stock_individual_spot_xq(symbol=code)
        if df is not None and len(df) > 0:
            print(f'   ✅ 成功获取，共 {len(df)} 条信息')
            print(f'\n   所有字段:')
            for _, row in df.iterrows():
                print(f'     {row["item"]}: {row["value"]}')
    except Exception as e:
        print(f'   ❌ 失败: {e}')

print('\n' + '='*70)
print('尝试其他雪球相关接口...')
print('='*70)

other_functions = [
    ('stock_hot_deal_xq', '热门交易'),
    ('stock_hot_follow_xq', '热门关注'),
    ('stock_individual_basic_info_xq', '个股基本信息'),
]

for func_name, desc in other_functions:
    if hasattr(ak, func_name):
        print(f'\n📌 尝试 {func_name} ({desc})...')
        try:
            func = getattr(ak, func_name)
            if 'symbol' in [p.name for p in __import__('inspect').signature(func).parameters.values()]:
                df = func(symbol='SH600118')
                if df is not None and len(df) > 0:
                    print(f'   ✅ 成功!')
                    print(df)
            else:
                df = func()
                if df is not None and len(df) > 0:
                    print(f'   ✅ 成功!')
                    print(df.head())
        except Exception as e:
            print(f'   ❌ 失败: {e}')

print('\n' + '='*70)
print('探索完成')
print('='*70)
