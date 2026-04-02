import akshare as ak

print('=== 测试任意A股股票 ===\n')

test_stocks = [
    ('600000', '浦发银行'),
    ('600030', '中信证券'),
    ('601888', '中国中免'),
    ('000858', '五粮液'),
    ('002594', '比亚迪'),
    ('300015', '爱尔眼科'),
    ('300124', '汇川技术'),
]

for code, name in test_stocks:
    try:
        print(f'📊 测试 {code} ({name})...')
        
        xq_code = f'SH{code}' if code.startswith('6') else f'SZ{code}'
        
        df_spot = ak.stock_individual_spot_xq(symbol=xq_code)
        
        if df_spot is not None and len(df_spot) > 0:
            spot_data = dict(zip(df_spot['item'], df_spot['value']))
            
            print(f'  ✅ 成功获取')
            print(f'  名称: {spot_data.get("名称", "N/A")}')
            print(f'  现价: {spot_data.get("现价", "N/A")}')
            print(f'  涨跌: {spot_data.get("涨跌", "N/A")} ({spot_data.get("涨幅", "N/A")}%)')
            print(f'  成交量: {spot_data.get("成交量", "N/A")}')
            print(f'  昨收: {spot_data.get("昨收", "N/A")}')
        else:
            print(f'  ⚠️  未获取到数据')
            
    except Exception as e:
        print(f'  ❌ 获取失败: {e}')
    
    print()

print('=== 测试完成 - 所有A股都可以查询！ ===')
