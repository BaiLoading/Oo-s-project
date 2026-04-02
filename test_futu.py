from futu import *
import time

print("=== 测试富途API连接 ===")
print("注意：使用富途API需要：")
print("  1. 安装并启动富途OpenD程序")
print("  2. 登录富途牛牛账号")
print("  3. OpenD运行在 127.0.0.1:11111")
print()

try:
    print("正在连接富途OpenD...")
    quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
    print("✅ 成功连接富途OpenD!")
    
    test_tickers = ['US.AAPL', 'US.MSFT', 'US.TSLA']
    
    for ticker in test_tickers:
        try:
            print(f"\n📊 获取 {ticker} 数据...")
            
            ret_sub, err_message = quote_ctx.subscribe([ticker], [SubType.RT_DATA, SubType.K_DAY], subscribe_push=False)
            
            if ret_sub == RET_OK:
                print(f"  ✅ 订阅成功")
                
                ret, data = quote_ctx.get_rt_data(ticker)
                if ret == RET_OK:
                    print(f"  ✅ 获取实时数据成功")
                    if len(data) > 0:
                        latest = data.iloc[-1]
                        print(f"  股票名称: {latest['name']}")
                        print(f"  当前价格: ${latest['cur_price']:.2f}")
                        print(f"  昨收价: ${latest['last_close']:.2f}")
                        print(f"  均价: ${latest['avg_price']:.2f}")
                        print(f"  成交量: {latest['volume']}")
                
                ret, kline_data = quote_ctx.get_history_kline(ticker, start='2024-01-01', end=None, ktype=KLType.K_DAY, autype=AuType.QFQ)
                if ret == RET_OK:
                    print(f"  ✅ 获取K线数据成功，共 {len(kline_data)} 条")
                    if len(kline_data) > 1:
                        latest = kline_data.iloc[-1]
                        prev = kline_data.iloc[-2]
                        change = latest['close'] - prev['close']
                        change_pct = (change / prev['close']) * 100
                        print(f"  最新收盘价: ${latest['close']:.2f}")
                        print(f"  涨跌: ${change:.2f} ({change_pct:.2f}%)")
            else:
                print(f"  ❌ 订阅失败: {err_message}")
                
        except Exception as e:
            print(f"  ❌ 获取 {ticker} 数据失败: {e}")
            import traceback
            traceback.print_exc()
    
    quote_ctx.close()
    print("\n✅ 测试完成!")
    
except Exception as e:
    print(f"\n❌ 连接失败: {e}")
    print("\n可能的原因:")
    print("  1. 富途OpenD程序未启动")
    print("  2. 未登录富途牛牛账号")
    print("  3. 端口11111被占用")
    print("\n解决方案:")
    print("  1. 下载并安装富途OpenD")
    print("  2. 启动OpenD并登录账号")
    print("  3. 确保OpenD运行在127.0.0.1:11111")
    import traceback
    traceback.print_exc()
