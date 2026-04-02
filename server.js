const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/vendor/chart.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'));
});

function getStockPrefix(stockCode) {
    if (stockCode.startsWith('6')) {
        return 'sh';
    } else {
        return 'sz';
    }
}

async function getSinaStockData(stockCode) {
    try {
        const prefix = getStockPrefix(stockCode);
        const fullCode = prefix + stockCode;
        const url = `http://hq.sinajs.cn/list=${fullCode}`;
        
        const response = await axios.get(url, {
            timeout: 5000,
            responseType: 'text'
        });
        
        const data = response.data;
        const match = data.match(/"([^"]+)"/);
        
        if (!match) {
            return null;
        }
        
        const parts = match[1].split(',');
        
        if (parts.length < 32) {
            return null;
        }
        
        return {
            name: parts[0],
            open: parseFloat(parts[1]),
            preClose: parseFloat(parts[2]),
            price: parseFloat(parts[3]),
            high: parseFloat(parts[4]),
            low: parseFloat(parts[5]),
            volume: parseFloat(parts[8]),
            amount: parseFloat(parts[9]),
            date: parts[30],
            time: parts[31]
        };
    } catch (error) {
        console.error('新浪财经数据获取失败:', error.message);
        return null;
    }
}

async function getSinaKlineData(stockCode, days = 60) {
    try {
        const prefix = getStockPrefix(stockCode);
        const fullCode = prefix + stockCode;
        const scale = days <= 5 ? 5 : days <= 20 ? 30 : 60;
        const datalen = days;
        
        const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${fullCode}&scale=${scale}&ma=no&datalen=${datalen}`;
        
        const response = await axios.get(url, {
            timeout: 5000
        });
        
        let data = response.data;
        
        if (typeof data === 'string') {
            data = JSON.parse(data.replace(/(\w+):/g, '"$1":'));
        }
        
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }
        
        return data.map(item => ({
            date: item.day,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume),
            amount: parseFloat(item.close) * parseFloat(item.volume)
        }));
    } catch (error) {
        console.error('新浪财经K线数据获取失败:', error.message);
        return null;
    }
}

async function getEastMoneyStockData(stockCode) {
    try {
        const prefix = stockCode.startsWith('6') ? '1' : '0';
        const secid = `${prefix}.${stockCode}`;
        
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f49,f50,f57,f58,f60,f107,f116,f117,f127,f169`;
        
        const response = await axios.get(url, {
            timeout: 5000
        });
        
        if (!response.data || !response.data.data) {
            return null;
        }
        
        const data = response.data.data;
        
        return {
            name: data.f58,
            open: data.f46 / 100,
            preClose: data.f60 / 100,
            price: data.f43 / 100,
            high: data.f44 / 100,
            low: data.f45 / 100,
            volume: data.f47,
            amount: data.f48,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0]
        };
    } catch (error) {
        console.error('东方财富数据获取失败:', error.message);
        return null;
    }
}

async function getEastMoneyKlineData(stockCode, days = 60) {
    try {
        const prefix = stockCode.startsWith('6') ? '1' : '0';
        const secid = `${prefix}.${stockCode}`;
        
        const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&beg=0&end=20500101`;
        
        const response = await axios.get(url, {
            timeout: 5000
        });
        
        if (!response.data || !response.data.data || !response.data.data.klines) {
            return null;
        }
        
        const klines = response.data.data.klines.slice(-days);
        
        return klines.map(line => {
            const parts = line.split(',');
            return {
                date: parts[0],
                open: parseFloat(parts[1]),
                close: parseFloat(parts[2]),
                high: parseFloat(parts[3]),
                low: parseFloat(parts[4]),
                volume: parseFloat(parts[5]),
                amount: parseFloat(parts[6])
            };
        });
    } catch (error) {
        console.error('东方财富K线数据获取失败:', error.message);
        return null;
    }
}

function generateMockStockData(stockCode) {
    const basePrice = stockCode.startsWith('6') ? 150 : 
                      stockCode.startsWith('0') ? 50 : 
                      stockCode.startsWith('3') ? 80 : 100;
    
    const data = [];
    let currentPrice = basePrice;
    const days = 60;
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const volatility = 0.03;
        const change = (Math.random() - 0.48) * volatility * currentPrice;
        
        const open = currentPrice;
        currentPrice = currentPrice + change;
        const high = Math.max(open, currentPrice) * (1 + Math.random() * 0.01);
        const low = Math.min(open, currentPrice) * (1 - Math.random() * 0.01);
        const close = currentPrice;
        const volume = Math.floor(Math.random() * 10000000) + 1000000;
        const amount = volume * close;
        
        data.push({
            date: date.toISOString().split('T')[0],
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: volume,
            amount: amount
        });
    }
    
    return data;
}

function getStockName(stockCode) {
    const stocks = {
        '600519': '贵州茅台',
        '601318': '中国平安',
        '600036': '招商银行',
        '000001': '平安银行',
        '000002': '万科A',
        '300750': '宁德时代',
        '300059': '东方财富',
        '600118': '中国卫星',
        '600030': '中信证券',
        '601398': '工商银行'
    };
    return stocks[stockCode] || '未知股票';
}

async function getYahooUSStockData(symbol, range = '3mo', interval = '1d') {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        const result = response.data?.chart?.result?.[0];
        if (!result) return null;

        const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
        const quote = result.indicators?.quote?.[0];
        if (!quote) return null;

        const openArr = quote.open || [];
        const highArr = quote.high || [];
        const lowArr = quote.low || [];
        const closeArr = quote.close || [];
        const volumeArr = quote.volume || [];

        const data = [];
        for (let i = 0; i < timestamps.length; i++) {
            const close = closeArr[i];
            if (close == null || Number.isNaN(close)) continue;
            const ts = timestamps[i] * 1000;
            const date = new Date(ts).toISOString().split('T')[0];
            data.push({
                date,
                open: openArr[i] == null ? close : Number(openArr[i]),
                high: highArr[i] == null ? close : Number(highArr[i]),
                low: lowArr[i] == null ? close : Number(lowArr[i]),
                close: Number(close),
                volume: volumeArr[i] == null ? 0 : Number(volumeArr[i])
            });
        }

        if (data.length === 0) return null;

        const meta = result.meta || {};
        const price = meta.regularMarketPrice != null ? Number(meta.regularMarketPrice) : data[data.length - 1].close;
        const preClose = meta.previousClose != null ? Number(meta.previousClose) : (data.length >= 2 ? data[data.length - 2].close : price);
        const change = price - preClose;
        const volume = meta.regularMarketVolume != null ? Number(meta.regularMarketVolume) : data[data.length - 1].volume;

        return {
            name: meta.shortName || meta.longName || symbol,
            price,
            change,
            volume,
            data
        };
    } catch (error) {
        console.error('Yahoo美股数据获取失败:', error.message);
        return null;
    }
}

app.get('/api/stock/quote', async (req, res) => {
    const { code, source = 'sina' } = req.query;
    
    if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: '请输入6位有效的股票代码' });
    }
    
    let quoteData = null;
    
    if (source === 'sina') {
        quoteData = await getSinaStockData(code);
    } else if (source === 'eastmoney') {
        quoteData = await getEastMoneyStockData(code);
    }
    
    if (!quoteData) {
        const mockKline = generateMockStockData(code);
        const latest = mockKline[mockKline.length - 1];
        const prev = mockKline[mockKline.length - 2];
        
        quoteData = {
            name: getStockName(code),
            open: latest.open,
            preClose: prev.close,
            price: latest.close,
            high: latest.high,
            low: latest.low,
            volume: latest.volume,
            amount: latest.amount,
            date: latest.date,
            time: '15:00:00',
            isMock: true
        };
    }
    
    res.json(quoteData);
});

app.get('/api/stock/kline', async (req, res) => {
    const { code, source = 'sina', days = 60 } = req.query;
    
    if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: '请输入6位有效的股票代码' });
    }
    
    let klineData = null;
    
    if (source === 'sina') {
        klineData = await getSinaKlineData(code, parseInt(days));
    } else if (source === 'eastmoney') {
        klineData = await getEastMoneyKlineData(code, parseInt(days));
    }
    
    if (!klineData || klineData.length === 0) {
        klineData = generateMockStockData(code);
        klineData[klineData.length - 1].isMock = true;
    }
    
    res.json(klineData);
});

app.get('/api/stock/data', async (req, res) => {
    const { code } = req.query;
    const symbol = (code || '').toString().trim().toUpperCase();

    if (!symbol || !/^[A-Z0-9.\-]{1,15}$/.test(symbol)) {
        return res.status(400).json({ error: '请输入有效的美股代码（如：AAPL）' });
    }

    let usData = await getYahooUSStockData(symbol);

    if (!usData) {
        const mock = generateMockStockData('0');
        const price = mock[mock.length - 1].close;
        const preClose = mock[mock.length - 2].close;
        usData = {
            name: symbol,
            price,
            change: price - preClose,
            volume: mock[mock.length - 1].volume,
            data: mock.map(d => ({
                date: d.date,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume
            })),
            isMock: true
        };
    }

    res.json(usData);
});

app.get('/api/stock/full', async (req, res) => {
    const { code, source = 'sina', days = 60 } = req.query;
    
    if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: '请输入6位有效的股票代码' });
    }
    
    try {
        const [quoteData, klineData] = await Promise.all([
            (async () => {
                let data = null;
                if (source === 'sina') {
                    data = await getSinaStockData(code);
                } else if (source === 'eastmoney') {
                    data = await getEastMoneyStockData(code);
                }
                if (!data) {
                    const mockKline = generateMockStockData(code);
                    const latest = mockKline[mockKline.length - 1];
                    const prev = mockKline[mockKline.length - 2];
                    data = {
                        name: getStockName(code),
                        open: latest.open,
                        preClose: prev.close,
                        price: latest.close,
                        high: latest.high,
                        low: latest.low,
                        volume: latest.volume,
                        amount: latest.amount,
                        date: latest.date,
                        time: '15:00:00',
                        isMock: true
                    };
                }
                return data;
            })(),
            (async () => {
                let data = null;
                if (source === 'sina') {
                    data = await getSinaKlineData(code, parseInt(days));
                } else if (source === 'eastmoney') {
                    data = await getEastMoneyKlineData(code, parseInt(days));
                }
                if (!data || data.length === 0) {
                    data = generateMockStockData(code);
                    data[data.length - 1].isMock = true;
                }
                return data;
            })()
        ]);
        
        res.json({
            quote: quoteData,
            kline: klineData
        });
    } catch (error) {
        console.error('获取完整数据失败:', error);
        res.status(500).json({ error: '数据获取失败' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                              ║
║       📈 A股智能分析系统 - 服务器已启动                     ║
║                                                              ║
║       访问地址: http://localhost:${PORT}                        ║
║                                                              ║
║       API接口:                                               ║
║         - /api/stock/quote?code=600519&source=sina        ║
║         - /api/stock/kline?code=600519&source=sina        ║
║         - /api/stock/full?code=600519&source=sina         ║
║                                                              ║
║       数据源: 新浪财经、东方财富                              ║
║                                                              ║
╚════════════════════════════════════════════════════════════╝
    `);
});
