from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import random
import json
import os
from datetime import datetime, timedelta
import pandas as pd
from openbb import obb
import numpy as np

# 初始化 Flask 应用
app = Flask(__name__)
CORS(app)

# ==================== 配置加载 ====================
DASHSCOPE_API_KEY = None
DASHSCOPE_MODEL = 'qwen-turbo'
try:
    import config
    DASHSCOPE_API_KEY = getattr(config, 'DASHSCOPE_API_KEY', None)
    DASHSCOPE_MODEL = getattr(config, 'DASHSCOPE_MODEL', 'qwen-turbo')
except ImportError:
    pass

# ==================== 数据加载 ====================
CN_DATA_FILE = os.path.join(os.path.dirname(__file__), 'stock_data.json')
US_DATA_FILE = os.path.join(os.path.dirname(__file__), 'us_stock_data.json')
stock_database = {}

def load_all_stock_data():
    global stock_database
    try:
        if os.path.exists(CN_DATA_FILE):
            with open(CN_DATA_FILE, 'r', encoding='utf-8') as f:
                stock_database.update(json.load(f))
        if os.path.exists(US_DATA_FILE):
            with open(US_DATA_FILE, 'r', encoding='utf-8') as f:
                stock_database.update(json.load(f))
    except Exception:
        pass

load_all_stock_data()

# ==================== 辅助函数 ====================
def format_symbol(symbol):
    symbol = symbol.upper()
    if symbol.isdigit():
        return f'{symbol}.SS' if symbol.startswith('6') else f'{symbol}.SZ'
    return symbol

def to_float(val):
    if isinstance(val, (pd.Series, np.ndarray)):
        return float(val.iloc[0]) if len(val) > 0 else 0.0
    try:
        result = float(val)
        return result if np.isfinite(result) else None
    except:
        return None


def to_float_2(val):
    """Convert to float rounded to 2 decimal places."""
    f = to_float(val)
    if f is None:
        return None
    return round(f, 2)

def call_qwen_api(prompt, system_prompt='你是一位专业的金融分析师。'):
    if not DASHSCOPE_API_KEY or DASHSCOPE_API_KEY == 'your-api-key-here':
        return 'AI 分析功能未配置 API Key。'
    try:
        import dashscope
        dashscope.api_key = DASHSCOPE_API_KEY
        messages = [{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': prompt}]
        response = dashscope.Generation.call(model=DASHSCOPE_MODEL, messages=messages, result_format='message')
        if response.status_code == 200:
            return response.output.choices[0].message.content
        return f'AI 调用失败: {response.message}'
    except Exception as e:
        return f'AI 调用异常: {str(e)}'

# ==================== API 路由 ====================

@app.route('/api/stock/quote')
def get_stock_quote():
    stock_code = request.args.get('code')
    if not stock_code: return jsonify({'error': 'Missing code'}), 400
    try:
        formatted_code = format_symbol(stock_code)
        try:
            quote = obb.equity.price.quote(formatted_code).to_dataframe()
        except:
            quote = obb.equity.price.quote(formatted_code, provider='fmp').to_dataframe()
        
        if not quote.empty:
            row = quote.iloc[0]
            return jsonify({
                'name': str(row.get('name', stock_code)),
                'code': stock_code,
                'price': to_float_2(row.get('last_price', row.get('price', 0))),
                'change': to_float_2(row.get('change', 0)),
                'changePercent': to_float_2((row.get('change_percent') or 0) * 100),
                'open': to_float_2(row.get('open', 0)),
                'high': to_float_2(row.get('high', 0)),
                'low': to_float_2(row.get('low', 0)),
                'volume': int(to_float(row.get('volume')) or 0),
                'prev_close': to_float_2(row.get('prev_close', row.get('previous_close', 0))),
                'bid': to_float_2(row.get('bid')),
                'ask': to_float_2(row.get('ask')),
                'year_high': to_float_2(row.get('year_high')),
                'year_low': to_float_2(row.get('year_low')),
            })
    except Exception as e: 
        print(f'Quote Error: {e}')
    return jsonify({'error': 'Data not found'}), 404


@app.route('/api/stock/metrics')
def get_stock_metrics():
    stock_code = request.args.get('code')
    if not stock_code: return jsonify({'error': 'Missing code'}), 400
    try:
        formatted_code = format_symbol(stock_code)
        try:
            m = obb.equity.fundamental.metrics(formatted_code, provider='yfinance', limit=1)
        except Exception as e:
            print(f'Metrics Error: {e}')
            return jsonify({'pe_ratio': None, 'eps_ttm': None, 'dividend_yield': None})
        if m.results:
            r = m.results[0].model_dump()
            return jsonify({
                'pe_ratio': to_float_2(r.get('pe_ratio')),
                'eps_ttm': to_float_2(r.get('eps_ttm')),
                'dividend_yield': to_float_2(r.get('dividend_yield')),
                'forward_pe': to_float_2(r.get('forward_pe')),
                'market_cap': to_float_2(r.get('market_cap')),
                'beta': to_float_2(r.get('beta')),
            })
        return jsonify({'pe_ratio': None})
    except Exception as e:
        print(f'Metrics Error: {e}')
        return jsonify({'pe_ratio': None}), 500

@app.route('/api/stock/related-news')
def get_related_news():
    stock_code = request.args.get('code')
    stock_name = request.args.get('name', '')
    # 返回空数据，避免404
    return jsonify({'success': True, 'data': []})

@app.route('/api/stock/financial')
def get_financial():
    stock_code = request.args.get('code')
    stock_name = request.args.get('name', '')
    # 返回空数据，避免404
    return jsonify({'success': True, 'data': {}})

# ==================== 财务报表 API ====================

def _fmt(v):
    """Format a value: None/-NaN → None, else float."""
    if v is None:
        return None
    try:
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return f
    except:
        return None


def _row_to_dict(row, fields):
    """Extract listed fields from a pydantic model row dict."""
    d = row if isinstance(row, dict) else row.model_dump()
    return {f: _fmt(d.get(f)) for f in fields}


INCOME_FIELDS = [
    'period_ending', 'fiscal_period',
    'operating_revenue', 'total_revenue', 'cost_of_revenue', 'gross_profit',
    'selling_general_and_admin_expense', 'research_and_development_expense',
    'operating_expense', 'operating_income', 'ebitda',
    'total_pre_tax_income', 'tax_provision', 'net_income',
    'basic_earnings_per_share', 'diluted_earnings_per_share',
]

BALANCE_FIELDS = [
    'period_ending', 'fiscal_period',
    'cash_and_cash_equivalents', 'short_term_investments', 'net_receivables',
    'inventories', 'total_current_assets',
    'plant_property_equipment_net', 'total_non_current_assets', 'total_assets',
    'accounts_payable', 'current_debt', 'current_deferred_revenue',
    'total_current_liabilities',
    'long_term_debt', 'total_non_current_liabilities_net_minority_interest',
    'total_liabilities_net_minority_interest', 'total_equity',
    'common_stock_equity', 'retained_earnings',
]

CASH_FIELDS = [
    'period_ending', 'fiscal_period',
    'net_income_from_continuing_operations', 'depreciation_and_amortization',
    'stock_based_compensation', 'change_in_working_capital',
    'cash_flow_from_continuing_operating_activities',
    'investments_in_property_plant_and_equipment',
    'net_investment_purchase_and_sale',
    'cash_flow_from_continuing_investing_activities',
    'net_issuance_payments_of_debt', 'repurchase_of_common_equity',
    'cash_dividends_paid', 'cash_flow_from_continuing_financing_activities',
    'net_change_in_cash_and_equivalents',
    'beginning_cash_position', 'end_cash_position', 'free_cash_flow',
]


@app.route('/api/stock/financial/income')
def get_income():
    symbol = request.args.get('code', '').strip()
    period = request.args.get('period', 'annual')   # annual | quarter
    limit = min(int(request.args.get('limit', 5)), 5)
    if not symbol:
        return jsonify({'error': 'Missing code'}), 400
    try:
        formatted = format_symbol(symbol)
        data = obb.equity.fundamental.income(formatted, period=period, limit=limit)
        rows = []
        for r in data.results:
            d = r.model_dump()
            rows.append({f: _fmt(d.get(f)) for f in INCOME_FIELDS})
        return jsonify({'success': True, 'symbol': symbol, 'period': period, 'data': rows})
    except Exception as e:
        print(f'Income Error: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stock/financial/balance')
def get_balance():
    symbol = request.args.get('code', '').strip()
    period = request.args.get('period', 'annual')
    limit = min(int(request.args.get('limit', 5)), 5)
    if not symbol:
        return jsonify({'error': 'Missing code'}), 400
    try:
        formatted = format_symbol(symbol)
        data = obb.equity.fundamental.balance(formatted, period=period, limit=limit)
        rows = []
        for r in data.results:
            d = r.model_dump()
            rows.append({f: _fmt(d.get(f)) for f in BALANCE_FIELDS})
        return jsonify({'success': True, 'symbol': symbol, 'period': period, 'data': rows})
    except Exception as e:
        print(f'Balance Error: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stock/financial/cash')
def get_cash():
    symbol = request.args.get('code', '').strip()
    period = request.args.get('period', 'annual')
    limit = min(int(request.args.get('limit', 5)), 5)
    if not symbol:
        return jsonify({'error': 'Missing code'}), 400
    try:
        formatted = format_symbol(symbol)
        data = obb.equity.fundamental.cash(formatted, period=period, limit=limit)
        rows = []
        for r in data.results:
            d = r.model_dump()
            rows.append({f: _fmt(d.get(f)) for f in CASH_FIELDS})
        return jsonify({'success': True, 'symbol': symbol, 'period': period, 'data': rows})
    except Exception as e:
        print(f'Cash Error: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/enhanced/analysis', methods=['POST'])
def get_enhanced_analysis():
    # 简化处理，返回空分析
    return jsonify({
        'analysis': {
            'support_resistance': {'supports': [], 'resistances': [], 'reasons': []},
            'gaps': {'gaps': [], 'reasons': []},
            'prediction': {'predictions': [], 'trend': 'neutral', 'confidence': 50, 'reasons': [], 'recommendation': '暂无数据'}
        }
    })

@app.route('/api/stock/full')
def get_stock_full():
    stock_code = request.args.get('code')
    if not stock_code: return jsonify({'error': 'Missing code'}), 400
    try:
        formatted_code = format_symbol(stock_code)
        quote_extra = {}
        try:
            qt = obb.equity.price.quote(formatted_code).to_dataframe()
            if not qt.empty:
                r = qt.iloc[0]
                price = to_float_2(r.get('last_price', r.get('price')))
                prev_close = to_float_2(r.get('prev_close'))
                raw_change = to_float_2(r.get('change'))
                # yfinance quote 有时 change 为 None，从 price-prevClose 反推
                change_val = raw_change if raw_change is not None else (
                    round(price - prev_close, 2) if price is not None and prev_close is not None else None
                )
                pct_val = to_float_2(r.get('change_percent') * 100) if r.get('change_percent') is not None else (
                    round((price - prev_close) / prev_close * 100, 2) if price is not None and prev_close else None
                )
                quote_extra = {
                    'bid': to_float_2(r.get('bid')),
                    'ask': to_float_2(r.get('ask')),
                    'yearHigh': to_float_2(r.get('year_high')),
                    'yearLow': to_float_2(r.get('year_low')),
                    'price': price,
                    'change': change_val,
                    'changePercent': pct_val,
                    'open': to_float_2(r.get('open')),
                    'high': to_float_2(r.get('high')),
                    'low': to_float_2(r.get('low')),
                    'volume': int(to_float(r.get('volume')) or 0),
                    'prevClose': prev_close,
                }
        except Exception as eq:
            print(f'Quote Error: {eq}')
        if not quote_extra.get('price'):
            quote_extra['price'] = None
        try:
            mr = obb.equity.fundamental.metrics(formatted_code, provider='yfinance', limit=1)
            if mr.results:
                md = mr.results[0].model_dump()
                quote_extra['peRatio'] = to_float_2(md.get('pe_ratio'))
                quote_extra['marketCap'] = to_float_2(md.get('market_cap'))
        except: pass
        if not quote_extra.get('name'):
            quote_extra['name'] = stock_code
        return jsonify({'quote': quote_extra})
    except Exception as e:
        print(f'Full Error: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/stock/kline')
def get_stock_kline():
    stock_code = request.args.get('code')
    days = int(request.args.get('days', 120))
    interval = request.args.get('interval', '1d')
    if not stock_code: return jsonify({'error': 'Missing code'}), 400
    interval_map = {'1d': '1d', '1w': '1W', '1M': '1M'}
    openbb_interval = interval_map.get(interval, '1d')
    try:
        formatted_code = format_symbol(stock_code)
        fetch_days = 365 if openbb_interval in ['1W', '1M'] else days * 2
        df = obb.equity.price.historical(formatted_code, interval=openbb_interval).to_dataframe()
        if df.empty:
            return jsonify({'error': 'No data'}), 404
        try:
            ta = obb.technical.rsi(data=df).to_dataframe()
            df = pd.concat([df, ta], axis=1)
        except: pass
        kline = []
        for idx, row in df.tail(days).iterrows():
            kline.append({
                'date': idx.strftime('%Y-%m-%d') if hasattr(idx, 'strftime') else str(idx),
                'open': to_float_2(row['open']),
                'high': to_float_2(row['high']),
                'low': to_float_2(row['low']),
                'close': to_float_2(row['close']),
                'volume': int(to_float(row['volume']) or 0),
                'rsi': to_float_2(row.get('rsi_14', 0))
            })
        return jsonify({'code': stock_code, 'interval': interval, 'kline': kline})
    except Exception as e:
        print(f'Kline Error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/analyze')
def analyze_stock():
    stock_code = request.args.get('code')
    if not stock_code: return jsonify({'error': 'Missing code'}), 400
    formatted_code = format_symbol(stock_code)
    data_context = {}
    try:
        try:
            info = obb.equity.profile(formatted_code, provider='yfinance').to_dataframe()
            data_context['profile'] = info.iloc[0].to_dict() if not info.empty else '无'
        except: pass
        try:
            df = obb.equity.price.historical(formatted_code, provider='yfinance').to_dataframe()
            if not df.empty:
                data_context['recent_performance'] = df.tail(5).to_dict()
        except: pass
        prompt = f'请分析股票 {stock_code}。背景数据: {data_context}。请结合以上数据给出投资建议。'
        analysis = call_qwen_api(prompt)
        return jsonify({'analysis': analysis})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/management')
def get_management():
    stock_code = request.args.get('code')
    if not stock_code: return jsonify({'error': 'Missing code'}), 400
    try:
        formatted_code = format_symbol(stock_code)
        mgmt = obb.equity.fundamental.management(formatted_code).to_dataframe()
        if mgmt.empty:
            return jsonify({'error': 'No management data'}), 404
        
        management_list = []
        for _, row in mgmt.iterrows():
            management_list.append({
                'title': str(row.get('title', '')),
                'name': str(row.get('name', '')),
                'pay': to_float(row.get('pay', 0)),
                'year_born': int(row.get('year_born', 0)) if pd.notna(row.get('year_born')) else None,
                'age': int(row.get('age', 0)) if pd.notna(row.get('age')) else None,
                'exercised_value': to_float(row.get('exercised_value', 0)),
                'unexercised_value': to_float(row.get('unexercised_value', 0)),
                'fiscal_year': str(row.get('fiscal_year', ''))
            })
        return jsonify({
            'code': stock_code,
            'data': management_list
        })
    except Exception as e:
        print(f'Management Error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/news')
def get_news():
    try:
        # 使用 OpenBB 获取全球新闻
        news_df = obb.news.world(provider='benzinga', limit=10).to_dataframe()
        news_list = []
        for idx, row in news_df.iterrows():
            news_list.append({
                'id': str(idx),
                'title': row.get('title', '无标题'),
                'time': row.get('date', '未知时间'),
                'category': 'global',
                'impact': 'neutral' # 默认中性
            })
        return jsonify({'success': True, 'data': news_list})
    except Exception as e:
        print(f'News Error: {e}')
        # 兜底数据
        return jsonify({'success': True, 'data': [
            {'id': '1', 'title': '市场波动加剧，投资者需谨慎', 'time': '刚刚', 'category': 'market', 'impact': 'neutral'},
            {'id': '2', 'title': '美股指数创新高', 'time': '10分钟前', 'category': 'global', 'impact': 'positive'}
        ]})

@app.route('/api/technical/dashboard')
def get_technical_dashboard():
    """获取技术指标仪表盘数据"""
    stock_code = request.args.get('code')
    if not stock_code: return jsonify({'error': 'Missing code'}), 400
    
    try:
        formatted_code = format_symbol(stock_code)
        # 获取历史数据
        df = obb.equity.price.historical(formatted_code, provider='yfinance').to_dataframe()
        if df.empty:
            return jsonify({'error': 'Data not found'}), 404
        
        result = {
            'code': stock_code,
            'quote': {
                'last_price': to_float(df['close'].iloc[-1]),
                'change': to_float(df['close'].iloc[-1] - df['close'].iloc[-2]) if len(df) > 1 else 0,
                'change_percent': to_float((df['close'].iloc[-1] - df['close'].iloc[-2]) / df['close'].iloc[-2] * 100) if len(df) > 1 else 0
            }
        }
        
        # 计算多个技术指标
        try:
            rsi_df = obb.technical.rsi(data=df).to_dataframe()
            result['rsi'] = {
                'value': to_float(rsi_df['rsi_14'].iloc[-1]),
                'signal': 'overbought' if rsi_df['rsi_14'].iloc[-1] > 70 else 'oversold' if rsi_df['rsi_14'].iloc[-1] < 30 else 'neutral'
            }
        except Exception as e:
            print(f'RSI Error: {e}')
            result['rsi'] = {'value': 0, 'signal': 'unknown'}
        
        try:
            macd_df = obb.technical.macd(data=df).to_dataframe()
            result['macd'] = {
                'macd': to_float(macd_df['close_MACD_12_26_9'].iloc[-1]),
                'signal': to_float(macd_df['close_MACDs_12_26_9'].iloc[-1]),
                'histogram': to_float(macd_df['close_MACDh_12_26_9'].iloc[-1]),
                'trend': 'bullish' if macd_df['close_MACDh_12_26_9'].iloc[-1] > 0 else 'bearish'
            }
        except Exception as e:
            print(f'MACD Error: {e}')
            result['macd'] = {'macd': 0, 'signal': 0, 'histogram': 0, 'trend': 'unknown'}
        
        try:
            kdj_df = obb.technical.stoch(data=df).to_dataframe()
            result['kdj'] = {
                'k': to_float(kdj_df['close_STOCHk_14_3_3'].iloc[-1]),
                'd': to_float(kdj_df['close_STOCHd_14_3_3'].iloc[-1]),
                'j': to_float(kdj_df['close_STOCHj_14_3_3'].iloc[-1]),
                'signal': 'overbought' if kdj_df['close_STOCHj_14_3_3'].iloc[-1] > 80 else 'oversold' if kdj_df['close_STOCHj_14_3_3'].iloc[-1] < 20 else 'neutral'
            }
        except Exception as e:
            print(f'KDJ Error: {e}')
            result['kdj'] = {'k': 0, 'd': 0, 'j': 0, 'signal': 'unknown'}
        
        try:
            bbands_df = obb.technical.bbands(data=df).to_dataframe()
            result['bbands'] = {
                'upper': to_float(bbands_df['close_BBANDS_u_20_2'].iloc[-1]),
                'middle': to_float(bbands_df['close_BBANDS_m_20_2'].iloc[-1]),
                'lower': to_float(bbands_df['close_BBANDS_l_20_2'].iloc[-1]),
                'position': to_float((df['close'].iloc[-1] - bbands_df['close_BBANDS_l_20_2'].iloc[-1]) / (bbands_df['close_BBANDS_u_20_2'].iloc[-1] - bbands_df['close_BBANDS_l_20_2'].iloc[-1]) * 100)
            }
        except Exception as e:
            print(f'BBANDS Error: {e}')
            result['bbands'] = {'upper': 0, 'middle': 0, 'lower': 0, 'position': 50}
        
        try:
            adx_df = obb.technical.adx(data=df).to_dataframe()
            result['adx'] = {
                'value': to_float(adx_df['close_ADX_14'].iloc[-1]),
                'trend_strength': 'strong' if adx_df['close_ADX_14'].iloc[-1] > 25 else 'weak'
            }
        except Exception as e:
            print(f'ADX Error: {e}')
            result['adx'] = {'value': 0, 'trend_strength': 'unknown'}
        
        try:
            ema_df = obb.technical.ema(data=df).to_dataframe()
            result['ema'] = {
                'ema20': to_float(ema_df['close_EMA_20'].iloc[-1]) if 'close_EMA_20' in ema_df.columns else 0,
                'ema60': to_float(ema_df['close_EMA_60'].iloc[-1]) if 'close_EMA_60' in ema_df.columns else 0,
            }
        except Exception as e:
            print(f'EMA Error: {e}')
            result['ema'] = {'ema20': 0, 'ema60': 0}
        
        # 添加最近K线数据用于图表
        kline_data = []
        for idx, row in df.tail(30).iterrows():
            kline_data.append({
                'date': idx.strftime('%Y-%m-%d') if hasattr(idx, 'strftime') else str(idx),
                'close': to_float(row['close'])
            })
        result['kline'] = kline_data
        
        return jsonify(result)
    except Exception as e:
        print(f'Dashboard Error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index(): return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path): return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(port=3000, debug=True, use_reloader=True)
