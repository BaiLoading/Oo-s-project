import yfinance as yf
import time

print("=== 测试Yahoo Finance真实数据获取 ===")

tickers = ['AAPL', 'MSFT', 'GOOGL']

for ticker in tickers:
    try:
        print(f"\n正在获取 {ticker} 的数据...")
        time.sleep(1)
        
        stock = yf.Ticker(ticker)
        
        print("  📊 获取历史数据...")
        hist = stock.history(period="30d")
        
        if len(hist) > 0:
            print(f"  ✅ 成功获取 {len(hist)} 天历史数据")
            
            latest = hist.iloc[-1]
            prev = hist.iloc[-2]
            
            print(f"  最新收盘价: ${latest['Close']:.2f}")
            print(f"  涨跌额: ${latest['Close'] - prev['Close']:.2f}")
            print(f"  涨跌幅: {((latest['Close'] - prev['Close']) / prev['Close'] * 100):.2f}%")
            
            print("\n  📈 近5天收盘价:")
            for i in range(min(5, len(hist))):
                idx = -(i+1)
                date = hist.index[idx].strftime('%Y-%m-%d')
                close = hist.iloc[idx]['Close']
                print(f"    {date}: ${close:.2f}")
        else:
            print("  ⚠️  没有获取到历史数据")
            
    except Exception as e:
        print(f"  ❌ 获取 {ticker} 数据失败: {e}")
        import traceback
        traceback.print_exc()

print("\n=== 测试完成 ===")
