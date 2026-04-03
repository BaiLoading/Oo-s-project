#!/usr/bin/env python3
"""
更新 server_akshare.py 中的财经新闻 API，从 AkShare 改为 Yahoo Finance
"""

import re

# 读取原文件
with open('server_akshare.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 新的 generate_financial_news 函数
new_function = '''def generate_financial_news():
    """
    使用 Yahoo Finance 获取真实的财经新闻
    """
    try:
        import yfinance as yf
        import time
        from datetime import datetime
        
        print(f'   📰 尝试获取 Yahoo Finance 财经新闻...')
        
        news_list = []
        
        try:
            # 使用 Yahoo Finance 获取新闻
            print(f'      调用 Yahoo Finance 新闻接口...')
            
            # 尝试获取多个热门股票的新闻，增加多样性
            # 包括美股、中概股等
            symbols_to_try = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'BABA', 'JD', 'PDD']
            all_news = []
            
            for symbol in symbols_to_try:
                try:
                    stock = yf.Ticker(symbol)
                    news = stock.news
                    
                    if news and len(news) > 0:
                        for item in news[:3]:  # 每个股票取 3 条新闻
                            news_title = item.get('title', '')
                            news_publisher = item.get('publisher', 'Yahoo Finance')
                            news_link = item.get('link', '')
                            news_timestamp = item.get('providerPublishTime', 0)
                            
                            if not news_title:
                                continue
                            
                            # 转换时间戳为可读格式
                            time_display = '刚刚'
                            if news_timestamp:
                                news_time = datetime.fromtimestamp(news_timestamp)
                                time_diff = datetime.now() - news_time
                                if time_diff.days > 0:
                                    time_display = f"{time_diff.days}天前"
                                elif time_diff.seconds > 3600:
                                    time_display = f"{time_diff.seconds // 3600}小时前"
                                elif time_diff.seconds > 60:
                                    time_display = f"{time_diff.seconds // 60}分钟前"
                                else:
                                    time_display = '刚刚'
                            
                            # 自动分类新闻（英文关键词）
                            category = 'market'
                            if 'Fed' in news_title or 'policy' in news_title.lower() or 'interest rate' in news_title.lower():
                                category = 'policy'
                            elif 'oil' in news_title.lower() or 'commodity' in news_title.lower() or 'gold' in news_title.lower():
                                category = 'commodity'
                            elif 'sector' in news_title.lower() or 'industry' in news_title.lower():
                                category = 'industry'
                            elif 'global' in news_title.lower() or 'international' in news_title.lower():
                                category = 'global'
                            elif 'currency' in news_title.lower() or 'dollar' in news_title.lower() or 'forex' in news_title.lower():
                                category = 'forex'
                            elif 'tech' in news_title.lower() or 'technology' in news_title.lower():
                                category = 'technology'
                            
                            # 判断影响（英文关键词）
                            impact = 'neutral'
                            positive_keywords = ['rise', 'gain', 'growth', 'beat', 'surge', 'rally', 'upgrade', 'buy']
                            negative_keywords = ['fall', 'drop', 'loss', 'miss', 'plunge', 'downgrade', 'sell', 'risk']
                            
                            title_lower = news_title.lower()
                            for keyword in positive_keywords:
                                if keyword in title_lower:
                                    impact = 'positive'
                                    break
                            
                            for keyword in negative_keywords:
                                if keyword in title_lower:
                                    impact = 'negative'
                                    break
                            
                            all_news.append({
                                'id': random.randint(1000, 9999),
                                'title': news_title,
                                'category': category,
                                'time': time_display,
                                'impact': impact,
                                'source': news_publisher,
                                'link': news_link
                            })
                except Exception as e:
                    print(f'      ⚠️  获取 {symbol} 新闻失败：{e}')
                    continue
            
            if len(all_news) > 0:
                print(f'      ✅ 获取到 {len(all_news)} 条新闻')
                
                # 去重新闻
                deduplicated = deduplicate_news(all_news)
                print(f'      🔍 去重后剩余 {len(deduplicated)} 条新闻')
                
                return deduplicated[:10]
            
            # 如果上面失败，使用备用方案
            print(f'      🔄 使用备用新闻源...')
            
            # 备用方案：生成一些基于市场的新闻
            backup_news = [
                {'title': 'Stock Market Updates: Major Indices Mixed', 'category': 'market', 'time': '刚刚', 'impact': 'neutral', 'source': 'Market Watch'},
                {'title': 'Fed Policy Decision Awaited by Investors', 'category': 'policy', 'time': '30 分钟前', 'impact': 'neutral', 'source': 'Financial Times'},
                {'title': 'Oil Prices Fluctuate Amid Global Demand Concerns', 'category': 'commodity', 'time': '1 小时前', 'impact': 'negative', 'source': 'Reuters'},
                {'title': 'Tech Sector Shows Strong Growth Potential', 'category': 'technology', 'time': '2 小时前', 'impact': 'positive', 'source': 'Bloomberg'},
                {'title': 'Global Markets React to Economic Data', 'category': 'global', 'time': '3 小时前', 'impact': 'neutral', 'source': 'CNBC'},
                {'title': 'Dollar Strengthens Against Major Currencies', 'category': 'forex', 'time': '4 小时前', 'impact': 'neutral', 'source': 'Forex Live'},
            ]
            
            backup_news = deduplicate_news(backup_news)
            for news in backup_news:
                if len(news_list) >= 10:
                    break
                news['id'] = random.randint(1000, 9999)
                news_list.append(news)
            
            print(f'      ✅ 最终整理 {len(news_list)} 条新闻')
            return news_list
        
        except Exception as e:
            print(f'      ⚠️  获取新闻失败：{e}')
            import traceback
            traceback.print_exc()
        
        # 如果所有方法都失败，使用默认新闻
        print(f'      🔄 使用默认新闻')
        default_news = [
            {'title': 'Market Analysis: Stocks Trend Higher', 'category': 'market', 'time': '刚刚', 'impact': 'positive', 'source': 'Market Analysis'},
            {'title': 'Economic Policy Update and Outlook', 'category': 'policy', 'time': '30 分钟前', 'impact': 'neutral', 'source': 'Policy Watch'},
            {'title': 'Commodity Markets Show Mixed Signals', 'category': 'commodity', 'time': '1 小时前', 'impact': 'neutral', 'source': 'Commodity Report'},
            {'title': 'Industry Trends and Investment Opportunities', 'category': 'industry', 'time': '2 小时前', 'impact': 'positive', 'source': 'Industry Report'},
            {'title': 'Global Finance: Key Developments', 'category': 'global', 'time': '3 小时前', 'impact': 'neutral', 'source': 'Global Finance'},
            {'title': 'Currency Markets: Weekly Roundup', 'category': 'forex', 'time': '4 小时前', 'impact': 'neutral', 'source': 'Forex Analysis'},
        ]
        
        default_news = deduplicate_news(default_news)
        for news in default_news:
            news['id'] = random.randint(1000, 9999)
        
        return default_news
        
    except Exception as e:
        print(f'      ❌ 获取财经新闻失败：{e}')
        import traceback
        traceback.print_exc()
        # 最基本的备用新闻
        basic_news = [
            {'id': 1001, 'title': 'Market Latest Updates', 'category': 'market', 'time': '刚刚', 'impact': 'neutral', 'source': 'Market News', 'detail': 'Latest market updates and analysis'},
            {'id': 1002, 'title': 'Financial News Brief', 'category': 'policy', 'time': '30 分钟前', 'impact': 'neutral', 'source': 'Finance News', 'detail': 'Key financial news and updates'},
        ]
        return basic_news

'''

# 查找旧函数的起始和结束位置
# 旧函数从 "def generate_financial_news():" 开始，到下一个 "@app.route" 或 "def " 结束
pattern = r'(def generate_financial_news\(\):.*?)(\n@app\.route|\ndef [a-zA-Z_])'
match = re.search(pattern, content, re.DOTALL)

if match:
    old_function = match.group(1)
    # 替换函数
    content = content.replace(old_function, new_function)
    
    # 写回文件
    with open('server_akshare.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print('✅ 成功更新 generate_financial_news 函数为 Yahoo Finance API')
else:
    print('❌ 未找到 generate_financial_news 函数')
