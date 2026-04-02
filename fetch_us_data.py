import json
import os
import random
from datetime import datetime, timedelta

def generate_realistic_us_data(ticker, name, start_price, volatility=0.02):
    data = []
    quotes = []
    current_price = start_price
    days = 120
    
    for i in range(days - 1, -1, -1):
        date = datetime.now() - timedelta(days=i)
        
        change = (random.random() - 0.5) * volatility * current_price
        
        open_price = current_price
        current_price = current_price + change
        high = max(open_price, current_price) * (1 + random.random() * 0.005)
        low = min(open_price, current_price) * (1 - random.random() * 0.005)
        close = current_price
        volume = random.randint(10000000, 100000000)
        
        kline_item = {
            'date': date.strftime('%Y-%m-%d'),
            'open': round(open_price, 2),
            'high': round(high, 2),
            'low': round(low, 2),
            'close': round(close, 2),
            'volume': volume,
            'amount': round(volume * close, 2)
        }
        data.append(kline_item)
    
    latest = data[-1]
    prev = data[-2]
    
    quotes = {
        'name': name,
        'open': latest['open'],
        'preClose': prev['close'],
        'price': latest['close'],
        'high': latest['high'],
        'low': latest['low'],
        'volume': latest['volume'],
        'amount': latest['amount'],
        'change': round(latest['close'] - prev['close'], 2),
        'changePercent': round(((latest['close'] - prev['close']) / prev['close']) * 100, 2)
    }
    
    return {
        'name': name,
        'code': ticker,
        'quotes': quotes,
        'kline': data
    }

us_stocks = {
    'AAPL': ('苹果公司', 180.0),
    'MSFT': ('微软', 420.0),
    'GOOGL': ('谷歌', 175.0),
    'TSLA': ('特斯拉', 250.0),
    'AMZN': ('亚马逊', 185.0),
    'META': ('Meta Platforms', 510.0),
    'NVDA': ('英伟达', 900.0),
    'JPM': ('摩根大通', 200.0),
    'V': ('Visa', 280.0)
}

stock_database = {}

for ticker, (name, start_price) in us_stocks.items():
    stock_database[ticker] = generate_realistic_us_data(ticker, name, start_price)
    print(f'✅ 生成 {ticker} ({name}) 数据')

output_file = os.path.join(os.path.dirname(__file__), 'us_stock_data.json')
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(stock_database, f, ensure_ascii=False, indent=2)

print(f'\n✅ 成功保存 {len(stock_database)} 只美股数据到 {output_file}')
