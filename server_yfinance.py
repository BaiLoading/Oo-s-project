from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import yfinance as yf
from datetime import datetime, timedelta
import random
import re

app = Flask(__name__)
CORS(app)

def get_stock_name_yf(ticker):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        return info.get('longName', ticker)
    except:
        return ticker

@app.route('/api/stock/quote')
def get_stock_quote():
    ticker = request.args.get('code')
    if not ticker:
        return jsonify({'error': '请提供股票代码'}), 400
    
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="5d")
        if len(hist) < 2:
            return jsonify({'error': '没有足够的历史数据'}), 404
        
        latest = hist.iloc[-1]
        prev = hist.iloc[-2]
        price = float(latest['Close'])
        change = price - float(prev['Close'])
        change_percent = (change / float(prev['Close'])) * 100
        
        info = stock.info
        name = info.get('longName', ticker)
        
        return jsonify({
            'name': name,
            'code': ticker,
            'price': price,
            'change': change,
            'changePercent': change_percent
        })
    except Exception as e:
        print(f"Error fetching quote: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/data')
def get_stock_data():
    ticker = request.args.get('code', 'AAPL')
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="60d")
        
        if len(hist) < 2:
            return jsonify({'error': '没有足够的历史数据'}), 404
        
        latest = hist.iloc[-1]
        prev = hist.iloc[-2]
        price = float(latest['Close'])
        change = price - float(prev['Close'])
        change_percent = (change / float(prev['Close'])) * 100
        
        info = stock.info
        name = info.get('longName', ticker)
        
        data = []
        for idx, row in hist.iterrows():
            data.append({
                'date': idx.strftime('%Y-%m-%d'),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume'])
            })
        
        return jsonify({
            'name': name,
            'code': ticker,
            'price': price,
            'change': change,
            'changePercent': change_percent,
            'volume': int(latest['Volume']),
            'data': data
        })
    except Exception as e:
        print(f"Error fetching data: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    print(f'''
╔════════════════════════════════════════════════════════════════╗
║                                                                  ║
║       📊 美股智能分析系统 - yfinance数据源                         ║
║                                                                  ║
║       访问地址: http://localhost:3001                            ║
║                                                                  ║
║       支持股票: AAPL(苹果), GOOGL(谷歌), MSFT(微软), TSLA(特斯拉)  ║
║                AMZN(亚马逊), META(脸书) 等美股股票                  ║
║                                                                  ║
╚════════════════════════════════════════════════════════════════╝
    ''')
    app.run(port=3001, debug=True, use_reloader=False)
