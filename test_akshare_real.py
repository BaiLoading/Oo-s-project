import akshare as ak
import sys

print('=== 测试AkShare真实A股数据 ===\n')

test_stocks = [
    ('600519', '贵州茅台'),
    ('600118', '中国卫星'),
    ('601318', '中国平安'),
    ('000001', '平安银行'),
    ('300750', '宁德时代')
]

for code, name in test_stocks:
    try:
        print(f'📊 获取 {code} ({name}) 数据...')
        
        df = ak.stock_zh_a_hist(symbol=code, period="daily", start_date="20240101", end_date="", adjust="")
        
        if df is not None and len(df) > 0:
            print(f'  ✅ 成功获取 {len(df)} 条K线数据')
            
            latest = df.iloc[-1]
            prev = df.iloc[-2] if len(df) > 1 else latest
            
            print(f'  日期: {latest["日期"]}')
            print(f'  开盘: {latest["开盘"]:.2f}')
            print(f'  最高: {latest["最高"]:.2f}')
            print(f'  最低: {latest["最低"]:.2f}')
            print(f'  收盘: {latest["收盘"]:.2f}')
            print(f'  成交量: {latest["成交量"]:,}')
            print(f'  成交额: {latest["成交额"]:,.0f}')
            
            change = latest['收盘'] - prev['收盘']
            change_pct = (change / prev['收盘']) * 100
            print(f'  涨跌: {change:+.2f} ({change_pct:+.2f}%)')
            
            try:
                info_df = ak.stock_individual_info_em(symbol=code)
                if info_df is not None and len(info_df) > 0:
                    name_row = info_df[info_df['item'] == '股票简称']
                    if len(name_row) > 0:
                        real_name = str(name_row.iloc[0]['value'])
                        print(f'  股票名称: {real_name}')
            except:
                pass
        else:
            print(f'  ⚠️  未获取到数据')
            
    except Exception as e:
        print(f'  ❌ 获取失败: {e}')
        import traceback
        traceback.print_exc()
    
    print()

print('=== 测试完成 ===')
