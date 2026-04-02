import yfinance as yf

print("=== 测试yfinance获取美股数据 ===")

# 测试获取苹果股票
print("\n1. 获取苹果公司(AAPL)股票信息")
try:
    aapl = yf.Ticker("AAPL")
    info = aapl.info
    print(f"  公司名称: {info.get('longName', 'N/A')}")
    print(f"  当前价格: ${info.get('currentPrice', 'N/A')}")
    
    hist = aapl.history(period="5d")
    print(f"  历史数据: {len(hist)}天")
    if len(hist) > 0:
        latest = hist.iloc[-1]
        print(f"  最新收盘: ${latest['Close']:.2f}")
except Exception as e:
    print(f"  错误: {e}")

# 测试获取微软股票
print("\n2. 获取微软(MSFT)股票信息")
try:
    msft = yf.Ticker("MSFT")
    info = msft.info
    print(f"  公司名称: {info.get('longName', 'N/A')}")
    
    hist = msft.history(period="10d")
    if len(hist) > 1:
        latest = hist.iloc[-1]
        prev = hist.iloc[-2]
        change = latest['Close'] - prev['Close']
        change_pct = (change / prev['Close']) * 100
        print(f"  价格: ${latest['Close']:.2f}")
        print(f"  涨跌: ${change:.2f} ({change_pct:.2f}%)")
except Exception as e:
    print(f"  错误: {e}")

print("\n✅ 测试完成！")
