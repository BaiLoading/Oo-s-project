import akshare as ak
import sys

print('=== 测试AkShare雪球接口 ===\n')

test_stocks = [
    ('SH600519', '贵州茅台'),
    ('SH600118', '中国卫星'),
    ('SH601318', '中国平安'),
    ('SZ000001', '平安银行'),
    ('SZ300750', '宁德时代')
]

for code, name in test_stocks:
    try:
        print(f'📊 获取 {code} ({name}) 数据...')
        
        df_spot = ak.stock_individual_spot_xq(symbol=code)
        
        if df_spot is not None and len(df_spot) > 0:
            spot_data = dict(zip(df_spot['item'], df_spot['value']))
            print(f'  ✅ 实时行情获取成功')
            print(f'  名称: {spot_data.get("名称", "N/A")}')
            print(f'  现价: {spot_data.get("现价", "N/A")}')
            print(f'  涨跌: {spot_data.get("涨跌", "N/A")}')
            print(f'  涨幅: {spot_data.get("涨幅", "N/A")}%')
            print(f'  成交量: {spot_data.get("成交量", "N/A")}')
            print(f'  时间: {spot_data.get("时间", "N/A")}')
            
        print(f'  📈 尝试获取历史K线...')
        try:
            df_kline = ak.stock_individual_fund_flow_rank_xq(symbol=code)
            if df_kline is not None and len(df_kline) > 0:
                print(f'  ✅ K线数据获取成功, 共 {len(df_kline)} 条')
                print(df_kline.head())
        except Exception as e:
            print(f'  ⚠️  K线获取失败: {e}')
        
    except Exception as e:
        print(f'  ❌ 获取失败: {e}')
        import traceback
        traceback.print_exc()
    
    print()

print('=== 测试完成 ===')
