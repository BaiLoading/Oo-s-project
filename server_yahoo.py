from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import yfinance as yf
import random
import re
import json
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

STOCK_DATA_FILE = os.path.join(os.path.dirname(__file__), 'stock_data.json')
stock_database = {}

def load_stock_data():
    global stock_database
    try:
        with open(STOCK_DATA_FILE, 'r', encoding='utf-8') as f:
            stock_database = json.load(f)
        print(f'✅ 成功加载 {len(stock_database)} 只A股的历史数据')
    except Exception as e:
        print(f'⚠️  加载A股数据失败: {e}')
        stock_database = {}

load_stock_data()

def generate_mock_stock_data(stock_code):
    base_price = 150 if stock_code.startswith('6') else 50 if stock_code.startswith('0') else 80 if stock_code.startswith('3') else 100
    if stock_code.isupper() and not stock_code.isdigit():
        base_price = 150
    
    data = []
    current_price = base_price
    days = 60
    
    for i in range(days - 1, -1, -1):
        date = datetime.now() - timedelta(days=i)
        
        volatility = 0.03
        change = (random.random() - 0.48) * volatility * current_price
        
        open_price = current_price
        current_price = current_price + change
        high = max(open_price, current_price) * (1 + random.random() * 0.01)
        low = min(open_price, current_price) * (1 - random.random() * 0.01)
        close = current_price
        volume = random.randint(1000000, 10000000)
        amount = volume * close
        
        data.append({
            'date': date.strftime('%Y-%m-%d'),
            'open': round(open_price, 2),
            'high': round(high, 2),
            'low': round(low, 2),
            'close': round(close, 2),
            'volume': volume,
            'amount': amount
        })
    
    return data

def get_stock_name(stock_code):
    stocks = {
        '600519': '贵州茅台',
        '601318': '中国平安',
        '600036': '招商银行',
        '000001': '平安银行',
        '000002': '万科A',
        '300750': '宁德时代',
        '300059': '东方财富',
        '600118': '中国卫星',
        'AAPL': '苹果公司',
        'GOOGL': '谷歌',
        'MSFT': '微软',
        'TSLA': '特斯拉',
        'AMZN': '亚马逊',
        'META': 'Meta Platforms',
        'NVDA': '英伟达',
        'JPM': '摩根大通',
        'V': 'Visa'
    }
    return stocks.get(stock_code, '未知股票')

def get_yahoo_data(ticker):
    try:
        print(f'🔍 正在从Yahoo Finance获取 {ticker} 的真实数据...')
        stock = yf.Ticker(ticker)
        
        hist = stock.history(period="60d")
        if len(hist) < 2:
            print(f'⚠️  {ticker} 历史数据不足，使用模拟数据')
            return None
        
        info = stock.info
        name = info.get('longName', ticker)
        
        kline_data = []
        for idx, row in hist.iterrows():
            kline_data.append({
                'date': idx.strftime('%Y-%m-%d'),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume'])
            })
        
        latest = kline_data[-1]
        prev = kline_data[-2]
        price = latest['close']
        change = price - prev['close']
        change_percent = (change / prev['close']) * 100
        
        print(f'✅ 成功获取 {ticker} ({name}) 的真实数据')
        
        return {
            'name': name,
            'code': ticker,
            'price': price,
            'change': change,
            'changePercent': change_percent,
            'volume': latest['volume'],
            'data': kline_data
        }
    except Exception as e:
        print(f'❌ 从Yahoo Finance获取数据失败: {e}')
        return None

@app.route('/api/stock/quote')
def get_stock_quote():
    stock_code = request.args.get('code')
    
    if not stock_code:
        return jsonify({'error': '请提供股票代码'}), 400
    
    is_us_stock = stock_code.isupper() and not stock_code.isdigit()
    
    if is_us_stock:
        yahoo_data = get_yahoo_data(stock_code)
        if yahoo_data:
            return jsonify({
                'name': yahoo_data['name'],
                'code': yahoo_data['code'],
                'price': yahoo_data['price'],
                'change': yahoo_data['change'],
                'changePercent': yahoo_data['changePercent']
            })
    
    change = 0
    change_percent = 0
    
    if stock_code in stock_database:
        stock_info = stock_database[stock_code]
        quote_data = stock_info['quotes'].copy()
        quote_data['name'] = stock_info['name']
        change = quote_data.get('change', 0)
        change_percent = quote_data.get('changePercent', 0)
        print(f'✅ 使用A股历史数据: {stock_code} - {quote_data["name"]}')
        return jsonify({
            'name': quote_data['name'],
            'code': stock_code,
            'price': quote_data['price'],
            'change': change,
            'changePercent': change_percent
        })
    
    mock_kline = generate_mock_stock_data(stock_code)
    latest = mock_kline[-1]
    prev = mock_kline[-2]
    
    print(f'⚠️  使用模拟数据: {stock_code}')
    return jsonify({
        'name': get_stock_name(stock_code),
        'code': stock_code,
        'price': latest['close'],
        'change': latest['close'] - prev['close'],
        'changePercent': ((latest['close'] - prev['close']) / prev['close']) * 100
    })

@app.route('/api/stock/data')
def get_stock_data():
    stock_code = request.args.get('code', '600519')
    
    is_us_stock = stock_code.isupper() and not stock_code.isdigit()
    
    if is_us_stock:
        yahoo_data = get_yahoo_data(stock_code)
        if yahoo_data:
            return jsonify(yahoo_data)
    
    if stock_code in stock_database:
        stock_info = stock_database[stock_code]
        kline_data = stock_info['kline'][-60:]
        print(f'✅ 使用A股历史K线数据: {stock_code} - {len(kline_data)}条')
        
        latest = kline_data[-1] if len(kline_data) > 0 else {}
        prev = kline_data[-2] if len(kline_data) > 1 else latest
        
        return jsonify({
            'name': stock_info['name'],
            'code': stock_code,
            'price': latest.get('close', 0),
            'change': latest.get('close', 0) - prev.get('close', 0),
            'changePercent': ((latest.get('close', 0) - prev.get('close', 0)) / prev.get('close', 1)) * 100,
            'volume': latest.get('volume', 0),
            'data': kline_data
        })
    
    kline_data = generate_mock_stock_data(stock_code)
    latest = kline_data[-1]
    prev = kline_data[-2]
    
    print(f'⚠️  使用模拟K线数据: {stock_code}')
    return jsonify({
        'name': get_stock_name(stock_code),
        'code': stock_code,
        'price': latest['close'],
        'change': latest['close'] - prev['close'],
        'changePercent': ((latest['close'] - prev['close']) / prev['close']) * 100,
        'volume': latest['volume'],
        'data': kline_data
    })

@app.route('/api/stock/full')
def get_stock_full():
    stock_code = request.args.get('code')
    days = int(request.args.get('days', 60))
    
    if not stock_code:
        return jsonify({'error': '请提供股票代码'}), 400
    
    is_us_stock = stock_code.isupper() and not stock_code.isdigit()
    
    if is_us_stock:
        yahoo_data = get_yahoo_data(stock_code)
        if yahoo_data:
            return jsonify({
                'quote': {
                    'name': yahoo_data['name'],
                    'price': yahoo_data['price'],
                    'preClose': yahoo_data['price'] - yahoo_data['change'],
                    'open': yahoo_data['data'][0]['open'],
                    'high': max(d['high'] for d in yahoo_data['data']),
                    'low': min(d['low'] for d in yahoo_data['data']),
                    'volume': yahoo_data['volume'],
                    'amount': yahoo_data['volume'] * yahoo_data['price'],
                    'isMock': False
                },
                'kline': yahoo_data['data']
            })
    
    if stock_code in stock_database:
        stock_info = stock_database[stock_code]
        quote_data = stock_info['quotes'].copy()
        quote_data['name'] = stock_info['name']
        kline_data = stock_info['kline'][-days:]
        print(f'✅ 使用A股完整历史数据: {stock_code} - {stock_info["name"]}')
        return jsonify({
            'quote': quote_data,
            'kline': kline_data
        })
    
    mock_kline = generate_mock_stock_data(stock_code)
    latest = mock_kline[-1]
    prev = mock_kline[-2]
    
    quote_data = {
        'name': get_stock_name(stock_code),
        'open': latest['open'],
        'preClose': prev['close'],
        'price': latest['close'],
        'high': latest['high'],
        'low': latest['low'],
        'volume': latest['volume'],
        'amount': latest['amount'],
        'isMock': True
    }
    
    print(f'⚠️  使用A股完整模拟数据: {stock_code}')
    return jsonify({
        'quote': quote_data,
        'kline': mock_kline
    })

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    print(f'''
╔══════════════════════════════════════════════════════════════╗
║                                                               ║
║       📊 股票智能分析系统 - Yahoo Finance数据源                 ║
║                                                               ║
║       访问地址: http://localhost:3000                         ║
║                                                               ║
║       支持股票:                                                ║
║         - A股: 600519(茅台), 600118(中国卫星) 等            ║
║         - 美股: AAPL(苹果), MSFT(微软), TSLA(特斯拉) 等真实数据 ║
║                                                               ║
╚══════════════════════════════════════════════════════════════╝
    ''')
    app.run(port=3000, debug=True, use_reloader=False)
