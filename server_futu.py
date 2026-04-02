from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import random
import re
import json
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

CN_DATA_FILE = os.path.join(os.path.dirname(__file__), 'stock_data.json')
US_DATA_FILE = os.path.join(os.path.dirname(__file__), 'us_stock_data.json')
stock_database = {}
futu_available = False

def load_all_stock_data():
    global stock_database
    
    try:
        with open(CN_DATA_FILE, 'r', encoding='utf-8') as f:
            cn_data = json.load(f)
            stock_database.update(cn_data)
            print(f'✅ 成功加载 {len(cn_data)} 只A股历史数据')
    except Exception as e:
        print(f'⚠️  加载A股数据失败: {e}')
    
    try:
        with open(US_DATA_FILE, 'r', encoding='utf-8') as f:
            us_data = json.load(f)
            stock_database.update(us_data)
            print(f'✅ 成功加载 {len(us_data)} 只美股历史数据')
    except Exception as e:
        print(f'⚠️  加载美股数据失败: {e}')
    
    print(f'📊 总计加载 {len(stock_database)} 只股票数据')

def try_init_futu():
    global futu_available
    try:
        from futu import OpenQuoteContext, RET_OK, SubType, KLType, AuType
        quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
        quote_ctx.close()
        futu_available = True
        print('✅ 富途API连接成功!')
        return True
    except Exception as e:
        print(f'⚠️  富途API不可用: {e}')
        futu_available = False
        return False

load_all_stock_data()
try_init_futu()

def get_futu_data(ticker):
    try:
        from futu import OpenQuoteContext, RET_OK, SubType, KLType, AuType
        
        quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
        
        futu_ticker = ticker
        if not ticker.startswith('US.') and not ticker.startswith('HK.') and not ticker.startswith('SH.') and not ticker.startswith('SZ.'):
            if ticker.isupper() and not ticker.isdigit():
                futu_ticker = f'US.{ticker}'
            elif len(ticker) == 6:
                if ticker.startswith('6'):
                    futu_ticker = f'SH.{ticker}'
                else:
                    futu_ticker = f'SZ.{ticker}'
        
        print(f'🔍 使用富途API获取 {futu_ticker} 数据...')
        
        ret_sub, err_message = quote_ctx.subscribe([futu_ticker], [SubType.RT_DATA, SubType.K_DAY], subscribe_push=False)
        
        if ret_sub != RET_OK:
            quote_ctx.close()
            return None
        
        ret, kline_data = quote_ctx.get_history_kline(
            futu_ticker, 
            start='2024-01-01', 
            end=None, 
            ktype=KLType.K_DAY, 
            autype=AuType.QFQ
        )
        
        if ret != RET_OK or len(kline_data) == 0:
            quote_ctx.close()
            return None
        
        data_list = []
        for _, row in kline_data.iterrows():
            data_list.append({
                'date': row['time_key'].split(' ')[0],
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': int(row['volume']),
                'amount': float(row['turnover'])
            })
        
        latest = data_list[-1]
        prev = data_list[-2] if len(data_list) > 1 else latest
        
        ret, rt_data = quote_ctx.get_rt_data(futu_ticker)
        name = ticker
        if ret == RET_OK and len(rt_data) > 0:
            name = rt_data.iloc[-1]['name']
        
        quote_ctx.close()
        
        print(f'✅ 富途API获取成功: {name}')
        
        return {
            'name': name,
            'code': ticker,
            'price': latest['close'],
            'change': latest['close'] - prev['close'],
            'changePercent': ((latest['close'] - prev['close']) / prev['close']) * 100,
            'volume': latest['volume'],
            'data': data_list[-60:]
        }
        
    except Exception as e:
        print(f'❌ 富途API获取失败: {e}')
        return None

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

@app.route('/api/stock/quote')
def get_stock_quote():
    stock_code = request.args.get('code')
    
    if not stock_code:
        return jsonify({'error': '请提供股票代码'}), 400
    
    if futu_available:
        futu_data = get_futu_data(stock_code)
        if futu_data:
            return jsonify({
                'name': futu_data['name'],
                'code': futu_data['code'],
                'price': futu_data['price'],
                'change': futu_data['change'],
                'changePercent': futu_data['changePercent']
            })
    
    if stock_code in stock_database:
        stock_info = stock_database[stock_code]
        quote_data = stock_info['quotes'].copy()
        quote_data['name'] = stock_info['name']
        print(f'✅ 使用历史数据: {stock_code} - {quote_data["name"]}')
        return jsonify({
            'name': quote_data['name'],
            'code': stock_code,
            'price': quote_data['price'],
            'change': quote_data.get('change', 0),
            'changePercent': quote_data.get('changePercent', 0)
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
    
    if futu_available:
        futu_data = get_futu_data(stock_code)
        if futu_data:
            return jsonify(futu_data)
    
    if stock_code in stock_database:
        stock_info = stock_database[stock_code]
        kline_data = stock_info['kline'][-60:]
        print(f'✅ 使用历史K线数据: {stock_code} - {len(kline_data)}条')
        
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
    
    if futu_available:
        futu_data = get_futu_data(stock_code)
        if futu_data:
            return jsonify({
                'quote': {
                    'name': futu_data['name'],
                    'price': futu_data['price'],
                    'preClose': futu_data['price'] - futu_data['change'],
                    'open': futu_data['data'][0]['open'] if len(futu_data['data']) > 0 else futu_data['price'],
                    'high': max(d['high'] for d in futu_data['data']),
                    'low': min(d['low'] for d in futu_data['data']),
                    'volume': futu_data['volume'],
                    'amount': futu_data['volume'] * futu_data['price'],
                    'isMock': False
                },
                'kline': futu_data['data']
            })
    
    if stock_code in stock_database:
        stock_info = stock_database[stock_code]
        quote_data = stock_info['quotes'].copy()
        quote_data['name'] = stock_info['name']
        kline_data = stock_info['kline'][-days:]
        print(f'✅ 使用完整历史数据: {stock_code} - {stock_info["name"]}')
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
    
    print(f'⚠️  使用完整模拟数据: {stock_code}')
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
    futu_status = '✅ 可用' if futu_available else '❌ 不可用'
    print(f'''
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║       📊 股票智能分析系统 - 富途API+历史数据 (智能回退)                ║
║                                                                       ║
║       访问地址: http://localhost:3000                                 ║
║                                                                       ║
║       富途API状态: {futu_status}                                                ║
║                                                                       ║
║       支持股票:                                                        ║
║         - A股: 600519(茅台), 600118(中国卫星), 601318(平安)        ║
║         - 美股: AAPL(苹果), MSFT(微软), TSLA(特斯拉), NVDA(英伟达)     ║
║                GOOGL(谷歌), AMZN(亚马逊), META等                       ║
║                                                                       ║
║       数据源优先级: 富途API > 历史数据 > 模拟数据                        ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
    ''')
    app.run(port=3000, debug=True, use_reloader=False)
