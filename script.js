let klineChart = null;
let macdChart = null;
let rsiChart = null;
let currentKlinePeriod = '1d';  // 当前K线周期: 1d=日K, 1w=周K, 1M=月K

let aiChatHistory = [];

let simInitialCapital = 1000000;
let simAvailableCapital = 1000000;
let simHoldings = [];
let simTradeHistory = [];
let currentTradeType = 'buy';
let currentTradeStock = null;
let currentUsername = 'Ooking';
let currentUserId = '1234';
let pkList = [];

const APP_SETTINGS_KEY = 'stock_app_settings_v1';

function getDefaultAppSettings() {
    return {
        apiBaseUrl: '',
        lastView: 'analysis',
        sidebar: {
            collapsed: false,
            groups: {
                stockAnalysis: false,
                trading: false,
                ai: false
            }
        },
        ai: {
            provider: 'backend',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: '',
            maxTokens: 1024
        },
        tradingagents: {
            openaiApiKey: '',
            openaiBaseUrl: 'https://api.openai.com/v1',
            deepModel: 'gpt-4.1',
            quickModel: 'gpt-4.1-mini',
            maxDebateRounds: 1,
            maxRiskDiscussRounds: 1
        }
    };
}

function loadAppSettings() {
    try {
        const raw = localStorage.getItem(APP_SETTINGS_KEY);
        if (!raw) return getDefaultAppSettings();
        const parsed = JSON.parse(raw);
        const defaults = getDefaultAppSettings();
        return {
            ...defaults,
            ...parsed,
            sidebar: {
                ...defaults.sidebar,
                ...(parsed.sidebar || {}),
                groups: {
                    ...defaults.sidebar.groups,
                    ...((parsed.sidebar && parsed.sidebar.groups) || {})
                }
            },
            ai: {
                ...defaults.ai,
                ...(parsed.ai || {})
            },
            tradingagents: {
                ...defaults.tradingagents,
                ...(parsed.tradingagents || {})
            }
        };
    } catch (e) {
        return getDefaultAppSettings();
    }
}

let appSettings = loadAppSettings();

function persistAppSettings(next) {
    appSettings = next;
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings));
}

function normalizeBaseUrl(url) {
    const value = (url || '').trim();
    if (!value) return '';
    return value.replace(/\/+$/, '');
}

function joinUrl(base, path) {
    const b = normalizeBaseUrl(base);
    const p = (path || '').trim();
    if (!b) return p;
    if (!p) return b;
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    if (b.endsWith('/api') && p.startsWith('/api/')) return `${b}${p.slice(4)}`;
    if (p.startsWith('/')) return `${b}${p}`;
    return `${b}/${p}`;
}

function apiFetch(path, options) {
    const baseUrl = normalizeBaseUrl(appSettings.apiBaseUrl);
    return fetch(joinUrl(baseUrl, path), options);
}

async function readJsonOrThrow(resp) {
    try {
        return await resp.json();
    } catch (e) {
        const txt = await resp.text().catch(() => '');
        const head = (txt || '').slice(0, 160).replace(/\s+/g, ' ').trim();
        const url = resp && resp.url ? resp.url : '';
        throw new Error(`返回非JSON（${resp.status}）：${head || 'empty body'}${url ? ` · ${url}` : ''}`);
    }
}

function showPaperBackendError(message) {
    const m = message || '请求失败';
    const hint = `<p style="color:#ff4757;text-align:center;padding:18px 12px;line-height:1.6;">
        ${escapeHtml(m)}<br>
        请确认：<br>
        1) 后端已启动（python server.py，默认端口 3000）<br>
        2) 你是通过 http://127.0.0.1:3000 打开的页面（不是 Live Server/文件预览）<br>
        3) 设置里的 API Base URL 留空或为 http://127.0.0.1:3000（不要以 /api 结尾）
    </p>`;
    const ranking = document.getElementById('stockRanking');
    const orders = document.getElementById('ordersList');
    const pos = document.getElementById('holdingsList');
    const trades = document.getElementById('historyList');
    if (ranking) ranking.innerHTML = hint;
    if (orders) orders.innerHTML = hint;
    if (pos) pos.innerHTML = hint;
    if (trades) trades.innerHTML = hint;
}

async function paperBackendHealthCheck() {
    try {
        const resp = await apiFetch('/api/health');
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error((data && data.error) || `health failed(${resp.status})`);
        return true;
    } catch (e) {
        stopPaperPolling();
        showPaperBackendError(e && e.message ? e.message : '后端不可用');
        return false;
    }
}

const __rawFetch = window.fetch.bind(window);
window.fetch = function(input, init) {
    try {
        if (typeof input === 'string' && input.startsWith('/')) {
            const baseUrl = normalizeBaseUrl(appSettings.apiBaseUrl);
            return __rawFetch(joinUrl(baseUrl, input), init);
        }
    } catch (e) {}
    return __rawFetch(input, init);
};

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    if (!menu) return;
    menu.classList.toggle('hidden');
}

document.addEventListener('click', function(e) {
    const userProfile = document.getElementById('userProfile');
    const menu = document.getElementById('userMenu');
    if (userProfile && !userProfile.contains(e.target)) {
        if (menu) {
            menu.classList.add('hidden');
        }
    }
});

function openEditUserModal() {
    const menu = document.getElementById('userMenu');
    if (menu) menu.classList.add('hidden');
    
    document.getElementById('editUsername').value = currentUsername;
    document.getElementById('editUserId').value = currentUserId;
    document.getElementById('editUserModal').classList.remove('hidden');
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.add('hidden');
}

function saveUserProfile() {
    const newUsername = document.getElementById('editUsername').value.trim();
    
    if (!newUsername) {
        alert('请输入用户名');
        return;
    }
    
    currentUsername = newUsername;
    localStorage.setItem('simUsername', currentUsername);
    localStorage.setItem('simUserId', currentUserId);
    
    const displayUsername = document.getElementById('displayUsername');
    if (displayUsername) displayUsername.textContent = currentUsername;
    
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.value = currentUsername;
    }
    
    alert('用户资料已保存！');
    closeEditUserModal();
}

window.addEventListener('load', function() {
    const stockCodeInput = document.getElementById('stockCode');
    if (stockCodeInput) {
        stockCodeInput.value = '600519';
    }
    
    const savedUsername = localStorage.getItem('simUsername');
    if (savedUsername) {
        currentUsername = savedUsername;
        const displayUsername = document.getElementById('displayUsername');
        if (displayUsername) displayUsername.textContent = currentUsername;
    }
    
    const savedUserId = localStorage.getItem('simUserId');
    if (savedUserId) {
        currentUserId = savedUserId;
    }
    
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.value = currentUsername;
    }
    
    const savedPK = localStorage.getItem('simPKList');
    if (savedPK) {
        pkList = JSON.parse(savedPK);
    }
    
    const savedCapital = localStorage.getItem('simInitialCapital');
    if (savedCapital) {
        simInitialCapital = parseFloat(savedCapital);
        simAvailableCapital = parseFloat(savedCapital);
    }
    
    const savedHoldings = localStorage.getItem('simHoldings');
    if (savedHoldings) {
        simHoldings = JSON.parse(savedHoldings);
    }
    
    const savedTradeHistory = localStorage.getItem('simTradeHistory');
    if (savedTradeHistory) {
        simTradeHistory = JSON.parse(savedTradeHistory);
    }
    
    updateCapitalDisplay();
    renderSimHoldings();
    renderSimTradeHistory();
    renderPKList();
    checkCapitalSet();
    
    loadMyPortfolioData();
});

function saveSimData() {
    localStorage.setItem('simInitialCapital', simInitialCapital.toString());
    localStorage.setItem('simHoldings', JSON.stringify(simHoldings));
    localStorage.setItem('simTradeHistory', JSON.stringify(simTradeHistory));
}

function generateStockData(stockCode) {
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
        'AAPL': '苹果公司',
        'GOOGL': '谷歌',
        'MSFT': '微软',
        'TSLA': '特斯拉',
        'AMZN': '亚马逊',
        'META': 'Meta Platforms',
        'NVDA': '英伟达',
        'JPM': '摩根大通',
        'V': 'Visa'
    };
    return stocks[stockCode] || '未知股票';
}

function calculateMA(data, period) {
    const ma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            ma.push(null);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
            }
            ma.push(parseFloat((sum / period).toFixed(2)));
        }
    }
    return ma;
}

function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const closes = data.map(d => d.close);
    
    function ema(values, period) {
        const emaValues = [];
        const multiplier = 2 / (period + 1);
        emaValues.push(values[0]);
        for (let i = 1; i < values.length; i++) {
            emaValues.push(values[i] * multiplier + emaValues[i - 1] * (1 - multiplier));
        }
        return emaValues;
    }
    
    const fastEMA = ema(closes, fastPeriod);
    const slowEMA = ema(closes, slowPeriod);
    
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        macdLine.push(fastEMA[i] - slowEMA[i]);
    }
    
    const signalLine = ema(macdLine, signalPeriod);
    
    const histogram = [];
    for (let i = 0; i < closes.length; i++) {
        histogram.push(macdLine[i] - signalLine[i]);
    }
    
    return { macdLine, signalLine, histogram };
}

function calculateRSI(data, period = 14) {
    const rsi = [];
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
    }
    
    for (let i = 0; i < data.length; i++) {
        if (i < period) {
            rsi.push(null);
        } else if (i === period) {
            let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
            let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        } else {
            const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
    }
    
    return rsi.map(v => v ? parseFloat(v.toFixed(2)) : null);
}

function findSupportResistance(data) {
    const supports = [];
    const resistances = [];
    const period = 5;
    
    for (let i = period; i < data.length - period; i++) {
        let isSupport = true;
        let isResistance = true;
        
        for (let j = 1; j <= period; j++) {
            if (data[i].low > data[i - j].low || data[i].low > data[i + j].low) {
                isSupport = false;
            }
            if (data[i].high < data[i - j].high || data[i].high < data[i + j].high) {
                isResistance = false;
            }
        }
        
        if (isSupport) {
            supports.push({ price: data[i].low, date: data[i].date });
        }
        if (isResistance) {
            resistances.push({ price: data[i].high, date: data[i].date });
        }
    }
    
    const recentSupports = supports.slice(-3).reverse();
    const recentResistances = resistances.slice(-3).reverse();
    
    return { supports: recentSupports, resistances: recentResistances };
}

function findGaps(data) {
    const gaps = [];
    
    for (let i = 1; i < data.length; i++) {
        const prevClose = data[i - 1].close;
        const currOpen = data[i].open;
        const prevHigh = data[i - 1].high;
        const prevLow = data[i - 1].low;
        
        if (currOpen > prevHigh) {
            gaps.push({
                type: 'up',
                startPrice: prevHigh,
                endPrice: currOpen,
                date: data[i].date
            });
        } else if (currOpen < prevLow) {
            gaps.push({
                type: 'down',
                startPrice: prevLow,
                endPrice: currOpen,
                date: data[i].date
            });
        }
    }
    
    return gaps.slice(-5).reverse();
}

function predictFuture(data) {
    const latest = data[data.length - 1];
    const ma5 = calculateMA(data, 5);
    const ma10 = calculateMA(data, 10);
    const ma20 = calculateMA(data, 20);
    const macd = calculateMACD(data);
    const rsi = calculateRSI(data);
    
    const predictions = [];
    let trend = 'neutral';
    let confidence = 50;
    
    const latestMA5 = ma5[ma5.length - 1];
    const latestMA10 = ma10[ma10.length - 1];
    const latestMA20 = ma20[ma20.length - 1];
    const latestMACD = macd.macdLine[macd.macdLine.length - 1];
    const latestSignal = macd.signalLine[macd.signalLine.length - 1];
    const latestRSI = rsi[rsi.length - 1];
    
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    if (latestMA5 && latestMA10 && latestMA5 > latestMA10) {
        bullishSignals++;
    } else if (latestMA5 && latestMA10 && latestMA5 < latestMA10) {
        bearishSignals++;
    }
    
    if (latestMA10 && latestMA20 && latestMA10 > latestMA20) {
        bullishSignals++;
    } else if (latestMA10 && latestMA20 && latestMA10 < latestMA20) {
        bearishSignals++;
    }
    
    if (latestMACD > latestSignal) {
        bullishSignals++;
    } else if (latestMACD < latestSignal) {
        bearishSignals++;
    }
    
    if (latestMACD > 0) {
        bullishSignals++;
    } else if (latestMACD < 0) {
        bearishSignals++;
    }
    
    if (latestRSI < 30) {
        bullishSignals += 2;
    } else if (latestRSI > 70) {
        bearishSignals += 2;
    } else if (latestRSI < 50) {
        bullishSignals++;
    } else if (latestRSI > 50) {
        bearishSignals++;
    }
    
    if (bullishSignals > bearishSignals) {
        trend = 'bullish';
        confidence = 50 + (bullishSignals - bearishSignals) * 10;
    } else if (bearishSignals > bullishSignals) {
        trend = 'bearish';
        confidence = 50 + (bearishSignals - bullishSignals) * 10;
    }
    
    confidence = Math.min(confidence, 90);
    
    let currentPrice = latest.close;
    for (let i = 1; i <= 3; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        const volatility = trend === 'bullish' ? 0.02 : 
                          trend === 'bearish' ? -0.02 : (Math.random() - 0.5) * 0.02;
        
        const change = currentPrice * volatility * (0.5 + Math.random() * 0.5);
        currentPrice = currentPrice + change;
        
        predictions.push({
            date: date.toISOString().split('T')[0],
            predictedPrice: parseFloat(currentPrice.toFixed(2)),
            change: parseFloat(((currentPrice - latest.close) / latest.close * 100).toFixed(2))
        });
    }
    
    let recommendation = '';
    if (trend === 'bullish' && confidence > 60) {
        recommendation = '建议：考虑适量买入，设置止损位在近期支撑位下方。';
    } else if (trend === 'bearish' && confidence > 60) {
        recommendation = '建议：考虑减仓或观望，等待更明确的信号。';
    } else {
        recommendation = '建议：暂时观望，等待趋势明朗后再操作。';
    }
    
    return { predictions, trend, confidence, recommendation };
}

function renderCharts(data, stockCode = null) {
    const labels = data.map(d => d.date);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    const ma5 = calculateMA(data, 5);
    const ma10 = calculateMA(data, 10);
    const ma20 = calculateMA(data, 20);
    
    if (klineChart) klineChart.destroy();
    
    const datasets = [
        {
            label: '收盘价',
            data: closes,
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            fill: true,
            tension: 0.1
        },
        {
            label: 'MA5',
            data: ma5,
            borderColor: '#ffd93d',
            borderDash: [],
            fill: false,
            pointRadius: 0
        },
        {
            label: 'MA10',
            data: ma10,
            borderColor: '#ff6b6b',
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0
        },
        {
            label: 'MA20',
            data: ma20,
            borderColor: '#4ecdc4',
            borderDash: [10, 5],
            fill: false,
            pointRadius: 0
        }
    ];
    
    if (stockCode) {
        const holdingsForStock = holdings.filter(h => h.code === stockCode);
        if (holdingsForStock.length > 0) {
            const positionPoints = new Array(labels.length).fill(null);
            holdingsForStock.forEach(position => {
                const index = labels.indexOf(position.buyDate);
                if (index !== -1) {
                    positionPoints[index] = position.buyPrice;
                }
            });
            
            datasets.push({
                label: '买入点',
                data: positionPoints,
                borderColor: '#ff4757',
                backgroundColor: '#ff4757',
                pointRadius: 8,
                pointHoverRadius: 10,
                showLine: false,
                pointStyle: 'triangle',
                pointRotation: 180
            });
        }
    }
    
    const klineCtx = document.getElementById('klineChart').getContext('2d');
    klineChart = new Chart(klineCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === '买入点') {
                                const index = context.dataIndex;
                                const holdingsForStock = stockCode ? holdings.filter(h => h.code === stockCode) : [];
                                const position = holdingsForStock.find(h => h.buyDate === labels[index]);
                                if (position) {
                                    return [
                                        `买入点: ¥${position.buyPrice}`,
                                        `数量: ${position.quantity}股`,
                                        `备注: ${position.note || '无'}`
                                    ];
                                }
                            }
                            return context.dataset.label + ': ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#8892b0', maxTicksLimit: 10 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#8892b0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
    
    const macd = calculateMACD(data);
    
    if (macdChart) macdChart.destroy();
    
    const macdCtx = document.getElementById('macdChart').getContext('2d');
    macdChart = new Chart(macdCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'MACD',
                    data: macd.macdLine,
                    borderColor: '#00d4ff',
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: '信号线',
                    data: macd.signalLine,
                    borderColor: '#ff6b6b',
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y'
                },
                {
                    label: '柱状图',
                    data: macd.histogram,
                    backgroundColor: macd.histogram.map(h => h >= 0 ? '#ff4757' : '#00ff88'),
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#8892b0', maxTicksLimit: 10 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#8892b0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
    
    const rsi = calculateRSI(data);
    
    if (rsiChart) rsiChart.destroy();
    
    const rsiCtx = document.getElementById('rsiChart').getContext('2d');
    rsiChart = new Chart(rsiCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'RSI',
                    data: rsi,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    fill: true,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#8892b0', maxTicksLimit: 10 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { color: '#8892b0' },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        lineWidth: (context) => {
                            if (context.tick.value === 30 || context.tick.value === 70) {
                                return 2;
                            }
                            return 1;
                        },
                        color: (context) => {
                            if (context.tick.value === 30 || context.tick.value === 70) {
                                return '#ffd93d';
                            }
                            return 'rgba(255, 255, 255, 0.1)';
                        }
                    }
                }
            }
        }
    });
}

function displayIndicators(data) {
    const ma5 = calculateMA(data, 5);
    const ma10 = calculateMA(data, 10);
    const ma20 = calculateMA(data, 20);
    const ma60 = calculateMA(data, 60);
    
    const maHtml = `
        <div class="indicator-item">
            <span>MA5</span>
            <span>${ma5[ma5.length - 1] || '--'}</span>
        </div>
        <div class="indicator-item">
            <span>MA10</span>
            <span>${ma10[ma10.length - 1] || '--'}</span>
        </div>
        <div class="indicator-item">
            <span>MA20</span>
            <span>${ma20[ma20.length - 1] || '--'}</span>
        </div>
        <div class="indicator-item">
            <span>MA60</span>
            <span>${ma60[ma60.length - 1] || '--'}</span>
        </div>
    `;
    document.getElementById('maData').innerHTML = maHtml;
    
    const macd = calculateMACD(data);
    const latestMACD = macd.macdLine[macd.macdLine.length - 1];
    const latestSignal = macd.signalLine[macd.signalLine.length - 1];
    const latestHist = macd.histogram[macd.histogram.length - 1];
    
    const macdHtml = `
        <div class="indicator-item">
            <span>MACD</span>
            <span>${latestMACD ? latestMACD.toFixed(4) : '--'}</span>
        </div>
        <div class="indicator-item">
            <span>信号线</span>
            <span>${latestSignal ? latestSignal.toFixed(4) : '--'}</span>
        </div>
        <div class="indicator-item">
            <span>柱状图</span>
            <span>${latestHist ? latestHist.toFixed(4) : '--'}</span>
        </div>
        <div class="indicator-item">
            <span>信号</span>
            <span class="${latestMACD > latestSignal ? 'bullish' : latestMACD < latestSignal ? 'bearish' : ''}">
                ${latestMACD > latestSignal ? '金叉' : latestMACD < latestSignal ? '死叉' : '中性'}
            </span>
        </div>
    `;
    document.getElementById('macdData').innerHTML = macdHtml;
    
    const rsi = calculateRSI(data);
    const latestRSI = rsi[rsi.length - 1];
    
    let rsiStatus = '中性';
    let rsiClass = 'neutral';
    if (latestRSI < 30) {
        rsiStatus = '超卖';
        rsiClass = 'bullish';
    } else if (latestRSI > 70) {
        rsiStatus = '超买';
        rsiClass = 'bearish';
    }
    
    const rsiHtml = `
        <div class="indicator-item">
            <span>RSI(14)</span>
            <span>${latestRSI ? latestRSI.toFixed(2) : '--'}</span>
        </div>
        <div class="indicator-item">
            <span>状态</span>
            <span class="${rsiClass}">${rsiStatus}</span>
        </div>
        <div class="indicator-item">
            <span>超买线</span>
            <span>70</span>
        </div>
        <div class="indicator-item">
            <span>超卖线</span>
            <span>30</span>
        </div>
    `;
    document.getElementById('rsiData').innerHTML = rsiHtml;
}

function displaySupportResistance(data) {
    const { supports, resistances } = findSupportResistance(data);
    
    let srHtml = '<div style="margin-bottom: 15px;"><strong style="color: #00ff88;">支撑位：</strong></div>';
    if (supports.length > 0) {
        supports.forEach(s => {
            srHtml += `<div class="indicator-item">
                <span>${s.date}</span>
                <span style="color: #00ff88;">¥${s.price}</span>
            </div>`;
        });
    } else {
        srHtml += '<p style="color: #8892b0;">暂无明显支撑位</p>';
    }
    
    srHtml += '<div style="margin: 20px 0 15px;"><strong style="color: #ff4757;">压力位：</strong></div>';
    if (resistances.length > 0) {
        resistances.forEach(r => {
            srHtml += `<div class="indicator-item">
                <span>${r.date}</span>
                <span style="color: #ff4757;">¥${r.price}</span>
            </div>`;
        });
    } else {
        srHtml += '<p style="color: #8892b0;">暂无明显压力位</p>';
    }
    
    document.getElementById('supportResistance').innerHTML = srHtml;
}

function displayGaps(data) {
    const gaps = findGaps(data);
    
    let gapsHtml = '';
    if (gaps.length > 0) {
        gaps.forEach(g => {
            const gapClass = g.type === 'up' ? 'bullish' : 'bearish';
            const gapType = g.type === 'up' ? '向上跳空' : '向下跳空';
            gapsHtml += `<div class="indicator-item">
                <span>${g.date}</span>
                <span class="${gapClass}">${gapType}: ¥${g.startPrice.toFixed(2)} - ¥${g.endPrice.toFixed(2)}</span>
            </div>`;
        });
    } else {
        gapsHtml = '<p style="color: #8892b0;">近期无跳空缺口</p>';
    }
    
    document.getElementById('gaps').innerHTML = gapsHtml;
}

function displayPrediction(data) {
    const prediction = predictFuture(data);
    
    const trendClass = prediction.trend === 'bullish' ? 'bullish' : 
                       prediction.trend === 'bearish' ? 'bearish' : 'neutral';
    const trendText = prediction.trend === 'bullish' ? '看涨' : 
                      prediction.trend === 'bearish' ? '看跌' : '震荡';
    
    let predHtml = `
        <div class="prediction-row">
            <span>趋势判断</span>
            <span class="${trendClass}"><strong>${trendText}</strong></span>
        </div>
        <div class="prediction-row">
            <span>置信度</span>
            <span>${prediction.confidence}%</span>
        </div>
        <div style="margin-top: 20px; margin-bottom: 10px;"><strong>未来3天预测：</strong></div>
    `;
    
    prediction.predictions.forEach(p => {
        const changeClass = p.change >= 0 ? 'bullish' : 'bearish';
        const changeSign = p.change >= 0 ? '+' : '';
        const currencySymbol = window.currentCurrencySymbol || '¥';
        predHtml += `
            <div class="prediction-row">
                <span>${p.date}</span>
                <span>预测价: ${currencySymbol}${p.predictedPrice} <span class="${changeClass}">(${changeSign}${p.change}%)</span></span>
            </div>
        `;
    });
    
    predHtml += `
        <div class="recommendation">
            <strong>操作建议：</strong>
            <p>${prediction.recommendation}</p>
        </div>
    `;
    
    document.getElementById('prediction').innerHTML = predHtml;
}

async function analyzeStock() {
    const stockCode = document.getElementById('stockCode').value.trim().toUpperCase();
    const stockType = document.getElementById('stockType').value;
    
    if (!stockCode) {
        alert('请输入股票代码');
        return;
    }
    
    if (stockType === 'cn' && !/^\d{6}$/.test(stockCode)) {
        alert('A股请输入6位数字的股票代码');
        return;
    }
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');
    
    try {
        let stockData, quote;
        
        // 1) 行情快照（报价）
        const quoteRes = await apiFetch(`/api/stock/full?code=${stockCode}&market=${stockType}`);
        if (!quoteRes.ok) {
            let errMsg = `请求失败(${quoteRes.status})`;
            try { const e = await quoteRes.json(); if (e && e.error) errMsg = e.error; } catch (_) {}
            throw new Error(errMsg);
        }
        const quoteData = await quoteRes.json();
        if (!quoteData || !quoteData.quote) throw new Error('行情数据不完整');
        quote = quoteData.quote;
        
        // 2) K线历史数据
        const klineRes = await apiFetch(`/api/stock/kline?code=${stockCode}&interval=${currentKlinePeriod}&market=${stockType}`);
        if (!klineRes.ok) {
            let errMsg = `K线请求失败(${klineRes.status})`;
            try { const e = await klineRes.json(); if (e && e.error) errMsg = e.error; } catch (_) {}
            throw new Error(errMsg);
        }
        const klineData = await klineRes.json();
        if (!klineData || !Array.isArray(klineData.kline)) throw new Error('K线数据不完整');
        stockData = klineData.kline;
            
            const holdingsForStock = holdings.filter(h => h.code === stockCode);
            
            let newsData = null;
            
            await Promise.all([
                fetchRelatedNews(stockCode, quote.name, stockType).then(data => newsData = data)
            ]);
            
            window.currentNewsData = newsData;
            
            // 获取管理团队数据
            await fetchManagementData(stockCode);
            
            await loadEnhancedAnalysis(stockCode, quote, holdingsForStock, newsData, null);
        
        const latest = stockData[stockData.length - 1];
        const prev = stockData[stockData.length - 2];
        
        const priceChange = quote.change != null ? parseFloat(quote.change) : (quote.price - parseFloat(quote.prevClose));
        const priceChangePercent = quote.changePercent != null ? parseFloat(quote.changePercent).toFixed(2) : ((priceChange / parseFloat(quote.prevClose)) * 100).toFixed(2);
        const changeClass = priceChange >= 0 ? 'up' : 'down';
        const changeSign = priceChange >= 0 ? '+' : '';
        const currencySymbol = stockType === 'cn'
            ? '¥'
            : (quote.currency === 'HKD' || stockType === 'hk')
                ? 'HK$'
                : (quote.currency === 'USD' || stockType === 'us' || stockType === 'crypto')
                    ? '$'
                    : '';
        window.currentCurrencySymbol = currencySymbol;
        
        let displayName = quote.name;
        if (quote.isMock) {
            displayName = quote.name + ' (模拟)';
        }
        
        document.getElementById('stockName').textContent = displayName;
        document.getElementById('stockCodeDisplay').textContent = stockCode;
        document.getElementById('currentPrice').textContent = `${currencySymbol}${quote.price}`;
        document.getElementById('currentPrice').className = `price ${changeClass}`;
        document.getElementById('priceChange').textContent = `${changeSign}${currencySymbol}${priceChange.toFixed(2)}`;
        document.getElementById('priceChange').className = `change ${changeClass}`;
        document.getElementById('priceChangePercent').textContent = `(${changeSign}${priceChangePercent}%)`;
        document.getElementById('priceChangePercent').className = `change-percent ${changeClass}`;
        
        const p2 = v => (v != null && !isNaN(v)) ? parseFloat(v).toFixed(2) : '--';
        const vol = quote.volume != null ? (quote.volume / 1000000).toFixed(2) + 'M' : '--';
        const amt = quote.amount != null ? (quote.amount / 1000000000).toFixed(2) + 'B' : (quote.volume != null && quote.price != null ? (quote.volume * quote.price / 1000000000).toFixed(2) + 'B' : '--');
        
        document.getElementById('openPrice').textContent = `${currencySymbol}${p2(quote.open)}`;
        document.getElementById('highPrice').textContent = `${currencySymbol}${p2(quote.high)}`;
        document.getElementById('lowPrice').textContent = `${currencySymbol}${p2(quote.low)}`;
        const preCloseEl = document.getElementById('preClosePrice');
        if (preCloseEl) preCloseEl.textContent = `${currencySymbol}${p2(quote.prevClose)}`;
        document.getElementById('volume').textContent = vol;
        document.getElementById('amount').textContent = amt;
        const bidAskEl = document.getElementById('bidAsk');
        if (bidAskEl) {
            const b = quote.bid != null ? p2(quote.bid) : '--';
            const a = quote.ask != null ? p2(quote.ask) : '--';
            bidAskEl.textContent = `${b} / ${a}`;
        }
        const yearRangeEl = document.getElementById('yearRange');
        if (yearRangeEl) {
            const yh = quote.yearHigh != null ? p2(quote.yearHigh) : '--';
            const yl = quote.yearLow != null ? p2(quote.yearLow) : '--';
            yearRangeEl.textContent = `${yl} - ${yh}`;
        }
        const peEl = document.getElementById('peRatio');
        if (peEl) {
            peEl.textContent = quote.peRatio != null ? parseFloat(quote.peRatio).toFixed(2) : '--';
        }
        const providerEl = document.getElementById('dataProvider');
        if (providerEl) providerEl.textContent = quote.provider || '--';
        
        if (typeof Chart !== 'undefined') {
            try {
                renderCharts(stockData, stockCode);
            } catch (e) {
                console.error('渲染图表失败:', e);
            }
        } else {
            console.error('Chart.js 未加载');
        }
        
        try {
            displayIndicators(stockData);
        } catch (e) {
            console.error('渲染指标失败:', e);
        }
        
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('result').classList.remove('hidden');
    } catch (error) {
        console.error('获取数据失败:', error);
        alert(error && error.message ? `获取数据失败：${error.message}` : '获取数据失败，请稍后重试');
        document.getElementById('loading').classList.add('hidden');
    }
}

async function fetchRelatedNews(stockCode, stockName, market) {
    try {
        const response = await apiFetch(`/api/stock/related-news?code=${stockCode}&market=${market}&name=${encodeURIComponent(stockName)}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            renderRelatedNews(data.data);
            return data.data;
        }
    } catch (error) {
        console.error('获取相关新闻失败:', error);
    }
    return null;
}

async function fetchStockEvents(stockCode, stockName) {
    try {
        const response = await apiFetch(`/api/stock/events?code=${stockCode}&name=${encodeURIComponent(stockName)}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            renderStockEvents(data.data);
        }
    } catch (error) {
        console.error('获取大事纪要失败:', error);
    }
}

function renderRelatedNews(news) {
    const container = document.getElementById('relatedNewsList');
    if (!container) return;
    
    let html = '';
    const visibleCount = 3;
    const hasMore = news.length > visibleCount;
    
    news.forEach((item, index) => {
        const isHidden = index >= visibleCount;
        const hasUrl = !!(item.url && String(item.url).trim());
        const titleHtml = hasUrl
            ? `<a class="related-news-title-link" href="${item.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${item.title}</a>`
            : `<div class="related-news-title">${item.title}</div>`;
        html += `
            <div class="related-news-item ${isHidden ? 'hidden-news' : ''}" id="newsItem-${item.id}" onclick="toggleRelatedNewsDetail(${item.id})">
                <div class="related-news-header">
                    ${titleHtml}
                    <span class="related-news-source">${item.source}</span>
                </div>
                <div class="related-news-meta">
                    <span class="related-news-time">🕐 ${item.time}</span>
                    <span class="related-news-type">${item.type}</span>
                </div>
                <div class="related-news-detail" id="newsDetail-${item.id}">
                    <div>${item.detail || ''}</div>
                    ${hasUrl ? `<a class="related-news-link" href="${item.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">查看详情</a>` : ''}
                </div>
            </div>
        `;
    });
    
    if (hasMore) {
        html += `
            <button class="toggle-news-btn" onclick="toggleMoreNews()">
                <span id="toggleNewsText">展开更多 (${news.length - visibleCount}条)</span>
            </button>
        `;
    }
    
    container.innerHTML = html;
}

let allNewsVisible = false;

function toggleMoreNews() {
    allNewsVisible = !allNewsVisible;
    const hiddenItems = document.querySelectorAll('.related-news-item.hidden-news');
    const toggleText = document.getElementById('toggleNewsText');
    
    hiddenItems.forEach(item => {
        if (allNewsVisible) {
            item.classList.add('show');
        } else {
            item.classList.remove('show');
        }
    });
    
    if (toggleText) {
        if (allNewsVisible) {
            toggleText.textContent = '收起';
        } else {
            const hiddenCount = document.querySelectorAll('.related-news-item.hidden-news').length;
            toggleText.textContent = `展开更多 (${hiddenCount}条)`;
        }
    }
}

function toggleRelatedNewsDetail(newsId) {
    const detailEl = document.getElementById(`newsDetail-${newsId}`);
    if (detailEl) {
        detailEl.classList.toggle('show');
    }
}

async function fetchFinancialData(stockCode, stockName) {
    try {
        const response = await apiFetch(`/api/stock/financial?code=${stockCode}&name=${encodeURIComponent(stockName)}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            renderFinancialData(data.data);
            return data.data;
        }
    } catch (error) {
        console.error('获取财务数据失败:', error);
    }
    return null;
}

function renderFinancialData(financialData) {
    const container = document.getElementById('financialData');
    if (!container) return;
    
    let html = '';
    
    if (financialData.profit) {
        html += `
            <div class="financial-card">
                <h4>📈 利润表</h4>
                ${Object.entries(financialData.profit).map(([key, value]) => {
                    const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
                    const isPositive = isNumeric && parseFloat(value) > 0;
                    const isNegative = isNumeric && parseFloat(value) < 0;
                    let valueClass = '';
                    if (isPositive) valueClass = 'positive';
                    if (isNegative) valueClass = 'negative';
                    
                    return `
                        <div class="financial-item">
                            <span class="financial-label">${key}</span>
                            <span class="financial-value ${valueClass}">${value}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    if (financialData.balance) {
        html += `
            <div class="financial-card">
                <h4>🏦 资产负债表</h4>
                ${Object.entries(financialData.balance).map(([key, value]) => {
                    const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
                    const isPositive = isNumeric && parseFloat(value) > 0;
                    const isNegative = isNumeric && parseFloat(value) < 0;
                    let valueClass = '';
                    if (isPositive) valueClass = 'positive';
                    if (isNegative) valueClass = 'negative';
                    
                    return `
                        <div class="financial-item">
                            <span class="financial-label">${key}</span>
                            <span class="financial-value ${valueClass}">${value}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    if (financialData.cash) {
        html += `
            <div class="financial-card">
                <h4>💵 现金流量表</h4>
                ${Object.entries(financialData.cash).map(([key, value]) => {
                    const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
                    const isPositive = isNumeric && parseFloat(value) > 0;
                    const isNegative = isNumeric && parseFloat(value) < 0;
                    let valueClass = '';
                    if (isPositive) valueClass = 'positive';
                    if (isNegative) valueClass = 'negative';
                    
                    return `
                        <div class="financial-item">
                            <span class="financial-label">${key}</span>
                            <span class="financial-value ${valueClass}">${value}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderStockEvents(events) {
    const container = document.getElementById('eventsTimeline');
    if (!container) return;
    
    container.innerHTML = events.map(event => `
        <div class="event-item">
            <div class="event-date">${event.date}</div>
            <div class="event-title">${event.title}</div>
            <span class="event-type">${event.type}</span>
        </div>
    `).join('');
}

async function fetchManagementData(stockCode) {
    try {
        console.log('[Management] Fetching data for:', stockCode);
        const response = await apiFetch(`/api/stock/management?code=${stockCode}`);
        console.log('[Management] Response status:', response.status);
        const data = await response.json();
        console.log('[Management] Response data:', data);
        
        if (data.data && data.data.length > 0) {
            console.log('[Management] Rendering', data.data.length, 'people');
            renderManagementData(data.data);
            return data.data;
        } else {
            console.log('[Management] No data returned');
        }
    } catch (error) {
        console.error('获取管理团队数据失败:', error);
    }
    return null;
}

function renderManagementData(managementData) {
    const container = document.getElementById('managementData');
    if (!container) return;
    
    let html = '';
    
    managementData.forEach(person => {
        const initials = person.name.split(' ').map(n => n[n.length-1]).join('').slice(-2);
        const pay = person.pay ? formatCurrency(person.pay) : 'N/A';
        
        html += `
            <div class="management-card">
                <div class="management-header">
                    <div class="management-avatar">${initials}</div>
                    <div class="management-info">
                        <h4>${person.name}</h4>
                        <div class="management-title">${person.title}</div>
                    </div>
                </div>
                <div class="management-details">
                    <div class="management-item">
                        <span class="label">年龄</span>
                        <span class="value">${person.age || 'N/A'} 岁</span>
                    </div>
                    <div class="management-item">
                        <span class="label">出生年份</span>
                        <span class="value">${person.year_born || 'N/A'}</span>
                    </div>
                    <div class="management-item">
                        <span class="label">已执行期权</span>
                        <span class="value">${formatCurrency(person.exercised_value)}</span>
                    </div>
                    <div class="management-item">
                        <span class="label">未执行期权</span>
                        <span class="value">${formatCurrency(person.unexercised_value)}</span>
                    </div>
                    <div class="management-pay">
                        <span class="label">年薪报酬</span>
                        <span class="value">${pay}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function formatCurrency(value) {
    if (value == null || isNaN(value)) return 'N/A';
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    } else if (value >= 1000) {
        return '$' + (value / 1000).toFixed(2) + 'K';
    }
    return '$' + value.toFixed(2);
}

async function loadEnhancedAnalysis(stockCode, quote, holdingsForStock, newsData = null, financialData = null) {
    try {
        const response = await apiFetch('/api/enhanced/analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: stockCode,
                name: quote.name,
                holdings: holdingsForStock,
                news: newsData,
                financial: financialData
            })
        });
        const data = await response.json();
        
        if (data.analysis) {
            displayEnhancedSupportResistance(data.analysis.support_resistance);
            displayEnhancedGaps(data.analysis.gaps);
            displayEnhancedPrediction(data.analysis.prediction);
        }
    } catch (error) {
        console.error('获取增强分析失败:', error);
    }
}

function displayEnhancedSupportResistance(srData) {
    let srHtml = '<div style="margin-bottom: 15px;"><strong style="color: #00ff88;">支撑位：</strong></div>';
    
    if (srData.supports && srData.supports.length > 0) {
        srData.supports.forEach(s => {
            srHtml += `<div class="indicator-item">
                <span>${s.date}</span>
                <span style="color: #00ff88;">¥${s.price}</span>
            </div>`;
            if (s.reason) {
                srHtml += `<div style="font-size: 0.85rem; color: #8892b0; margin: 5px 0 10px 0; padding-left: 10px;">💡 ${s.reason}</div>`;
            }
        });
    } else {
        srHtml += '<p style="color: #8892b0;">暂无明显支撑位</p>';
    }
    
    srHtml += '<div style="margin: 20px 0 15px;"><strong style="color: #ff4757;">压力位：</strong></div>';
    
    if (srData.resistances && srData.resistances.length > 0) {
        srData.resistances.forEach(r => {
            srHtml += `<div class="indicator-item">
                <span>${r.date}</span>
                <span style="color: #ff4757;">¥${r.price}</span>
            </div>`;
            if (r.reason) {
                srHtml += `<div style="font-size: 0.85rem; color: #8892b0; margin: 5px 0 10px 0; padding-left: 10px;">💡 ${r.reason}</div>`;
            }
        });
    } else {
        srHtml += '<p style="color: #8892b0;">暂无明显压力位</p>';
    }
    
    if (srData.reasons && srData.reasons.length > 0) {
        srHtml += '<div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">';
        srHtml += '<strong style="color: #ffd93d;">分析依据：</strong><ul style="margin: 8px 0 0 20px; color: #8892b0;">';
        srData.reasons.forEach(r => {
            srHtml += `<li style="margin-bottom: 5px;">${r}</li>`;
        });
        srHtml += '</ul></div>';
    }
    
    // ---- OpenBB 技术分析：Fibonacci / ATR / Donchian ----
    if (srData.openbb) {
        const obb = srData.openbb;
        const price = srData.currentPrice || 0;
        
        // Fibonacci
        if (obb.fib && obb.fib.length > 0) {
            srHtml += '<div style="margin-top: 20px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">';
            srHtml += '<div style="color: #ffd93d; font-weight: 600; margin-bottom: 10px; font-size: 0.9rem;">🎯 Fibonacci 回撤位</div>';
            srHtml += '<div style="display: grid; grid-template-columns: auto 1fr auto; gap: 4px 10px; font-size: 0.85rem;">';
            srHtml += '<span style="color: #8892b0;">位置</span><span style="color: #8892b0;">价格</span><span style="color: #8892b0;">类型</span>';
            obb.fib.forEach(f => {
                const distStr = f.distance ? (f.distance > 0 ? '+' + f.distance.toFixed(1) + '%' : f.distance.toFixed(1) + '%') : '';
                const typeColor = f.type === 'resistance' ? '#ff4757' : '#00ff88';
                const typeText  = f.type === 'resistance' ? '压力' : '支撑';
                srHtml += `<span style="color: #ffd93d;">${f.level}%</span>`;
                srHtml += `<span style="color: #e0e0e0;">$${f.price.toFixed(2)} <span style="color: #64b5f6; font-size:0.8rem;">${distStr}</span></span>`;
                srHtml += `<span style="color: ${typeColor}; font-weight:600;">${typeText}</span>`;
            });
            srHtml += '</div></div>';
        }
        
        // ATR 动态支撑/压力
        if (obb.atr && obb.atr.atr) {
            const atr = obb.atr;
            srHtml += '<div style="margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">';
            srHtml += `<div style="color: #ffd93d; font-weight: 600; margin-bottom: 10px; font-size: 0.9rem;">📊 ATR 动态区间 <span style="font-size: 0.8rem; color: #64b5f6;">(ATR=${atr.atr})</span></div>`;
            srHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; font-size: 0.85rem;">';
            srHtml += `<div><span style="color: #ff4757;">压力2</span> <span style="color:#e0e0e0;">$${atr.resistance2}</span></div>`;
            srHtml += `<div><span style="color: #ff4757;">压力1</span> <span style="color:#e0e0e0;">$${atr.resistance1}</span></div>`;
            srHtml += `<div><span style="color: #00ff88;">支撑1</span> <span style="color:#e0e0e0;">$${atr.support1}</span></div>`;
            srHtml += `<div><span style="color: #00ff88;">支撑2</span> <span style="color:#e0e0e0;">$${atr.support2}</span></div>`;
            srHtml += '</div></div>';
        }
        
        // Donchian Channel
        if (obb.donchian && obb.donchian.upper) {
            const dc = obb.donchian;
            srHtml += '<div style="margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">';
            srHtml += '<div style="color: #ffd93d; font-weight: 600; margin-bottom: 10px; font-size: 0.9rem;">🔷 Donchian 通道</div>';
            srHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; font-size: 0.85rem; text-align: center;">';
            srHtml += `<div><div style="color: #ff4757;">上轨(压力)</div><div style="color:#e0e0e0;">$${dc.upper ? dc.upper.toFixed(2) : '--'}</div></div>`;
            srHtml += `<div><div style="color: #ffd93d;">中轨</div><div style="color:#e0e0e0;">$${dc.middle ? dc.middle.toFixed(2) : '--'}</div></div>`;
            srHtml += `<div><div style="color: #00ff88;">下轨(支撑)</div><div style="color:#e0e0e0;">$${dc.lower ? dc.lower.toFixed(2) : '--'}</div></div>`;
            srHtml += '</div></div>';
        }
    }
    
    document.getElementById('supportResistance').innerHTML = srHtml;
}

function displayEnhancedGaps(gapsData) {
    let gapsHtml = '';
    
    if (gapsData.gaps && gapsData.gaps.length > 0) {
        gapsData.gaps.forEach(g => {
            const gapClass = g.type === 'up' ? 'bullish' : 'bearish';
            const gapType = g.type === 'up' ? '向上跳空' : '向下跳空';
            gapsHtml += `<div class="indicator-item">
                <span>${g.date}</span>
                <span class="${gapClass}">${gapType}: ¥${g.startPrice.toFixed(2)} - ¥${g.endPrice.toFixed(2)}</span>
            </div>`;
            if (g.reason) {
                gapsHtml += `<div style="font-size: 0.85rem; color: #8892b0; margin: 5px 0 10px 0; padding-left: 10px;">💡 ${g.reason}</div>`;
            }
        });
    } else {
        gapsHtml = '<p style="color: #8892b0;">近期无跳空缺口</p>';
    }
    
    if (gapsData.reasons && gapsData.reasons.length > 0) {
        gapsHtml += '<div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">';
        gapsHtml += '<strong style="color: #ffd93d;">分析依据：</strong><ul style="margin: 8px 0 0 20px; color: #8892b0;">';
        gapsData.reasons.forEach(r => {
            gapsHtml += `<li style="margin-bottom: 5px;">${r}</li>`;
        });
        gapsHtml += '</ul></div>';
    }
    
    document.getElementById('gaps').innerHTML = gapsHtml;
}

function displayEnhancedPrediction(predictionData) {
    const trendClass = predictionData.trend === 'bullish' ? 'bullish' : 
                       predictionData.trend === 'bearish' ? 'bearish' : 'neutral';
    const trendText = predictionData.trend === 'bullish' ? '看涨' : 
                      predictionData.trend === 'bearish' ? '看跌' : '震荡';
    
    let predHtml = `
        <div class="prediction-row">
            <span>趋势判断</span>
            <span class="${trendClass}"><strong>${trendText}</strong></span>
        </div>
        <div class="prediction-row">
            <span>置信度</span>
            <span>${predictionData.confidence}%</span>
        </div>
        <div style="margin-top: 20px; margin-bottom: 10px;"><strong>未来3天预测：</strong></div>
    `;
    
    predictionData.predictions.forEach(p => {
        const changeClass = p.change >= 0 ? 'bullish' : 'bearish';
        const changeSign = p.change >= 0 ? '+' : '';
        predHtml += `
            <div class="prediction-row">
                <span>${p.date}</span>
                <span>预测价: ¥${p.predictedPrice} <span class="${changeClass}">(${changeSign}${p.change}%)</span></span>
            </div>
        `;
    });
    
    if (predictionData.reasons && predictionData.reasons.length > 0) {
        predHtml += '<div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">';
        predHtml += '<strong style="color: #ffd93d;">分析依据：</strong><ul style="margin: 8px 0 0 20px; color: #8892b0;">';
        predictionData.reasons.forEach(r => {
            predHtml += `<li style="margin-bottom: 5px;">${r}</li>`;
        });
        predHtml += '</ul></div>';
    }
    
    predHtml += `
        <div class="recommendation">
            <strong>操作建议：</strong>
            <p>${predictionData.recommendation}</p>
        </div>
    `;
    
    document.getElementById('prediction').innerHTML = predHtml;
}

document.getElementById('stockCode').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        analyzeStock();
    }
});

window.addEventListener('load', function() {
    document.getElementById('stockCode').value = '600519';
    loadPortfolioData();
});

let holdings = [];
let history = [];
let strategies = [];

function savePortfolioData() {
    localStorage.setItem('holdings', JSON.stringify(holdings));
    localStorage.setItem('history', JSON.stringify(history));
    localStorage.setItem('strategies', JSON.stringify(strategies));
}

function loadPortfolioData() {
    const savedHoldings = localStorage.getItem('holdings');
    const savedHistory = localStorage.getItem('history');
    const savedStrategies = localStorage.getItem('strategies');
    
    if (savedHoldings) holdings = JSON.parse(savedHoldings);
    if (savedHistory) history = JSON.parse(savedHistory);
    if (savedStrategies) strategies = JSON.parse(savedStrategies);
}

function openAddPositionModal() {
    document.getElementById('addPositionModal').classList.remove('hidden');
    document.getElementById('positionDate').value = new Date().toISOString().split('T')[0];
}

function closeAddPositionModal() {
    document.getElementById('addPositionModal').classList.add('hidden');
}

function openStrategyModal() {
    document.getElementById('strategyModal').classList.remove('hidden');
}

function closeStrategyModal() {
    document.getElementById('strategyModal').classList.add('hidden');
}

async function addPosition() {
    const code = document.getElementById('positionCode').value.trim();
    const quantity = parseInt(document.getElementById('positionQuantity').value);
    const price = parseFloat(document.getElementById('positionPrice').value);
    const date = document.getElementById('positionDate').value;
    const note = document.getElementById('positionNote').value.trim();
    
    if (!code || !quantity || !price || !date) {
        alert('请填写完整信息');
        return;
    }
    
    // Auto-detect market from code pattern
    let market = 'us';
    if (/^\d{6}$/.test(code)) market = 'cn';
    else if (/^(BTC|ETH|SOL|XRP|ADA|DOT|AVAX|MATIC|LINK|UNI|USDT)$/i.test(code)) market = 'crypto';
    
    let stockName = getStockName(code);
    
    try {
        const response = await fetch(`/api/stock/quote?code=${code}&market=${market}`);
        const data = await response.json();
        if (data.name) {
            stockName = data.name;
        }
    } catch (e) {
    }
    
    const position = {
        id: Date.now(),
        code: code,
        name: stockName,
        quantity: quantity,
        buyPrice: price,
        buyDate: date,
        note: note,
        currentPrice: price
    };
    
    holdings.push(position);
    
    history.push({
        id: Date.now(),
        type: 'buy',
        code: code,
        name: stockName,
        quantity: quantity,
        price: price,
        date: date,
        note: note
    });
    
    savePortfolioData();
    renderPortfolio();
    closeAddPositionModal();
    
    document.getElementById('positionCode').value = '';
    document.getElementById('positionQuantity').value = '';
    document.getElementById('positionPrice').value = '';
    document.getElementById('positionNote').value = '';
}

async function updatePositionPrices() {
    for (let position of holdings) {
        try {
            const pm = position.market || (/^\d{6}$/.test(position.code) ? 'cn' : 'us');
            const response = await fetch(`/api/stock/quote?code=${position.code}&market=${pm}`);
            const data = await response.json();
            if (data.price) {
                position.currentPrice = data.price;
            }
        } catch (e) {
        }
    }
    savePortfolioData();
}

async function renderPortfolio() {
    switchPortfolioTab('sim');
}

function renderHoldings() {
    const container = document.getElementById('holdingsList');
    
    if (holdings.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无持仓，点击上方按钮添加</p>';
        return;
    }
    
    let html = '';
    holdings.forEach(position => {
        const marketValue = position.quantity * position.currentPrice;
        const cost = position.quantity * position.buyPrice;
        const pnl = marketValue - cost;
        const pnlPercent = ((pnl / cost) * 100).toFixed(2);
        const pnlClass = pnl >= 0 ? 'bullish' : 'bearish';
        const pnlSign = pnl >= 0 ? '+' : '';
        
        html += `
            <div class="holding-card">
                <div class="holding-header">
                    <span class="holding-name">${position.name}</span>
                    <span class="holding-code">${position.code}</span>
                </div>
                <div class="holding-stats">
                    <div class="holding-stat">
                        <span class="holding-stat-label">持仓数量</span>
                        <span class="holding-stat-value">${position.quantity}股</span>
                    </div>
                    <div class="holding-stat">
                        <span class="holding-stat-label">成本价</span>
                        <span class="holding-stat-value">¥${position.buyPrice}</span>
                    </div>
                    <div class="holding-stat">
                        <span class="holding-stat-label">现价</span>
                        <span class="holding-stat-value">¥${position.currentPrice}</span>
                    </div>
                    <div class="holding-stat">
                        <span class="holding-stat-label">市值</span>
                        <span class="holding-stat-value">¥${marketValue.toFixed(2)}</span>
                    </div>
                    <div class="holding-stat">
                        <span class="holding-stat-label">浮动盈亏</span>
                        <span class="holding-stat-value ${pnlClass}">${pnlSign}¥${pnl.toFixed(2)}</span>
                    </div>
                    <div class="holding-stat">
                        <span class="holding-stat-label">收益率</span>
                        <span class="holding-stat-value ${pnlClass}">${pnlSign}${pnlPercent}%</span>
                    </div>
                </div>
                <div class="holding-actions">
                    <button class="btn-small btn-success" onclick="sellPosition(${position.id})">卖出</button>
                    <button class="btn-small btn-danger" onclick="removePosition(${position.id})">删除</button>
                </div>
                ${position.note ? `<p style="margin-top: 10px; color: #8892b0; font-size: 0.9rem;">备注: ${position.note}</p>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function sellPosition(id) {
    const position = holdings.find(h => h.id === id);
    if (!position) return;
    
    const sellPrice = position.currentPrice;
    const marketValue = position.quantity * sellPrice;
    const cost = position.quantity * position.buyPrice;
    const pnl = marketValue - cost;
    
    history.push({
        id: Date.now(),
        type: 'sell',
        code: position.code,
        name: position.name,
        quantity: position.quantity,
        price: sellPrice,
        costPrice: position.buyPrice,
        pnl: pnl,
        date: new Date().toISOString().split('T')[0],
        note: `卖出${position.name}，盈亏: ${pnl >= 0 ? '+' : ''}¥${pnl.toFixed(2)}`
    });
    
    holdings = holdings.filter(h => h.id !== id);
    savePortfolioData();
    renderPortfolio();
}

function removePosition(id) {
    if (confirm('确定要删除这个持仓吗？')) {
        holdings = holdings.filter(h => h.id !== id);
        savePortfolioData();
        renderPortfolio();
    }
}

function renderHistory() {
    const container = document.getElementById('historyList');
    
    if (history.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无交易记录</p>';
        return;
    }
    
    let html = '';
    history.slice().reverse().forEach(record => {
        const typeClass = record.type === 'buy' ? 'bullish' : 'bearish';
        const typeText = record.type === 'buy' ? '买入' : '卖出';
        
        html += `
            <div class="history-card">
                <div class="holding-header">
                    <span class="holding-name">${record.name} <span class="${typeClass}">(${typeText})</span></span>
                    <span class="holding-code">${record.date}</span>
                </div>
                <div class="holding-stats">
                    <div class="holding-stat">
                        <span class="holding-stat-label">数量</span>
                        <span class="holding-stat-value">${record.quantity}股</span>
                    </div>
                    <div class="holding-stat">
                        <span class="holding-stat-label">价格</span>
                        <span class="holding-stat-value">¥${record.price}</span>
                    </div>
                    ${record.pnl !== undefined ? `
                    <div class="holding-stat">
                        <span class="holding-stat-label">盈亏</span>
                        <span class="holding-stat-value ${record.pnl >= 0 ? 'bullish' : 'bearish'}">
                            ${record.pnl >= 0 ? '+' : ''}¥${record.pnl.toFixed(2)}
                        </span>
                    </div>
                    ` : ''}
                </div>
                ${record.note ? `<p style="margin-top: 10px; color: #8892b0; font-size: 0.9rem;">${record.note}</p>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function saveStrategy() {
    const name = document.getElementById('strategyName').value.trim();
    const desc = document.getElementById('strategyDesc').value.trim();
    const condition = document.getElementById('strategyCondition').value;
    const note = document.getElementById('strategyNote').value.trim();
    
    if (!name || !desc) {
        alert('请填写策略名称和描述');
        return;
    }
    
    const strategy = {
        id: Date.now(),
        name: name,
        description: desc,
        condition: condition,
        note: note,
        createdAt: new Date().toISOString().split('T')[0],
        uses: 0
    };
    
    strategies.push(strategy);
    savePortfolioData();
    renderStrategies();
    closeStrategyModal();
    
    document.getElementById('strategyName').value = '';
    document.getElementById('strategyDesc').value = '';
    document.getElementById('strategyNote').value = '';
}

function renderStrategies() {
    const container = document.getElementById('strategyList');
    
    if (strategies.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无策略，记录你的投资策略吧！</p>';
        return;
    }
    
    let html = '';
    strategies.forEach(strategy => {
        html += `
            <div class="strategy-card">
                <div class="holding-header">
                    <span class="holding-name">${strategy.name}</span>
                    <span class="holding-code">${strategy.createdAt}</span>
                </div>
                <p style="color: #fff; margin-bottom: 10px;">${strategy.description}</p>
                <p style="color: #8892b0; font-size: 0.9rem;">类型: ${getConditionText(strategy.condition)}</p>
                ${strategy.note ? `<p style="color: #8892b0; font-size: 0.9rem; margin-top: 10px;">笔记: ${strategy.note}</p>` : ''}
                <div class="holding-actions">
                    <button class="btn-small btn-info" onclick="useStrategy(${strategy.id})">应用策略</button>
                    <button class="btn-small btn-danger" onclick="deleteStrategy(${strategy.id})">删除</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getConditionText(condition) {
    const conditions = {
        'technical': '技术指标',
        'fundamental': '基本面',
        'news': '消息面',
        'mixed': '综合'
    };
    return conditions[condition] || condition;
}

function useStrategy(id) {
    const strategy = strategies.find(s => s.id === id);
    if (strategy) {
        strategy.uses = (strategy.uses || 0) + 1;
        savePortfolioData();
        alert(`策略 "${strategy.name}" 已记录使用！`);
    }
}

function deleteStrategy(id) {
    if (confirm('确定要删除这个策略吗？')) {
        strategies = strategies.filter(s => s.id !== id);
        savePortfolioData();
        renderStrategies();
    }
}

function renderSummary() {
    let totalCost = 0;
    let totalMarketValue = 0;
    
    holdings.forEach(position => {
        totalCost += position.quantity * position.buyPrice;
        totalMarketValue += position.quantity * position.currentPrice;
    });
    
    const totalPnL = totalMarketValue - totalCost;
    const totalReturn = totalCost > 0 ? ((totalPnL / totalCost) * 100).toFixed(2) : 0;
    
    document.getElementById('totalAssets').textContent = `¥${(totalCost + totalPnL).toFixed(2)}`;
    document.getElementById('totalMarketValue').textContent = `¥${totalMarketValue.toFixed(2)}`;
    
    const pnlClass = totalPnL >= 0 ? 'bullish' : 'bearish';
    const pnlSign = totalPnL >= 0 ? '+' : '';
    
    document.getElementById('totalPnL').textContent = `${pnlSign}¥${totalPnL.toFixed(2)}`;
    document.getElementById('totalPnL').style.color = totalPnL >= 0 ? '#ff4757' : '#00ff88';
    document.getElementById('totalReturn').textContent = `${pnlSign}${totalReturn}%`;
    document.getElementById('totalReturn').style.color = totalPnL >= 0 ? '#ff4757' : '#00ff88';
}

function getAIRecommendation() {
    let recommendation = `
        <div class="recommendation-card">
            <h4>🤖 AI智能分析建议</h4>
            <ul>
                <li>基于你的持仓表现，建议关注高收益率股票的加仓机会</li>
                <li>对亏损较大的持仓，考虑设置止损位控制风险</li>
                <li>建议分散投资，避免单一股票占比过高</li>
    `;
    
    if (strategies.length > 0) {
        const topStrategy = strategies.reduce((a, b) => (a.uses || 0) > (b.uses || 0) ? a : b);
        recommendation += `<li>你最常用的策略是"${topStrategy.name}"，考虑继续优化这个策略</li>`;
    }
    
    if (holdings.length > 0) {
        const topHolding = holdings.reduce((a, b) => {
            const aPnl = (a.currentPrice - a.buyPrice) / a.buyPrice;
            const bPnl = (b.currentPrice - b.buyPrice) / b.buyPrice;
            return aPnl > bPnl ? a : b;
        });
        recommendation += `<li>表现最好的持仓是${topHolding.name}，可以分析其成功原因</li>`;
    }
    
    recommendation += `
            </ul>
        </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = recommendation;
    const strategySection = document.querySelector('.strategy-section');
    const existingCard = strategySection.querySelector('.recommendation-card');
    if (existingCard) {
        existingCard.remove();
    }
    strategySection.appendChild(container.firstChild);
}

let currentNewsMarket = 'cn';
let currentNewsKeyword = '';
let currentNewsPage = 1;
const newsPageSize = 30;
let currentWatchlistMarket = 'cn';
let currentSavedWatchlistMarket = 'cn';
const watchlistStorageKey = 'watchlist_v1';

function switchTab(tab) {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(t => t.classList.remove('active'));

    const searchSection = document.querySelector('.search-section');
    if (searchSection) searchSection.classList.remove('hidden');
    
    const analysisSection = document.getElementById('analysisSection');
    const newsSection = document.getElementById('newsSection');
    const stockPickerSection = document.getElementById('stockPickerSection');
    const diarySection = document.getElementById('diarySection');
    const myPortfolioSection = document.getElementById('myPortfolioSection');
    const portfolioSection = document.getElementById('portfolioSection');
    const financeSection = document.getElementById('financeSection');
    
    analysisSection.classList.add('hidden');
    newsSection.classList.add('hidden');
    stockPickerSection.classList.add('hidden');
    diarySection.classList.add('hidden');
    myPortfolioSection.classList.add('hidden');
    portfolioSection.classList.add('hidden');
    if (financeSection) financeSection.classList.add('hidden');
    
    if (tab === 'analysis') {
        tabs[0].classList.add('active');
        analysisSection.classList.remove('hidden');
    } else if (tab === 'news') {
        tabs[1].classList.add('active');
        newsSection.classList.remove('hidden');
        if (searchSection) searchSection.classList.add('hidden');
        initNewsUIOnce();
        loadNewsPage(1);
    } else if (tab === 'stockPicker') {
        tabs[2].classList.add('active');
        stockPickerSection.classList.remove('hidden');
        switchStockPickerTab('us');
    } else if (tab === 'finance') {
        tabs[3].classList.add('active');
        if (financeSection) {
            financeSection.classList.remove('hidden');
            loadFinanceData();
        }
    } else if (tab === 'diary') {
        tabs[4].classList.add('active');
        diarySection.classList.remove('hidden');
        initDiary();
    } else if (tab === 'myPortfolio') {
        tabs[5].classList.add('active');
        myPortfolioSection.classList.remove('hidden');
        renderMyHoldings();
        renderMyTradeHistory();
    } else {
        tabs[6].classList.add('active');
        portfolioSection.classList.remove('hidden');
        if (searchSection) searchSection.classList.add('hidden');
        switchPortfolioTab('sim');
    }
}

function switchStockPickerTab(tab) {
    const tabs = document.querySelectorAll('.stock-picker-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    const cnTab = document.getElementById('cnStockPickerTab');
    const usTab = document.getElementById('usStockPickerTab');
    
    cnTab.classList.add('hidden');
    usTab.classList.add('hidden');
    
    if (tab === 'cn') {
        tabs[0].classList.add('active');
        cnTab.classList.remove('hidden');
        loadStockPicker('cn');
    } else if (tab === 'us') {
        tabs[1].classList.add('active');
        usTab.classList.remove('hidden');
        loadStockPicker('us');
    }
}

async function loadStockPicker(market = 'cn') {
    const container = document.getElementById(market === 'us' ? 'usStockPickerList' : 'stockPickerList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-picker">
            <div class="spinner"></div>
            <p>正在加载推荐股票...</p>
        </div>
    `;
    
    try {
        const response = await apiFetch(`/api/stock/picker?market=${encodeURIComponent(market)}`);
        const result = await readJsonOrThrow(response);
        
        if (result.success && result.data) {
            if (market === 'us') {
                renderStockPickerUS(result.data, result.extras || {});
            } else {
                renderStockPickerCN(result.data);
            }
        } else {
            container.innerHTML = '<p style="color: #ff4757; text-align: center; padding: 60px 20px;">加载失败，请稍后重试</p>';
        }
    } catch (error) {
        console.error('加载智能选股失败:', error);
        container.innerHTML = `<p style="color: #ff4757; text-align: center; padding: 60px 20px;">${escapeHtml(error && error.message ? error.message : '网络错误，请稍后重试')}</p>`;
    }
}

function renderStockPickerCN(stocks) {
    const container = document.getElementById('stockPickerList');
    if (!container) return;
    
    container.innerHTML = stocks.map(stock => {
        const changeClass = stock.changePercent >= 0 ? 'positive' : 'negative';
        const changeSign = stock.changePercent >= 0 ? '+' : '';
        
        return `
            <div class="stock-picker-card">
                <div class="picker-card-header">
                    <div class="picker-stock-info">
                        <div class="picker-stock-name">${stock.name}</div>
                        <div class="picker-stock-code">${stock.code}</div>
                        <span class="picker-stock-industry">${stock.industry}</span>
                    </div>
                    <div class="picker-price-info">
                        <div class="picker-current-price">¥${stock.currentPrice.toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="picker-change ${changeClass}">${changeSign}${stock.changePercent.toFixed(2)}%</div>
                    </div>
                </div>
                
                <div class="picker-financials">
                    <div class="picker-financial-item">
                        <span class="picker-financial-label">市盈率 (PE)</span>
                        <span class="picker-financial-value">${stock.pe > 0 ? stock.pe.toFixed(1) : '--'}</span>
                    </div>
                    <div class="picker-financial-item">
                        <span class="picker-financial-label">市净率 (PB)</span>
                        <span class="picker-financial-value">${stock.pb > 0 ? stock.pb.toFixed(1) : '--'}</span>
                    </div>
                </div>
                
                <div class="picker-reasons">
                    <div class="picker-reasons-title">📋 买入理由</div>
                    <div class="picker-reasons-list">
                        ${stock.reasons.map(reason => `
                            <div class="picker-reason-item">
                                <span class="picker-reason-dot">•</span>
                                <span>${reason}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="picker-price-targets">
                    <div class="picker-target-item">
                        <span class="picker-target-label">🎯 建议买入价</span>
                        <span class="picker-target-value buy">¥${stock.buyPrice.toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="picker-target-item">
                        <span class="picker-target-label">⚠️ 建议止损价</span>
                        <span class="picker-target-value stop">¥${stock.stopLoss.toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStockPickerUS(stocks, extras) {
    const container = document.getElementById('usStockPickerList');
    if (!container) return;
    const extraEl = document.getElementById('usStockPickerExtras');
    if (extraEl) {
        const etfs = (extras.etfs || []).map(x => `<span class="strategy-tag">${escapeHtml(String(x))}</span>`).join(' ');
        const options = (extras.options || []).map(x => `<div class="picker-reason-item"><span class="picker-reason-dot">•</span><span>${escapeHtml(String(x))}</span></div>`).join('');
        extraEl.innerHTML = `
            <div class="stock-picker-card">
                <div class="picker-reasons">
                    <div class="picker-reasons-title">📌 重点关注</div>
                    <div class="picker-reasons-list">
                        ${etfs ? `<div class="picker-reason-item"><span class="picker-reason-dot">•</span><span>ETF：${etfs}</span></div>` : ''}
                        ${options ? `<div class="picker-reason-item"><span class="picker-reason-dot">•</span><span>期权思路（非投资建议）：</span></div>${options}` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = stocks.map(stock => {
        const chg = Number(stock.changePercent || 0);
        const changeClass = chg >= 0 ? 'positive' : 'negative';
        const changeSign = chg >= 0 ? '+' : '';
        const px = Number(stock.currentPrice || 0);
        const buy = Number(stock.buyPrice || 0);
        const sl = Number(stock.stopLoss || 0);
        const reasons = Array.isArray(stock.reasons) ? stock.reasons : [];
        return `
            <div class="stock-picker-card">
                <div class="picker-card-header">
                    <div class="picker-stock-info">
                        <div class="picker-stock-name">${escapeHtml(stock.name || stock.code || '')}</div>
                        <div class="picker-stock-code">${escapeHtml(stock.code || '')}</div>
                        ${stock.industry ? `<span class="picker-stock-industry">${escapeHtml(stock.industry)}</span>` : ''}
                    </div>
                    <div class="picker-price-info">
                        <div class="picker-current-price">$${px.toFixed(2)}</div>
                        <div class="picker-change ${changeClass}">${changeSign}${chg.toFixed(2)}%</div>
                    </div>
                </div>
                <div class="picker-reasons">
                    <div class="picker-reasons-title">📋 推荐理由</div>
                    <div class="picker-reasons-list">
                        ${reasons.map(reason => `
                            <div class="picker-reason-item">
                                <span class="picker-reason-dot">•</span>
                                <span>${escapeHtml(String(reason))}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="picker-price-targets">
                    <div class="picker-target-item">
                        <span class="picker-target-label">🎯 参考买入价</span>
                        <span class="picker-target-value buy">$${buy.toFixed(2)}</span>
                    </div>
                    <div class="picker-target-item">
                        <span class="picker-target-label">⚠️ 参考止损价</span>
                        <span class="picker-target-value stop">$${sl.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function switchMyPortfolioTab(tab) {
    const tabs = document.querySelectorAll('.my-portfolio-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    const manualTab = document.getElementById('manualTab');
    const aiTab = document.getElementById('aiTab');
    
    manualTab.classList.add('hidden');
    aiTab.classList.add('hidden');
    
    if (tab === 'manual') {
        tabs[0].classList.add('active');
        manualTab.classList.remove('hidden');
    } else {
        tabs[1].classList.add('active');
        aiTab.classList.remove('hidden');
    }
}

let selectedBroker = 'galaxy';

function selectBroker(broker) {
    selectedBroker = broker;
    const options = document.querySelectorAll('.broker-option');
    options.forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

let verifyCodeCountdown = 0;

function sendVerifyCode() {
    if (verifyCodeCountdown > 0) return;
    
    const phone = document.getElementById('brokerPhone').value;
    if (!phone) {
        alert('请先输入手机号码');
        return;
    }
    
    alert('验证码已发送！');
    verifyCodeCountdown = 60;
    const btn = event.currentTarget;
    const originalText = btn.textContent;
    
    const interval = setInterval(() => {
        verifyCodeCountdown--;
        btn.textContent = `${verifyCodeCountdown}秒后重发`;
        btn.disabled = true;
        
        if (verifyCodeCountdown <= 0) {
            clearInterval(interval);
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }, 1000);
}

function connectBroker() {
    const account = document.getElementById('brokerAccount').value;
    const password = document.getElementById('brokerPassword').value;
    const phone = document.getElementById('brokerPhone').value;
    const verifyCode = document.getElementById('brokerVerifyCode').value;
    
    if (!account || !password || !phone || !verifyCode) {
        alert('请填写完整信息');
        return;
    }
    
    const brokerNames = {
        'galaxy': '中国银河证券',
        'citic': '中信证券',
        'htsec': '海通证券',
        'gf': '广发证券'
    };
    
    const connectionStatus = document.getElementById('connectionStatus');
    connectionStatus.classList.remove('hidden');
    connectionStatus.querySelector('.status-text').textContent = 
        `✓ 账户已连接 - ${brokerNames[selectedBroker]}`;
    
    alert('账户绑定成功！');
}

let aiAgentRunning = false;
let aiAgentInterval = null;

function startAIAgent() {
    if (aiAgentRunning) return;
    
    const strategy = document.getElementById('aiStrategy').value;
    if (!strategy) {
        alert('请先输入交易策略');
        return;
    }
    
    aiAgentRunning = true;
    const aiAgentStatus = document.getElementById('aiAgentStatus');
    aiAgentStatus.classList.remove('hidden');
    
    const log = aiAgentStatus.querySelector('.agent-log');
    let logCount = 4;
    
    aiAgentInterval = setInterval(() => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const messages = [
            '正在监控市场数据...',
            '分析技术指标中...',
            '检查策略条件...',
            '暂无符合策略的交易机会',
            '继续监控中...',
            '扫描股票池...'
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        
        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        logItem.textContent = `[${timeStr}] ${msg}`;
        log.appendChild(logItem);
        log.scrollTop = log.scrollHeight;
        
        logCount++;
    }, 3000);
    
    alert('AI Agent 已启动！');
}

function stopAIAgent() {
    if (!aiAgentRunning) return;
    
    aiAgentRunning = false;
    if (aiAgentInterval) {
        clearInterval(aiAgentInterval);
        aiAgentInterval = null;
    }
    
    alert('AI Agent 已停止！');
}

let myHoldings = [];
let myTradeHistory = [];

function loadMyPortfolioData() {
    const savedHoldings = localStorage.getItem('myHoldings');
    const savedTradeHistory = localStorage.getItem('myTradeHistory');
    if (savedHoldings) {
        myHoldings = JSON.parse(savedHoldings);
    }
    if (savedTradeHistory) {
        myTradeHistory = JSON.parse(savedTradeHistory);
    }
}

function saveMyPortfolioData() {
    localStorage.setItem('myHoldings', JSON.stringify(myHoldings));
    localStorage.setItem('myTradeHistory', JSON.stringify(myTradeHistory));
}

function updateMyPortfolioSummary() {
    const totalAmountEl = document.getElementById('myTotalAmount');
    const totalPnLEl = document.getElementById('myTotalPnL');
    const totalReturnEl = document.getElementById('myTotalReturn');
    const positionCountEl = document.getElementById('myPositionCount');
    
    if (!totalAmountEl || !totalPnLEl || !totalReturnEl || !positionCountEl) {
        return;
    }
    
    let totalCost = 0;
    let totalMarketValue = 0;
    
    myHoldings.forEach(position => {
        totalCost += position.quantity * position.buyPrice;
        totalMarketValue += position.quantity * position.currentPrice;
    });
    
    const totalPnL = totalMarketValue - totalCost;
    const totalReturn = totalCost > 0 ? ((totalPnL / totalCost) * 100) : 0;
    const pnlClass = totalPnL >= 0 ? 'positive' : 'negative';
    
    totalAmountEl.textContent = `¥${totalMarketValue.toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    totalPnLEl.textContent = `${totalPnL >= 0 ? '+' : ''}¥${totalPnL.toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    totalPnLEl.className = `my-summary-value ${pnlClass}`;
    totalReturnEl.textContent = `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`;
    totalReturnEl.className = `my-summary-value ${pnlClass}`;
    positionCountEl.textContent = `${myHoldings.length}只`;
}

function addMyPosition() {
    const code = document.getElementById('myPositionCode').value;
    const name = document.getElementById('myPositionName').value;
    const quantity = parseInt(document.getElementById('myPositionQuantity').value);
    const price = parseFloat(document.getElementById('myPositionPrice').value);
    const date = document.getElementById('myPositionDate').value;
    const fee = parseFloat(document.getElementById('myPositionFee').value) || 0;
    const note = document.getElementById('myPositionNote').value;
    
    if (!code || !quantity || !price) {
        alert('请填写必填项');
        return;
    }
    
    const stockName = name || getStockName(code) || '未知股票';
    
    const position = {
        id: Date.now(),
        code: code,
        name: stockName,
        quantity: quantity,
        buyPrice: price,
        buyDate: date || new Date().toISOString().split('T')[0],
        fee: fee,
        note: note,
        currentPrice: price * (1 + (Math.random() - 0.4) * 0.1)
    };
    
    myHoldings.push(position);
    
    const trade = {
        id: Date.now(),
        date: position.buyDate,
        type: 'buy',
        code: code,
        name: stockName,
        quantity: quantity,
        price: price
    };
    myTradeHistory.unshift(trade);
    
    renderMyHoldings();
    renderMyTradeHistory();
    updateMyPortfolioSummary();
    saveMyPortfolioData();
    
    document.getElementById('myPositionCode').value = '';
    document.getElementById('myPositionName').value = '';
    document.getElementById('myPositionQuantity').value = '';
    document.getElementById('myPositionPrice').value = '';
    document.getElementById('myPositionDate').value = '';
    document.getElementById('myPositionNote').value = '';
    
    alert('持仓添加成功！');
}

function renderMyHoldings() {
    const container = document.getElementById('myHoldingsList');
    if (!container) return;
    
    if (myHoldings.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无持仓</p>';
    } else {
        let html = '';
        myHoldings.forEach(position => {
            const pnl = (position.currentPrice - position.buyPrice) * position.quantity;
            const pnlPercent = ((position.currentPrice - position.buyPrice) / position.buyPrice * 100);
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            
            html += `
                <div class="my-holding-item">
                    <div class="my-holding-header">
                        <div class="my-holding-info">
                            <span class="my-holding-name">${position.name}</span>
                            <span class="my-holding-code">${position.code}</span>
                        </div>
                        <div class="my-holding-pnl ${pnlClass}">
                            ${pnl >= 0 ? '+' : ''}¥${pnl.toFixed(2)}
                        </div>
                    </div>
                    <div class="my-holding-details">
                        <div class="my-holding-detail-item">
                            <span class="label">持仓数量</span>
                            <span class="value">${position.quantity}股</span>
                        </div>
                        <div class="my-holding-detail-item">
                            <span class="label">买入价格</span>
                            <span class="value">¥${position.buyPrice.toFixed(2)}</span>
                        </div>
                        <div class="my-holding-detail-item">
                            <span class="label">当前价格</span>
                            <span class="value">¥${position.currentPrice.toFixed(2)}</span>
                        </div>
                        <div class="my-holding-detail-item">
                            <span class="label">收益率</span>
                            <span class="value ${pnlClass}">${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    updateMyPortfolioSummary();
}

function renderMyTradeHistory() {
    const container = document.getElementById('myTradeHistory');
    if (!container) return;
    
    if (myTradeHistory.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无交易记录</p>';
        return;
    }
    
    let html = '';
    myTradeHistory.forEach(trade => {
        html += `
            <div class="my-history-item">
                <div class="my-history-date">${trade.date}</div>
                <div class="my-history-content">
                    <div class="my-history-type ${trade.type}">${trade.type === 'buy' ? '买入' : '卖出'}</div>
                    <div class="my-history-stock">${trade.name} (${trade.code})</div>
                    <div class="my-history-quantity">${trade.quantity}股</div>
                    <div class="my-history-price">¥${trade.price.toFixed(2)}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

let diaries = [];
let selectedMood = null;

function initDiary() {
    const today = new Date().toISOString().split('T')[0];
    const diaryDateInput = document.getElementById('diaryDate');
    if (diaryDateInput) {
        diaryDateInput.value = today;
    }
    
    const moodTags = document.querySelectorAll('.mood-tag');
    moodTags.forEach(tag => {
        tag.addEventListener('click', function() {
            moodTags.forEach(t => t.classList.remove('selected'));
            this.classList.add('selected');
            selectedMood = this.dataset.mood;
        });
    });
    
    loadDiaries();
}

function loadDiaries() {
    const saved = localStorage.getItem('tradingDiaries');
    if (saved) {
        diaries = JSON.parse(saved);
    } else {
        diaries = [];
    }
}

function saveDiary() {
    const date = document.getElementById('diaryDate').value;
    const title = document.getElementById('diaryTitle').value;
    const trade = document.getElementById('diaryTrade').value;
    const note = document.getElementById('diaryNote').value;
    const knowledge = document.getElementById('diaryKnowledge').value;
    
    if (!title) {
        alert('请输入日记标题');
        return;
    }
    
    const moodEmojis = {
        'excited': '😆',
        'calm': '😊',
        'anxious': '😰',
        'frustrated': '😤',
        'regret': '😔'
    };
    
    const diary = {
        id: Date.now(),
        date: date,
        title: title,
        mood: selectedMood || 'calm',
        moodEmoji: moodEmojis[selectedMood || 'calm'],
        trade: trade,
        note: note,
        knowledge: knowledge
    };
    
    diaries.unshift(diary);
    localStorage.setItem('tradingDiaries', JSON.stringify(diaries));
    
    renderDiaries();
    
    document.getElementById('diaryTitle').value = '';
    document.getElementById('diaryTrade').value = '';
    document.getElementById('diaryNote').value = '';
    document.getElementById('diaryKnowledge').value = '';
    document.querySelectorAll('.mood-tag').forEach(t => t.classList.remove('selected'));
    selectedMood = null;
    
    alert('日记保存成功！');
}

function renderDiaries() {
    const container = document.getElementById('diaryList');
    if (!container) return;
    
    if (diaries.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">还没有日记，开始写第一篇吧！</p>';
        return;
    }
    
    let html = '';
    diaries.forEach(diary => {
        html += `
            <div class="diary-item">
                <div class="diary-item-header">
                    <div class="diary-item-date">${diary.date}</div>
                    <div class="diary-item-mood">${diary.moodEmoji}</div>
                </div>
                <div class="diary-item-title">${diary.title}</div>
                <div class="diary-item-content">
                    ${diary.trade ? `<p><strong>今日交易：</strong>${diary.trade}</p>` : ''}
                    ${diary.note ? `<p><strong>心得体会：</strong>${diary.note}</p>` : ''}
                    ${diary.knowledge ? `<p><strong>知识点：</strong>${diary.knowledge}</p>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function loadStockRanking() {
    try {
        const response = await apiFetch('/api/paper/ranking');
        const result = await readJsonOrThrow(response);
        
        if (result.success && result.data) {
            renderStockRanking(result.data);
        }
    } catch (error) {
        console.error('加载股票榜单失败:', error);
        const container = document.getElementById('stockRanking');
        if (container) {
            container.innerHTML = `<p style="color: #ff4757; text-align: center; padding: 60px 20px;">${escapeHtml(error && error.message ? error.message : '加载失败')}</p>`;
        }
    }
}

function renderStockRanking(stocks) {
    const container = document.getElementById('stockRanking');
    if (!container) return;
    
    container.innerHTML = stocks.map(stock => {
        const changeClass = stock.changePercent >= 0 ? 'positive' : 'negative';
        return `
            <div class="stock-ranking-item">
                <div class="stock-info">
                    <span class="stock-name">${stock.symbol}</span>
                    <span class="stock-code">${stock.symbol}</span>
                </div>
                <div class="stock-price">
                    <span class="price">$${Number(stock.price || 0).toFixed(2)}</span>
                    <span class="change ${changeClass}">${stock.changePercent >= 0 ? '+' : ''}${Number(stock.changePercent || 0).toFixed(2)}%</span>
                </div>
                <button class="btn-primary btn-small" onclick="openTradeModal('${stock.symbol}', '${stock.symbol}', ${Number(stock.price || 0)})">交易</button>
            </div>
        `;
    }).join('');
}

function switchPortfolioTab(tab) {
    const tabs = document.querySelectorAll('.portfolio-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    const simTab = document.getElementById('simTab');
    const liveTab = document.getElementById('liveTab');
    const pkTab = document.getElementById('pkTab');
    
    if (simTab) simTab.classList.add('hidden');
    if (liveTab) liveTab.classList.add('hidden');
    pkTab.classList.add('hidden');
    
    if (tab === 'sim') {
        tabs[0].classList.add('active');
        if (simTab) simTab.classList.remove('hidden');
        paperBackendHealthCheck().then(ok => {
            if (!ok) return;
            loadStockRanking();
            checkCapitalSet();
            startPaperPolling();
            refreshPaperTradingUI();
        });
    } else if (tab === 'live') {
        tabs[1].classList.add('active');
        if (liveTab) liveTab.classList.remove('hidden');
        stopPaperPolling();
        futuInitLiveTab();
    } else {
        tabs[2].classList.add('active');
        pkTab.classList.remove('hidden');
        stopPaperPolling();
    }
}

async function futuInitLiveTab() {
    const statusEl = document.getElementById('futuStatus');
    if (statusEl) statusEl.textContent = '检查后端...';
    try {
        const health = await apiFetch('/api/health');
        const ok = await readJsonOrThrow(health);
        if (!health.ok || !ok.success) throw new Error(ok.error || 'health failed');
    } catch (e) {
        if (statusEl) statusEl.textContent = `后端不可用：${e && e.message ? e.message : '未知错误'}`;
        return;
    }
    futuRefreshStatus();
    futuRefreshAccounts();
    futuRefreshStrategies();
    futuRefreshLogs();
}

async function futuRefreshStatus() {
    const statusEl = document.getElementById('futuStatus');
    try {
        const resp = await apiFetch('/api/futu/status');
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'status failed');
        const s = data.data || {};
        statusEl.textContent = s.connected ? `已连接 OpenD：${s.host}:${s.port}` : `未连接 OpenD：${s.last_error || ''}`;
    } catch (e) {
        if (statusEl) statusEl.textContent = `状态获取失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuConnect() {
    const host = (document.getElementById('futuHost') && document.getElementById('futuHost').value || '').trim();
    const port = Number(document.getElementById('futuPort') && document.getElementById('futuPort').value || 11111);
    const statusEl = document.getElementById('futuStatus');
    if (statusEl) statusEl.textContent = '连接中...';
    try {
        const resp = await apiFetch('/api/futu/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port })
        });
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'connect failed');
        await futuRefreshStatus();
        await futuRefreshAccounts();
        await futuRefreshStrategies();
    } catch (e) {
        if (statusEl) statusEl.textContent = `连接失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuUnlock() {
    const env = (document.getElementById('futuEnv') && document.getElementById('futuEnv').value || 'SIMULATE').trim();
    const pwd = (document.getElementById('futuUnlockPwd') && document.getElementById('futuUnlockPwd').value || '').trim();
    const statusEl = document.getElementById('futuStatus');
    if (statusEl) statusEl.textContent = '解锁中...';
    try {
        const resp = await apiFetch('/api/futu/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ env, password: pwd })
        });
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'unlock failed');
        if (statusEl) statusEl.textContent = '解锁成功';
    } catch (e) {
        if (statusEl) statusEl.textContent = `解锁失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuRefreshAccounts() {
    const env = (document.getElementById('futuEnv') && document.getElementById('futuEnv').value || 'SIMULATE').trim();
    const sel = document.getElementById('futuAccount');
    if (!sel) return;
    sel.innerHTML = '';
    try {
        const resp = await apiFetch(`/api/futu/accounts?env=${encodeURIComponent(env)}`);
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'accounts failed');
        const items = data.data || [];
        if (!items.length) {
            sel.innerHTML = '<option value="">无账户</option>';
            return;
        }
        sel.innerHTML = items.map(a => `<option value="${escapeHtml(a.acc_id)}">${escapeHtml(a.acc_id)} · ${escapeHtml(a.trd_market || '')} · ${escapeHtml(a.trd_env || '')}</option>`).join('');
        sel.value = String(items[0].acc_id || '');
    } catch (e) {
        sel.innerHTML = '<option value="">加载失败</option>';
    }
}

async function futuRunOnce() {
    const env = (document.getElementById('futuEnv') && document.getElementById('futuEnv').value || 'SIMULATE').trim();
    const accId = (document.getElementById('futuAccount') && document.getElementById('futuAccount').value || '').trim();
    const strategyId = Number(document.getElementById('futuStrategyId') && document.getElementById('futuStrategyId').value || 0);
    const symbolsRaw = (document.getElementById('futuSymbols') && document.getElementById('futuSymbols').value || '').trim();
    const klineType = (document.getElementById('futuKlineType') && document.getElementById('futuKlineType').value || 'K_5M').trim();
    const qty = Number(document.getElementById('futuQty') && document.getElementById('futuQty').value || 1);
    const statusEl = document.getElementById('futuStatus');
    if (!accId || !strategyId || !symbolsRaw) {
        if (statusEl) statusEl.textContent = '请填写账户、策略ID、标的';
        return;
    }
    const symbols = symbolsRaw.replace('，', ',').replace('；', ',').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (statusEl) statusEl.textContent = '运行中...';
    try {
        const resp = await apiFetch('/api/futu/strategy/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ env, acc_id: accId, strategy_id: strategyId, symbols, quantity: qty, kline_type: klineType })
        });
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'run failed');
        if (statusEl) statusEl.textContent = `完成：${(data.data.actions || []).length} 笔动作`;
        await futuRefreshLogs();
    } catch (e) {
        if (statusEl) statusEl.textContent = `运行失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuBotStart() {
    const env = (document.getElementById('futuEnv') && document.getElementById('futuEnv').value || 'SIMULATE').trim();
    let accId = (document.getElementById('futuAccount') && document.getElementById('futuAccount').value || '').trim();
    accId = accId.replace(/\D/g, '');
    const strategyId = Number(document.getElementById('futuStrategyId') && document.getElementById('futuStrategyId').value || 0);
    const symbolsRaw = (document.getElementById('futuSymbols') && document.getElementById('futuSymbols').value || '').trim();
    const klineType = (document.getElementById('futuKlineType') && document.getElementById('futuKlineType').value || 'K_5M').trim();
    const intervalSec = Number(document.getElementById('futuIntervalSec') && document.getElementById('futuIntervalSec').value || 30);
    const qty = Number(document.getElementById('futuQty') && document.getElementById('futuQty').value || 1);
    const statusEl = document.getElementById('futuStatus');
    if (!accId || !strategyId || !symbolsRaw) {
        if (statusEl) statusEl.textContent = '请填写账户、策略ID、标的';
        return;
    }
    const symbols = symbolsRaw.replace('，', ',').replace('；', ',').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (statusEl) statusEl.textContent = '启动监控中...';
    try {
        const resp = await apiFetch('/api/futu/bot/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                env,
                acc_id: accId,
                strategy_id: strategyId,
                symbols,
                quantity: qty,
                kline_type: klineType,
                interval_seconds: intervalSec
            })
        });
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'start failed');
        if (statusEl) statusEl.textContent = '监控已启动（后台自动运行，无需再点运行一次）';
        await futuRefreshLogs();
    } catch (e) {
        if (statusEl) statusEl.textContent = `启动失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuBotStop() {
    const statusEl = document.getElementById('futuStatus');
    if (statusEl) statusEl.textContent = '停止中...';
    try {
        const resp = await apiFetch('/api/futu/bot/stop', { method: 'POST' });
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'stop failed');
        if (statusEl) statusEl.textContent = '监控已停止';
        await futuRefreshLogs();
    } catch (e) {
        if (statusEl) statusEl.textContent = `停止失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuDemoBuy() {
    let accId = (document.getElementById('futuAccount') && document.getElementById('futuAccount').value || '').trim();
    accId = accId.replace(/\D/g, '');
    const symbolsRaw = (document.getElementById('futuSymbols') && document.getElementById('futuSymbols').value || '').trim();
    const qty = Number(document.getElementById('futuQty') && document.getElementById('futuQty').value || 1);
    const statusEl = document.getElementById('futuStatus');
    if (!accId || !symbolsRaw) {
        if (statusEl) statusEl.textContent = '请先选择账户并填写标的';
        return;
    }
    const first = symbolsRaw.replace('，', ',').replace('；', ',').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)[0];
    if (!first) {
        if (statusEl) statusEl.textContent = '请填写标的';
        return;
    }
    try {
        const sel = document.getElementById('futuAccount');
        const isHk = first.startsWith('HK.') || (first.replace(/\D/g, '').length === 5);
        const isUs = first.startsWith('US.') || (!first.includes('.') && !first.match(/^\d+$/));
        if (sel && sel.options && sel.options.length) {
            const curText = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
            if (isHk && curText.includes('· US ·')) {
                for (let i = 0; i < sel.options.length; i++) {
                    if ((sel.options[i].textContent || '').includes('· HK ·')) {
                        sel.selectedIndex = i;
                        accId = (sel.value || '').replace(/\D/g, '');
                        break;
                    }
                }
            }
            if (isUs && curText.includes('· HK ·')) {
                for (let i = 0; i < sel.options.length; i++) {
                    if ((sel.options[i].textContent || '').includes('· US ·')) {
                        sel.selectedIndex = i;
                        accId = (sel.value || '').replace(/\D/g, '');
                        break;
                    }
                }
            }
        }
    } catch {}
    if (statusEl) statusEl.textContent = '测试下单中（SIM）...';
    try {
        const resp = await apiFetch('/api/futu/demo/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acc_id: accId, symbol: first, quantity: qty })
        });
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'demo buy failed');
        if (statusEl) statusEl.textContent = `已提交模拟买单：${data.data.symbol} order=${data.data.order_id}`;
        await futuRefreshLogs();
    } catch (e) {
        if (statusEl) statusEl.textContent = `测试下单失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuRefreshStrategies() {
    const sel = document.getElementById('futuStrategySelect');
    const idInput = document.getElementById('futuStrategyId');
    if (!sel || !idInput) return;
    sel.innerHTML = '<option value="">加载策略中...</option>';
    try {
        const resp = await apiFetch('/api/strategy-library?page=1&pageSize=100&builtin=1');
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || '策略加载失败');
        const items = data.items || [];
        if (!items.length) {
            sel.innerHTML = '<option value="">无策略</option>';
            return;
        }
        sel.innerHTML = items.map(s => `<option value="${escapeHtml(String(s.id))}">#${escapeHtml(String(s.id))} · ${escapeHtml(s.name || '')}${s.is_builtin ? '（内置）' : ''}</option>`).join('');
        if (!idInput.value) {
            idInput.value = String(items[0].id);
        }
        sel.value = idInput.value ? String(idInput.value) : String(items[0].id);
        sel.onchange = () => {
            idInput.value = sel.value;
        };
    } catch (e) {
        sel.innerHTML = `<option value="">加载失败</option>`;
        const statusEl = document.getElementById('futuStatus');
        if (statusEl) statusEl.textContent = `策略加载失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

async function futuRefreshLogs() {
    const el = document.getElementById('futuLogs');
    if (!el) return;
    try {
        const resp = await apiFetch('/api/futu/logs?limit=80');
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || 'logs failed');
        const items = data.data || [];
        if (!items.length) {
            el.innerHTML = '<div style="color:#8892b0;">暂无日志</div>';
            return;
        }
        el.innerHTML = items.map(x => {
            const t = (x.created_at || '').replace('T', ' ').slice(0, 19);
            const dp = (x.desired_position != null) ? Number(x.desired_position) : null;
            const cp = (x.current_position != null) ? Number(x.current_position) : null;
            const posText = (dp != null && cp != null) ? ` · desired=${dp} · current=${cp}` : '';
            const oid = x.order_id ? ` · order=${escapeHtml(String(x.order_id))}` : '';
            return `<div style="margin-bottom:6px;"><span class="ta-num">${escapeHtml(t)}</span> · ${escapeHtml(x.env)} · ${escapeHtml(x.symbol)} · ${escapeHtml(x.action)} · ${escapeHtml(x.status)}${posText}${oid}${x.message ? ' · ' + escapeHtml(x.message) : ''}</div>`;
        }).join('');
    } catch (e) {
        el.innerHTML = `<div style="color:#ff4757;">${escapeHtml(e && e.message ? e.message : '加载失败')}</div>`;
    }
}

function setInitialCapital() {
    const capital = parseFloat(document.getElementById('initialCapital').value);
    if (!capital || capital <= 0) {
        alert('请输入有效的初始资金');
        return;
    }

    apiFetch('/api/paper/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_cash: capital })
    }).then(r => r.json()).then(res => {
        if (!res.success) throw new Error(res.error || '设置失败');
        localStorage.setItem('simCapitalSet', 'true');
        const capitalSetup = document.getElementById('capitalSetup');
        if (capitalSetup) {
            capitalSetup.classList.add('hidden');
        }
        refreshPaperTradingUI();
        alert('初始资金设置成功！');
    }).catch(e => {
        alert(e && e.message ? e.message : '设置失败');
    });
}

function checkCapitalSet() {
    const capitalSet = localStorage.getItem('simCapitalSet');
    const capitalSetup = document.getElementById('capitalSetup');
    if (capitalSet === 'true' && capitalSetup) {
        capitalSetup.classList.add('hidden');
    }
}

function updateCapitalDisplay() {
    return;
}

function openTradeModal(code, name, price) {
    currentTradeStock = { code, name, price };
    currentTradeType = 'buy';
    
    document.getElementById('tradeModalTitle').textContent = `交易 - ${name}`;
    document.getElementById('tradeStockName').textContent = name;
    document.getElementById('tradeStockCode').textContent = code;
    document.getElementById('tradeCurrentPrice').textContent = `$${Number(price || 0).toFixed(2)}`;
    document.getElementById('tradePrice').value = price.toFixed(2);
    document.getElementById('tradeQuantity').value = '';
    document.getElementById('tradeEstimatedAmount').textContent = '$0.00';
    
    const tradeTabs = document.querySelectorAll('.trade-tab');
    tradeTabs.forEach(t => t.classList.remove('active'));
    tradeTabs[0].classList.add('active');
    
    document.getElementById('tradeModal').classList.remove('hidden');
}

function closeTradeModal() {
    document.getElementById('tradeModal').classList.add('hidden');
}

function switchTradeType(type) {
    currentTradeType = type;
    const tradeTabs = document.querySelectorAll('.trade-tab');
    tradeTabs.forEach(t => t.classList.remove('active'));
    
    if (type === 'buy') {
        tradeTabs[0].classList.add('active');
    } else {
        tradeTabs[1].classList.add('active');
    }
    
    updateTradeEstimate();
}

function updateTradeEstimate() {
    const price = parseFloat(document.getElementById('tradePrice').value) || 0;
    const quantity = parseInt(document.getElementById('tradeQuantity').value) || 0;
    const amount = price * quantity;
    
    document.getElementById('tradeEstimatedAmount').textContent = 
        `$${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

document.addEventListener('input', function(e) {
    if (e.target.id === 'tradePrice' || e.target.id === 'tradeQuantity') {
        updateTradeEstimate();
    }
});

function executeTrade() {
    const price = parseFloat(document.getElementById('tradePrice').value);
    const quantity = parseInt(document.getElementById('tradeQuantity').value);
    
    if (!price || !quantity || quantity <= 0) {
        alert('请输入有效的价格和数量');
        return;
    }
    apiFetch('/api/paper/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            symbol: currentTradeStock.code,
            side: currentTradeType,
            price,
            quantity
        })
    }).then(r => r.json().then(j => ({ ok: r.ok, j }))).then(({ ok, j }) => {
        if (!ok || !j.success) throw new Error(j.error || '下单失败');
        closeTradeModal();
        refreshPaperTradingUI();
        alert('订单已提交，等待价格触发成交。');
    }).catch(e => {
        alert(e && e.message ? e.message : '下单失败');
    });
}

function renderSimHoldings() {
    const container = document.getElementById('holdingsList');
    if (!container) return;
    container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">加载中...</p>';
}

function renderSimTradeHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;
    container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">加载中...</p>';
}

let __paper_poll_timer = null;

function startPaperPolling() {
    if (__paper_poll_timer) return;
    __paper_poll_timer = setInterval(() => {
        paperPoll();
    }, 8000);
}

function stopPaperPolling() {
    if (__paper_poll_timer) {
        clearInterval(__paper_poll_timer);
        __paper_poll_timer = null;
    }
}

async function paperPoll() {
    try {
        const resp = await apiFetch('/api/paper/poll', { method: 'POST' });
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) return;
        refreshPaperTradingUIFromPoll(data.data);
    } catch {}
}

async function refreshPaperTradingUI() {
    await paperPoll();
    await Promise.all([
        loadPaperOrders(),
        loadPaperPositions(),
        loadPaperTrades()
    ]);
}

function refreshPaperTradingUIFromPoll(data) {
    const s = data && data.summary ? data.summary : null;
    if (!s) return;
    const availableEl = document.getElementById('availableCapital');
    const holdingValueEl = document.getElementById('holdingMarketValue');
    const totalEl = document.getElementById('totalAssets');
    const returnEl = document.getElementById('totalReturn');
    if (availableEl) availableEl.textContent = `$${Number(s.cash || 0).toFixed(2)}`;
    if (holdingValueEl) holdingValueEl.textContent = `$${Number(s.market_value || 0).toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${Number(s.equity || 0).toFixed(2)}`;
    if (returnEl) {
        const r = Number(s.total_return || 0) * 100;
        const cls = r >= 0 ? 'positive' : 'negative';
        returnEl.textContent = `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
        returnEl.className = `value ${cls}`;
    }
}

async function loadPaperOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;
    try {
        const resp = await apiFetch('/api/paper/orders');
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || '加载失败');
        const items = data.data || [];
        if (!items.length) {
            container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无挂单</p>';
            return;
        }
        container.innerHTML = items.map(o => {
            const st = o.status;
            const side = o.side === 'buy' ? '买入' : '卖出';
            const canCancel = st === 'pending';
            const filled = st === 'filled' ? ` 成交价 $${Number(o.filled_price || 0).toFixed(2)}` : '';
            return `
                <div class="history-item">
                    <div class="history-date">#${o.id}</div>
                    <div class="history-content">
                        <div class="history-type ${o.side}">${side}</div>
                        <div class="history-stock">${escapeHtml(o.symbol || '')}</div>
                        <div class="history-quantity">${Number(o.quantity || 0)}股</div>
                        <div class="history-price">$${Number(o.limit_price || 0).toFixed(2)}</div>
                        <div class="history-price">${escapeHtml(st)}${filled}</div>
                        ${canCancel ? `<button class="btn-secondary btn-small" onclick="cancelPaperOrder(${o.id})">撤单</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<p style="color:#ff4757;text-align:center;padding:30px;">${escapeHtml(e.message || '加载失败')}</p>`;
    }
}

async function cancelPaperOrder(id) {
    try {
        const resp = await apiFetch(`/api/paper/orders/${id}/cancel`, { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || '撤单失败');
        refreshPaperTradingUI();
    } catch (e) {
        alert(e && e.message ? e.message : '撤单失败');
    }
}

async function loadPaperPositions() {
    const container = document.getElementById('holdingsList');
    if (!container) return;
    try {
        const resp = await apiFetch('/api/paper/positions');
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || '加载失败');
        const items = data.data || [];
        if (!items.length) {
            container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无持仓</p>';
            return;
        }
        container.innerHTML = items.map(p => {
            const pnl = Number(p.unrealized_pnl || 0);
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            const avg = Number(p.avg_cost || 0);
            const last = Number(p.last_price || 0);
            const qty = Number(p.quantity || 0);
            const pct = avg ? ((last - avg) / avg * 100) : 0;
            return `
                <div class="holding-item">
                    <div class="holding-header">
                        <div class="holding-info">
                            <span class="holding-name">${escapeHtml(p.symbol || '')}</span>
                            <span class="holding-code">${escapeHtml(p.symbol || '')}</span>
                        </div>
                        <div class="holding-pnl ${pnlClass}">
                            ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}
                        </div>
                    </div>
                    <div class="holding-details">
                        <div class="holding-detail-item"><span class="label">数量</span><span class="value">${qty}股</span></div>
                        <div class="holding-detail-item"><span class="label">成本价</span><span class="value">$${avg.toFixed(2)}</span></div>
                        <div class="holding-detail-item"><span class="label">现价</span><span class="value">$${last.toFixed(2)}</span></div>
                        <div class="holding-detail-item"><span class="label">收益率</span><span class="value ${pnlClass}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span></div>
                    </div>
                    <button class="btn-secondary btn-small" onclick="openTradeModal('${escapeHtml(p.symbol || '')}', '${escapeHtml(p.symbol || '')}', ${last})">交易</button>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<p style="color:#ff4757;text-align:center;padding:30px;">${escapeHtml(e.message || '加载失败')}</p>`;
    }
}

async function loadPaperTrades() {
    const container = document.getElementById('historyList');
    if (!container) return;
    try {
        const resp = await apiFetch('/api/paper/trades?limit=50');
        const data = await readJsonOrThrow(resp);
        if (!resp.ok || !data.success) throw new Error(data.error || '加载失败');
        const items = data.data || [];
        if (!items.length) {
            container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无交易记录</p>';
            return;
        }
        container.innerHTML = items.map(t => {
            const side = t.side === 'buy' ? '买入' : '卖出';
            const pnl = Number(t.pnl || 0);
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            return `
                <div class="history-item">
                    <div class="history-date">${escapeHtml((t.created_at || '').slice(0, 10))}</div>
                    <div class="history-content">
                        <div class="history-type ${t.side}">${side}</div>
                        <div class="history-stock">${escapeHtml(t.symbol || '')}</div>
                        <div class="history-quantity">${Number(t.quantity || 0)}股</div>
                        <div class="history-price">$${Number(t.price || 0).toFixed(2)}</div>
                        <div class="history-price ${pnlClass}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<p style="color:#ff4757;text-align:center;padding:30px;">${escapeHtml(e.message || '加载失败')}</p>`;
    }
}

function setUsername() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert('请输入用户名');
        return;
    }
    
    currentUsername = username;
    localStorage.setItem('simUsername', username);
    const displayUsername = document.getElementById('displayUsername');
    if (displayUsername) displayUsername.textContent = username;
    alert(`用户名设置成功：${username}`);
}

function createPK() {
    const name = document.getElementById('pkName').value.trim();
    const capital = parseFloat(document.getElementById('pkInitialCapital').value);
    const duration = parseInt(document.getElementById('pkDuration').value);
    
    if (!name) {
        alert('请输入比赛名称');
        return;
    }
    
    if (!capital || capital <= 0) {
        alert('请输入有效的初始资金');
        return;
    }
    
    if (!duration || duration <= 0) {
        alert('请输入有效的比赛时长');
        return;
    }
    
    const pk = {
        id: 'pk' + Date.now(),
        name: name,
        initialCapital: capital,
        duration: duration,
        startDate: new Date().toISOString().split('T')[0],
        players: [
            {
                username: currentUsername || '我',
                capital: capital,
                returnRate: 0,
                rank: 1
            }
        ],
        inviteCode: 'PK' + Math.random().toString(36).substring(2, 8).toUpperCase()
    };
    
    pkList.unshift(pk);
    localStorage.setItem('simPKList', JSON.stringify(pkList));
    renderPKList();
    
    alert('PK比赛创建成功！');
}

function renderPKList() {
    const container = document.getElementById('pkList');
    if (!container) return;
    
    const saved = localStorage.getItem('simPKList');
    if (saved) {
        pkList = JSON.parse(saved);
    }
    
    if (pkList.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 30px;">还没有PK比赛</p>';
        return;
    }
    
    let html = '';
    pkList.forEach(pk => {
        const today = new Date();
        const startDate = new Date(pk.startDate);
        const daysPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.max(0, pk.duration - daysPassed);
        
        html += `
            <div class="pk-item">
                <div class="pk-header">
                    <div class="pk-name">${pk.name}</div>
                    <div class="pk-status">进行中</div>
                </div>
                <div class="pk-info">
                    <div class="pk-info-item">
                        <span class="label">初始资金</span>
                        <span class="value">¥${pk.initialCapital.toLocaleString('zh-CN')}</span>
                    </div>
                    <div class="pk-info-item">
                        <span class="label">剩余天数</span>
                        <span class="value">${remainingDays}天</span>
                    </div>
                    <div class="pk-info-item">
                        <span class="label">参赛人数</span>
                        <span class="value">${pk.players.length}人</span>
                    </div>
                </div>
                <div class="pk-actions">
                    <button class="btn-secondary btn-small" onclick="inviteToPK('${pk.id}')">邀请好友</button>
                    <button class="btn-primary btn-small" onclick="viewPKLeaderboard('${pk.id}')">查看排行榜</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function inviteToPK(pkId) {
    const pk = pkList.find(p => p.id === pkId);
    if (!pk) return;
    
    document.getElementById('inviteCode').textContent = pk.inviteCode;
    document.getElementById('inviteLink').textContent = 
        `http://localhost:3000?invite=${pk.inviteCode}`;
    
    document.getElementById('inviteModal').classList.remove('hidden');
}

function closeInviteModal() {
    document.getElementById('inviteModal').classList.add('hidden');
}

function copyInviteCode() {
    const code = document.getElementById('inviteCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('邀请码已复制！');
    }).catch(() => {
        alert('复制失败，请手动复制');
    });
}

function viewPKLeaderboard(pkId) {
    const section = document.getElementById('leaderboardSection');
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth' });
}

function initNewsUIOnce() {
    const input = document.getElementById('newsKeyword');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchNews();
        }
    });
}

function switchNewsMarket(market) {
    currentNewsMarket = market;
    currentNewsPage = 1;
    const tabs = document.querySelectorAll('.news-market-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.market === market));
    loadNewsPage(1);
}

function refreshNews() {
    loadNewsPage(currentNewsPage);
}

function searchNews() {
    const input = document.getElementById('newsKeyword');
    currentNewsKeyword = (input && input.value ? input.value : '').trim();
    loadNewsPage(1);
}

function _newsEndpointForMarket(market) {
    if (market === 'us') return '/api/news/us';
    return '/api/news';
}

async function loadNewsPage(page) {
    const newsList = document.getElementById('newsList');
    const endpoint = _newsEndpointForMarket(currentNewsMarket);
    const q = encodeURIComponent(currentNewsKeyword || '');
    const url = `${endpoint}?market=${encodeURIComponent(currentNewsMarket)}&q=${q}&page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(newsPageSize)}`;

    currentNewsPage = page;

    try {
        newsList.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>正在加载新闻...</p>
            </div>
        `;

        const response = await apiFetch(url);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '加载新闻失败');
        }

        const items = Array.isArray(data.data) ? data.data : [];
        const total = Number.isFinite(data.total) ? data.total : items.length;
        renderMarketNews(items);
        renderNewsPagination(total, page);
    } catch (error) {
        console.error('加载新闻失败:', error);
        newsList.innerHTML = '<p style="color: #ff4757; text-align: center; padding: 30px;">加载新闻失败</p>';
        renderNewsPagination(0, page);
    }
}

function renderMarketNews(items) {
    const newsList = document.getElementById('newsList');
    if (!newsList) return;

    const categoryMap = {
        market: '市场',
        policy: '政策',
        commodity: '商品',
        industry: '行业',
        global: '国际',
        forex: '外汇',
        news: '新闻'
    };

    let html = '';
    items.forEach((news) => {
        const title = news.title || '';
        const url = news.url || '';
        const time = news.time || '';
        const source = news.source || '未知';
        const categoryText = categoryMap[news.category] || news.category || '新闻';
        const detail = news.detail || news.summary || news.text || '';
        const impact = news.impact || '';

        html += `
            <div class="news-item ${impact}">
                <div class="news-header">
                    ${url ? `<a class="news-title news-item-link" href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>` : `<div class="news-title">${title}</div>`}
                </div>
                <div class="news-meta">
                    <span class="news-category">${categoryText}</span>
                    <span>${time}</span>
                    <span class="news-source">来源：${source}</span>
                </div>
                ${detail ? `<div class="news-detail expanded">${detail}</div>` : ''}
            </div>
        `;
    });

    newsList.innerHTML = html || '<p style="color: #8892b0; text-align: center; padding: 30px;">暂无新闻</p>';
}

function renderNewsPagination(total, page) {
    const top = document.getElementById('newsPaginationTop');
    const bottom = document.getElementById('newsPaginationBottom');
    const pageCount = total > 0 ? Math.ceil(total / newsPageSize) : 1;
    const cur = Math.min(Math.max(page, 1), pageCount);

    const html = `
        <span class="news-page-info">共 ${total} 条，第 ${cur}/${pageCount} 页</span>
        <button class="news-page-btn" onclick="loadNewsPage(1)" ${cur <= 1 ? 'disabled' : ''}>首页</button>
        <button class="news-page-btn" onclick="loadNewsPage(${cur - 1})" ${cur <= 1 ? 'disabled' : ''}>上一页</button>
        <button class="news-page-btn" onclick="loadNewsPage(${cur + 1})" ${cur >= pageCount ? 'disabled' : ''}>下一页</button>
        <button class="news-page-btn" onclick="loadNewsPage(${pageCount})" ${cur >= pageCount ? 'disabled' : ''}>末页</button>
    `;

    if (top) top.innerHTML = html;
    if (bottom) bottom.innerHTML = html;
}

async function getAIAnalysis() {
    const stockCode = document.getElementById('aiStockCode').value.trim();
    
    if (!stockCode || !/^\d{6}$/.test(stockCode)) {
        alert('请输入有效的A股6位代码');
        return;
    }
    
    const aiAnalysis = document.getElementById('aiAnalysis');
    
    try {
        aiAnalysis.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>AI正在分析中...</p>
            </div>
        `;
        aiAnalysis.classList.remove('hidden');
        
        const holdingsForStock = holdings.filter(h => h.code === stockCode);
        
        const response = await apiFetch('/api/ai/analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: stockCode,
                holdings: holdingsForStock
            })
        });
        const data = await response.json();
        
        if (data.success) {
            const stock = data.stock;
            const analysis = data.analysis;
            const enhanced = data.enhanced;
            
            const confidenceClass = analysis.confidence >= 70 ? 'high' : 
                                   analysis.confidence >= 50 ? 'medium' : 'low';
            const riskClass = analysis.risk_level === '低风险' ? 'low' :
                             analysis.risk_level === '中等风险' ? 'medium' : 'high';
            
            let html = `
                <div class="ai-stock-summary">
                    <h3>📊 ${stock.name} (${stock.code}) 股票数据</h3>
                    <div class="stock-metrics">
                        <div class="metric-item">
                            <div class="metric-label">当前价格</div>
                            <div class="metric-value">¥${stock.price}</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">涨跌幅</div>
                            <div class="metric-value">${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">市盈率(动)</div>
                            <div class="metric-value">${stock.pe ? stock.pe.toFixed(2) : '--'}</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">市净率</div>
                            <div class="metric-value">${stock.pb ? stock.pb.toFixed(2) : '--'}</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">成交量</div>
                            <div class="metric-value">${(stock.volume / 1000000).toFixed(2)}M</div>
                        </div>
                    </div>
                </div>
            `;
            
            if (holdingsForStock.length > 0) {
                html += `
                    <div class="ai-analysis-card" style="border-left: 4px solid #ffd93d;">
                        <h4>💼 您的持仓情况</h4>
                `;
                holdingsForStock.forEach(position => {
                    const marketValue = position.quantity * stock.price;
                    const cost = position.quantity * position.buyPrice;
                    const pnl = marketValue - cost;
                    const pnlPercent = ((pnl / cost) * 100).toFixed(2);
                    const pnlClass = pnl >= 0 ? 'bullish' : 'bearish';
                    const pnlSign = pnl >= 0 ? '+' : '';
                    
                    html += `
                        <div style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span><strong>买入日期:</strong> ${position.buyDate}</span>
                                <span><strong>数量:</strong> ${position.quantity}股</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span><strong>成本价:</strong> ¥${position.buyPrice}</span>
                                <span><strong>现价:</strong> ¥${stock.price}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span><strong>市值:</strong> ¥${marketValue.toFixed(2)}</span>
                                <span class="${pnlClass}"><strong>盈亏:</strong> ${pnlSign}¥${pnl.toFixed(2)} (${pnlSign}${pnlPercent}%)</span>
                            </div>
                            ${position.note ? `<div style="margin-top: 8px; color: #8892b0; font-size: 0.9rem;"><strong>备注:</strong> ${position.note}</div>` : ''}
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            html += `
                <div class="ai-analysis-card">
                    <h4>📈 整体分析</h4>
                    <p>${analysis.overall}</p>
                    ${analysis.overall_reason ? `<p style="margin-top: 8px; color: #8892b0; font-size: 0.9rem;">💡 ${analysis.overall_reason}</p>` : ''}
                </div>
                
                <div class="ai-analysis-card">
                    <h4>📊 技术面分析</h4>
                    <p>${analysis.technical}</p>
                    ${analysis.technical_reason ? `<p style="margin-top: 8px; color: #8892b0; font-size: 0.9rem;">💡 ${analysis.technical_reason}</p>` : ''}
                </div>
                
                <div class="ai-analysis-card">
                    <h4>💼 基本面分析</h4>
                    <p>${analysis.fundamental}</p>
                    ${analysis.fundamental_reason ? `<p style="margin-top: 8px; color: #8892b0; font-size: 0.9rem;">💡 ${analysis.fundamental_reason}</p>` : ''}
                </div>
                
                <div class="ai-analysis-card">
                    <h4>📰 市场消息面</h4>
                    <p>${analysis.news_impact}</p>
                </div>
                
                <div class="ai-analysis-card">
                    <h4>🎯 AI分析置信度</h4>
                    <div class="confidence-bar">
                        <div class="confidence-label">
                            <span>置信度</span>
                            <span>${analysis.confidence}%</span>
                        </div>
                        <div class="confidence-track">
                            <div class="confidence-fill ${confidenceClass}" style="width: ${analysis.confidence}%"></div>
                        </div>
                    </div>
                </div>
                
                <div class="recommendation-final">
                    <h3>🎯 AI决策建议</h3>
                    <p class="recommendation-text">${analysis.recommendation}</p>
                    ${analysis.recommendation_reason ? `<p style="margin-top: 10px; color: #8892b0; font-size: 0.95rem;">💡 ${analysis.recommendation_reason}</p>` : ''}
                    <span class="risk-badge ${riskClass}">${analysis.risk_level}</span>
                </div>
            `;
            
            aiAnalysis.innerHTML = html;
        } else {
            aiAnalysis.innerHTML = '<p style="color: #ff4757; text-align: center; padding: 30px;">获取AI分析失败</p>';
        }
    } catch (error) {
        console.error('AI分析失败:', error);
        aiAnalysis.innerHTML = '<p style="color: #ff4757; text-align: center; padding: 30px;">AI分析失败</p>';
    }
}

// AI助手功能
function toggleAIChat() {
    const chatWindow = document.getElementById('aiChatWindow');
    chatWindow.classList.toggle('hidden');
}

function handleAIInputKeypress(event) {
    if (event.key === 'Enter') {
        sendAIMessage();
    }
}

async function sendAIChatMessage(message) {
    const provider = (appSettings.ai && appSettings.ai.provider) || 'backend';
    if (provider === 'openai-chat') {
        return await callOpenAiChat(message);
    }
    
    const response = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message
        })
    });
    
    const result = await response.json();
    if (result && result.success && result.reply) return result.reply;
    throw new Error((result && result.error) || 'AI聊天失败');
}

async function callOpenAiChat(message) {
    const apiKey = (appSettings.ai && appSettings.ai.apiKey) ? appSettings.ai.apiKey.trim() : '';
    const baseUrl = normalizeBaseUrl(appSettings.ai && appSettings.ai.baseUrl);
    const model = (appSettings.ai && appSettings.ai.model) ? appSettings.ai.model.trim() : '';
    const maxTokens = Number(appSettings.ai && appSettings.ai.maxTokens) || 1024;
    
    if (!apiKey) throw new Error('AI API Key 未配置');
    if (!baseUrl) throw new Error('AI Base URL 未配置');
    if (!model) throw new Error('AI 模型名称未配置');
    
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : joinUrl(baseUrl, 'chat/completions');
    
    const systemPrompt = '你是股票智能助手。回答要简洁、可执行，必要时分点说明。';
    
    if (!Array.isArray(aiChatHistory)) aiChatHistory = [];
    const history = aiChatHistory.slice(-12);
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message }
    ];
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens
        })
    });
    
    if (!response.ok) {
        let errText = `请求失败(${response.status})`;
        try {
            const errData = await response.json();
            const msg = errData && (errData.error?.message || errData.message);
            if (msg) errText = msg;
        } catch (e) {}
        throw new Error(errText);
    }
    
    const data = await response.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('AI返回内容为空');
    
    aiChatHistory = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: reply }
    ].slice(-12);
    
    return reply;
}

async function sendAIMessage() {
    const input = document.getElementById('aiChatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    const messagesContainer = document.getElementById('aiChatMessages');
    
    // 添加用户消息
    addUserMessage(message);
    input.value = '';
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const reply = await sendAIChatMessage(message);
        addAIMessage(reply || '抱歉，我暂时无法回答你的问题，请稍后再试。');
    } catch (error) {
        console.error('AI聊天失败:', error);
        addAIMessage('抱歉，网络错误，请稍后再试。');
    }
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addUserMessage(message) {
    const messagesContainer = document.getElementById('aiChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-message';
    messageDiv.innerHTML = `
        <div class="user-message-avatar">👤</div>
        <div class="user-message-content">${escapeHtml(message)}</div>
    `;
    messagesContainer.appendChild(messageDiv);
}

function addAIMessage(message) {
    const messagesContainer = document.getElementById('aiChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-message';
    messageDiv.innerHTML = `
        <div class="ai-message-avatar">🤖</div>
        <div class="ai-message-content">${formatAIMessage(message)}</div>
    `;
    messagesContainer.appendChild(messageDiv);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatAIMessage(message) {
    return message
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function formatMarkdownSafe(message) {
    const escaped = escapeHtml(message || '');
    return escaped
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

let __ta_last_md = '';
let __ta_last_symbol = '';
let __ta_last_date = '';

function downloadTradingAgentsReport() {
    const md = (__ta_last_md || '').trim();
    if (!md) return;
    const symbol = (__ta_last_symbol || 'report').replace(/[^A-Za-z0-9._-]/g, '_');
    const date = (__ta_last_date || '').replace(/[^0-9-]/g, '');
    const fileName = `TA_${symbol}${date ? '_' + date : ''}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function translateTradingPlanToChinese(md, language) {
    if ((language || '').toLowerCase() !== 'chinese') return md;
    let s = md || '';
    s = s.replace(/###\s*Trading Plan\b/gi, '### 交易计划');
    s = s.replace(/##\s*Trading Plan\b/gi, '## 交易计划');
    s = s.replace(/#\s*Trading Plan\b/gi, '# 交易计划');

    const heading = /^(#{2,3})\s*(交易计划|Trading Plan)\s*$/gmi;
    const match = heading.exec(s);
    if (!match) return s;

    const startIdx = match.index + match[0].length;
    const rest = s.slice(startIdx);
    const nextHeading = rest.search(/^\s*#{2,3}\s+/m);
    const blockEnd = nextHeading >= 0 ? startIdx + nextHeading : s.length;
    const before = s.slice(0, startIdx);
    let block = s.slice(startIdx, blockEnd);
    const after = s.slice(blockEnd);

    const pairs = [
        ['Entry', '入场'],
        ['Entry Price', '入场价'],
        ['Take Profit', '止盈'],
        ['Stop Loss', '止损'],
        ['Position Size', '仓位'],
        ['Time Horizon', '持有周期'],
        ['Risk Management', '风险管理'],
        ['Catalyst', '催化剂'],
        ['Invalidation', '失效条件'],
        ['Target', '目标'],
        ['Scenario', '情景'],
        ['Bullish', '看多'],
        ['Bearish', '看空'],
        ['Neutral', '中性'],
        ['Buy', '买入'],
        ['Sell', '卖出'],
        ['Hold', '持有'],
        ['Watch', '观望'],
    ];
    for (const [en, zh] of pairs) {
        const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g');
        block = block.replace(re, zh);
    }

    return `${before}${block}${after}`;
}

function renderTradingAgentsReport(raw) {
    const text = (raw || '').trim();
    if (!text) return '<div style="color:#8892b0;">暂无报告内容</div>';

    const lines = text.split(/\r?\n/);
    const sections = [];
    let current = { title: '报告', level: 2, body: [] };

    const pushCurrent = () => {
        const bodyText = (current.body || []).join('\n').trim();
        if (!bodyText) return;
        sections.push({ title: current.title || '报告', level: current.level || 2, body: bodyText });
    };

    for (const line of lines) {
        const m = line.match(/^(#{1,3})\s+(.*)$/);
        if (m) {
            pushCurrent();
            current = { title: (m[2] || '').trim(), level: m[1].length, body: [] };
        } else {
            current.body.push(line);
        }
    }
    pushCurrent();

    const htmlParts = [];
    for (const sec of sections) {
        const title = escapeHtml((sec.title || '').trim() || '报告');
        const bodyHtml = formatTradingAgentsBody(sec.body || '');
        if (!bodyHtml) continue;
        htmlParts.push(`
            <section class="ta-section">
                <div class="ta-section-title">${title}</div>
                <div class="ta-section-body">${bodyHtml}</div>
            </section>
        `);
    }
    return htmlParts.join('') || '<div class="ta-empty">暂无报告内容</div>';
}

function formatTradingAgentsBody(text) {
    let s = escapeHtml((text || '').trim());
    if (!s) return '';

    s = s.replace(/^\s*-\s+/gm, '• ');
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');

    const badge = (word, cls) => `<span class="ta-badge ${cls}">${word}</span>`;
    s = s
        .replace(/买入/g, badge('买入', 'ta-badge-buy'))
        .replace(/加仓/g, badge('加仓', 'ta-badge-buy'))
        .replace(/卖出/g, badge('卖出', 'ta-badge-sell'))
        .replace(/减仓/g, badge('减仓', 'ta-badge-sell'))
        .replace(/止损/g, badge('止损', 'ta-badge-risk'))
        .replace(/止盈/g, badge('止盈', 'ta-badge-risk'))
        .replace(/持有/g, badge('持有', 'ta-badge-hold'))
        .replace(/观望/g, badge('观望', 'ta-badge-watch'));

    const metricWords = [
        'PE', 'P/E', '市盈率', 'ROE', 'PB', '市净率', 'EPS', 'EV/EBITDA', '毛利率', '净利率',
        '目标价', '支撑位', '压力位', '成交量', '换手率', 'Beta', '股息率'
    ];
    for (const w of metricWords) {
        const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        s = s.replace(re, `<span class="ta-metric">${w}</span>`);
    }

    s = s.replace(/\b(\d+(\.\d+)?%?)\b/g, '<span class="ta-num">$1</span>');
    s = s.replace(/\n/g, '<br>');
    return s;
}

// 交易日记标签页切换
function switchDiaryTab(tab) {
    const tabs = document.querySelectorAll('.diary-tab');
    const diaryContent = document.getElementById('diaryTabContent');
    const strategyContent = document.getElementById('strategyTabContent');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'diary') {
        tabs[0].classList.add('active');
        diaryContent.classList.remove('hidden');
        strategyContent.classList.add('hidden');
    } else {
        tabs[1].classList.add('active');
        diaryContent.classList.add('hidden');
        strategyContent.classList.remove('hidden');
        loadStrategies();
    }
}

// 策略标签选择
let selectedStrategyTags = [];

document.addEventListener('DOMContentLoaded', function() {
    const strategyTags = document.querySelectorAll('.strategy-tag');
    strategyTags.forEach(tag => {
        tag.addEventListener('click', function() {
            this.classList.toggle('selected');
            const tagText = this.dataset.tag;
            if (this.classList.contains('selected')) {
                selectedStrategyTags.push(tagText);
            } else {
                selectedStrategyTags = selectedStrategyTags.filter(t => t !== tagText);
            }
        });
    });
    
    const moodTags = document.querySelectorAll('.mood-tag');
    moodTags.forEach(tag => {
        tag.addEventListener('click', function() {
            moodTags.forEach(t => t.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
});

// 保存投资策略
async function saveStrategy() {
    const title = document.getElementById('strategyTitle').value.trim();
    const content = document.getElementById('strategyContent').value.trim();
    
    if (!title || !content) {
        alert('请填写策略标题和内容');
        return;
    }
    
    try {
        const response = await fetch('/api/strategy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: content,
                tags: selectedStrategyTags
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('策略保存成功！');
            document.getElementById('strategyTitle').value = '';
            document.getElementById('strategyContent').value = '';
            selectedStrategyTags = [];
            document.querySelectorAll('.strategy-tag').forEach(t => t.classList.remove('selected'));
            loadStrategies();
        } else {
            alert('保存失败：' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('保存策略失败:', error);
        alert('保存失败，请稍后再试');
    }
}

// 加载投资策略列表
async function loadStrategies() {
    try {
        const response = await fetch('/api/strategy');
        const result = await response.json();
        
        if (result.success) {
            renderStrategies(result.data);
        }
    } catch (error) {
        console.error('加载策略失败:', error);
    }
}

// 渲染策略列表
function renderStrategies(strategies) {
    const container = document.getElementById('strategyList');
    
    if (!strategies || strategies.length === 0) {
        container.innerHTML = '<p style="color: #8892b0; text-align: center; padding: 40px;">暂无策略，快去添加你的第一个投资策略吧！</p>';
        return;
    }
    
    container.innerHTML = strategies.map(strategy => `
        <div class="strategy-card">
            <div class="strategy-card-header">
                <div class="strategy-card-title">${escapeHtml(strategy.title)}</div>
                <button class="strategy-card-delete" onclick="deleteStrategy(${strategy.id})">删除</button>
            </div>
            ${strategy.tags && strategy.tags.length > 0 ? `
                <div class="strategy-card-tags">
                    ${strategy.tags.map(tag => `<span class="strategy-card-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="strategy-card-content">${escapeHtml(strategy.content).replace(/\n/g, '<br>')}</div>
            <div class="strategy-card-date">创建于: ${new Date(strategy.created_at).toLocaleString('zh-CN')}</div>
        </div>
    `).join('');
}

// 删除策略
async function deleteStrategy(strategyId) {
    if (!confirm('确定要删除这个策略吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/strategy/${strategyId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadStrategies();
        } else {
            alert('删除失败：' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('删除策略失败:', error);
        alert('删除失败，请稍后再试');
    }
}

// 清空所有记忆
async function clearAllMemory() {
    if (!confirm('确定要清空所有聊天记录和投资策略吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        const response = await fetch('/api/memory/clear', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('记忆已清空！');
            aiChatHistory = [];
            loadStrategies();
        } else {
            alert('清空失败：' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('清空记忆失败:', error);
        alert('清空失败，请稍后再试');
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    const diaryDate = document.getElementById('diaryDate');
    if (diaryDate) {
        diaryDate.value = today;
    }
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const nextCollapsed = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', nextCollapsed);
    persistAppSettings({
        ...appSettings,
        sidebar: {
            ...appSettings.sidebar,
            collapsed: nextCollapsed
        }
    });
}

function toggleSidebarGroup(groupKey) {
    const submenu = document.querySelector(`[data-submenu="${groupKey}"]`);
    const caret = document.querySelector(`[data-caret="${groupKey}"]`);
    if (!submenu) return;
    const nextCollapsed = !submenu.classList.contains('collapsed');
    submenu.classList.toggle('collapsed', nextCollapsed);
    if (caret) caret.textContent = nextCollapsed ? '▸' : '▾';
    persistAppSettings({
        ...appSettings,
        sidebar: {
            ...appSettings.sidebar,
            groups: {
                ...appSettings.sidebar.groups,
                [groupKey]: nextCollapsed
            }
        }
    });
}

function hideAllAppViews() {
    const ids = [
        'overviewSection',
        'watchlistSection',
        'backtestSection',
        'backtestDetailSection',
        'strategyLibrarySection',
        'settingsSection',
        'aiReportSection',
        'analysisSection',
        'newsSection',
        'stockPickerSection',
        'diarySection',
        'myPortfolioSection',
        'portfolioSection'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function setActiveSidebarItem(view) {
    const items = document.querySelectorAll('.sidebar-item[data-view]');
    items.forEach(item => item.classList.remove('active'));
    const active = document.querySelector(`.sidebar-item[data-view="${view}"]`);
    if (active) active.classList.add('active');
}

function expandGroupForView(view) {
    const map = {
        analysis: 'stockAnalysis',
        news: 'stockAnalysis',
        watchlist: 'stockAnalysis',
        backtest: 'trading',
        backtestDetail: 'trading',
        strategyLibrary: 'trading',
        portfolio: 'trading',
        myPortfolio: 'trading',
        diary: 'trading',
        aiReport: 'ai',
        stockPicker: 'ai'
    };
    const groupKey = map[view];
    if (!groupKey) return;
    const submenu = document.querySelector(`[data-submenu="${groupKey}"]`);
    const caret = document.querySelector(`[data-caret="${groupKey}"]`);
    if (!submenu) return;
    submenu.classList.remove('collapsed');
    if (caret) caret.textContent = '▾';
    if (appSettings.sidebar && appSettings.sidebar.groups && appSettings.sidebar.groups[groupKey]) {
        persistAppSettings({
            ...appSettings,
            sidebar: {
                ...appSettings.sidebar,
                groups: {
                    ...appSettings.sidebar.groups,
                    [groupKey]: false
                }
            }
        });
    }
}

function appNavigate(view) {
    hideAllAppViews();
    expandGroupForView(view);
    setActiveSidebarItem(view);
    persistAppSettings({ ...appSettings, lastView: view });

    const searchSection = document.querySelector('.search-section');
    if (searchSection) searchSection.classList.remove('hidden');
    
    if (view === 'overview') {
        const el = document.getElementById('overviewSection');
        if (el) el.classList.remove('hidden');
        return;
    }
    
    if (view === 'watchlist') {
        const el = document.getElementById('watchlistSection');
        if (el) el.classList.remove('hidden');
        if (searchSection) searchSection.classList.add('hidden');
        initWatchlistUIOnce();
        switchSavedWatchlistMarket(currentSavedWatchlistMarket);
        renderSavedWatchlist();
        return;
    }
    
    if (view === 'backtest') {
        navigateBacktestList();
        return;
    }

    if (view === 'strategyLibrary') {
        const el = document.getElementById('strategyLibrarySection');
        if (el) el.classList.remove('hidden');
        if (searchSection) searchSection.classList.add('hidden');
        initStrategyLibraryUIOnce();
        loadStrategyLibrary();
        return;
    }
    
    if (view === 'settings') {
        const el = document.getElementById('settingsSection');
        if (el) el.classList.remove('hidden');
        populateSettingsUI();
        return;
    }

    if (view === 'aiReport') {
        const el = document.getElementById('aiReportSection');
        if (el) el.classList.remove('hidden');
        if (searchSection) searchSection.classList.add('hidden');
        const dateInput = document.getElementById('taDate');
        if (dateInput && !dateInput.value) {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            dateInput.value = d.toISOString().split('T')[0];
        }
        const hint = document.getElementById('taHint');
        if (hint) {
            const hasKey = appSettings.tradingagents && (appSettings.tradingagents.openaiApiKey || '').trim();
            hint.textContent = hasKey ? '' : '提示：先到“设置 → TradingAgents”填写 OpenAI API Key，然后再生成报告。';
        }
        return;
    }
    
    if (view === 'finance') {
        switchTab('finance');
        return;
    }
    
    if (typeof switchTab === 'function') {
        switchTab(view);
    }
}

function initWatchlistUIOnce() {
    const input = document.getElementById('watchlistKeyword');
    if (input && input.dataset.bound !== '1') {
        input.dataset.bound = '1';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                watchlistSearch();
            }
        });
    }

    const results = document.getElementById('watchlistResultsList');
    if (results && results.dataset.bound !== '1') {
        results.dataset.bound = '1';
        results.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('.wl-add-btn') : null;
            if (!btn) return;
            const market = btn.dataset.market || 'cn';
            const code = btn.dataset.code || '';
            const name = btn.dataset.name || '';
            if (!code) return;
            handleWatchlistAdd(market, code, name);
        });
    }
}

function switchWatchlistMarket(market) {
    if (market === 'hk' || market === 'crypto') {
        const hint = document.getElementById('watchlistHint');
        if (hint) hint.textContent = '港股和加密货币暂不支持搜索与加入自选。';
        return;
    }
    currentWatchlistMarket = market;
    const tabs = document.querySelectorAll('.watchlist-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.market === market));
    const hint = document.getElementById('watchlistHint');
    if (hint) hint.textContent = market === 'cn' ? 'A股数据源：AkShare' : '美股数据源：OpenBB（搜索）';
}

function switchSavedWatchlistMarket(market) {
    if (market === 'hk' || market === 'crypto') {
        return;
    }
    currentSavedWatchlistMarket = market;
    const tabs = document.querySelectorAll('.watchlist-saved-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.market === market));
    renderSavedWatchlist();
}

function getSavedWatchlist() {
    try {
        const raw = localStorage.getItem(watchlistStorageKey);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function saveWatchlist(items) {
    localStorage.setItem(watchlistStorageKey, JSON.stringify(items));
}

function addToWatchlist(item) {
    try {
        const list = getSavedWatchlist();
        const key = `${item.market}:${item.code}`;
        if (list.some(x => `${x.market}:${x.code}` === key)) {
            const hint = document.getElementById('watchlistHint');
            if (hint) hint.textContent = `已在自选中：${item.code}`;
            return;
        }
        list.unshift({
            market: item.market,
            code: item.code,
            name: item.name,
            indicators: item.indicators || null,
            updatedAt: new Date().toISOString()
        });
        saveWatchlist(list);
        currentSavedWatchlistMarket = item.market;
        const tabs = document.querySelectorAll('.watchlist-saved-tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.market === currentSavedWatchlistMarket));
        const hint = document.getElementById('watchlistHint');
        if (hint) hint.textContent = `已加入自选：${item.code}`;
        renderSavedWatchlist();
    } catch (e) {
        const hint = document.getElementById('watchlistHint');
        if (hint) hint.textContent = `加入自选失败：${e && e.message ? e.message : 'localStorage 不可用'}`;
    }
}

function handleWatchlistAdd(market, code, name) {
    const indicators = window[`__wl_ind_${market}_${code}`] || null;
    addToWatchlist({ market, code, name, indicators });
}

function removeFromWatchlist(market, code) {
    const list = getSavedWatchlist().filter(x => !(x.market === market && x.code === code));
    saveWatchlist(list);
    renderSavedWatchlist();
}

function formatMetric(v) {
    if (v === null || v === undefined || v === '') return '--';
    if (typeof v === 'number' && !Number.isFinite(v)) return '--';
    return String(v);
}

function renderWatchlistItem(container, item, mode) {
    const ind = item.indicators || {};
    const price = ind.price != null ? ind.price : ind.last_price;
    const changePercent = ind.changePercent != null ? ind.changePercent : ind.change_percent;
    const rsi = ind.rsi14 != null ? ind.rsi14 : (ind.rsi && ind.rsi.value);
    const macdTrend = ind.macdTrend != null ? ind.macdTrend : (ind.macd && ind.macd.trend);
    const ma20 = ind.ma20 != null ? ind.ma20 : (ind.ema && ind.ema.ema20);
    const ma60 = ind.ma60 != null ? ind.ma60 : (ind.ema && ind.ema.ema60);

    const title = `${item.name || '--'} (${item.code})`;
    const sub = item.market === 'cn' ? 'A股' : item.market === 'us' ? '美股' : item.market;
    const btnHtml = mode === 'result'
        ? `<button class="btn-secondary wl-add-btn" data-market="${item.market}" data-code="${item.code}" data-name="${String(item.name || '').replaceAll('"','&quot;')}">加入自选</button>`
        : `<button class="btn-secondary" onclick="refreshSingleWatchlist('${item.market}','${item.code}')">刷新</button>
           <button class="btn-secondary" onclick="removeFromWatchlist('${item.market}','${item.code}')">移除</button>`;

    container.innerHTML += `
        <div class="watchlist-item" id="wl-${item.market}-${item.code}">
            <div class="watchlist-item-head">
                <div>
                    <div class="watchlist-item-title">${title}</div>
                    <div class="watchlist-item-sub">${sub}</div>
                </div>
                <div class="watchlist-item-actions">
                    ${btnHtml}
                </div>
            </div>
            <div class="watchlist-metrics">
                <div class="watchlist-metric"><div class="k">现价</div><div class="v" id="wl-price-${item.market}-${item.code}">${formatMetric(price)}</div></div>
                <div class="watchlist-metric"><div class="k">涨跌幅</div><div class="v" id="wl-chg-${item.market}-${item.code}">${formatMetric(changePercent != null ? `${changePercent}%` : '--')}</div></div>
                <div class="watchlist-metric"><div class="k">RSI(14)</div><div class="v" id="wl-rsi-${item.market}-${item.code}">${formatMetric(rsi)}</div></div>
                <div class="watchlist-metric"><div class="k">MACD</div><div class="v" id="wl-macd-${item.market}-${item.code}">${formatMetric(macdTrend)}</div></div>
                <div class="watchlist-metric"><div class="k">MA20/EMA20</div><div class="v" id="wl-ma20-${item.market}-${item.code}">${formatMetric(ma20)}</div></div>
                <div class="watchlist-metric"><div class="k">MA60/EMA60</div><div class="v" id="wl-ma60-${item.market}-${item.code}">${formatMetric(ma60)}</div></div>
            </div>
        </div>
    `;
}

async function fetchIndicatorsFor(market, code, name) {
    try {
        const resp = await apiFetch(`/api/watchlist/indicators?market=${encodeURIComponent(market)}&code=${encodeURIComponent(code)}&name=${encodeURIComponent(name || '')}`);
        const data = await resp.json();
        if (!data.success) {
            return null;
        }
        return data.data;
    } catch {
        return null;
    }
}

async function applyIndicatorsToDom(market, code, indicators) {
    const priceEl = document.getElementById(`wl-price-${market}-${code}`);
    const chgEl = document.getElementById(`wl-chg-${market}-${code}`);
    const rsiEl = document.getElementById(`wl-rsi-${market}-${code}`);
    const macdEl = document.getElementById(`wl-macd-${market}-${code}`);
    const ma20El = document.getElementById(`wl-ma20-${market}-${code}`);
    const ma60El = document.getElementById(`wl-ma60-${market}-${code}`);

    if (!indicators) return;
    const price = indicators.price != null ? indicators.price : indicators.last_price;
    const changePercent = indicators.changePercent != null ? indicators.changePercent : indicators.change_percent;
    const rsi = indicators.rsi14 != null ? indicators.rsi14 : (indicators.rsi && indicators.rsi.value);
    const macdTrend = indicators.macdTrend != null ? indicators.macdTrend : (indicators.macd && indicators.macd.trend);
    const ma20 = indicators.ma20 != null ? indicators.ma20 : (indicators.ema && indicators.ema.ema20);
    const ma60 = indicators.ma60 != null ? indicators.ma60 : (indicators.ema && indicators.ema.ema60);

    if (priceEl) priceEl.textContent = formatMetric(price);
    if (chgEl) chgEl.textContent = formatMetric(changePercent != null ? `${changePercent}%` : '--');
    if (rsiEl) rsiEl.textContent = formatMetric(rsi);
    if (macdEl) macdEl.textContent = formatMetric(macdTrend);
    if (ma20El) ma20El.textContent = formatMetric(ma20);
    if (ma60El) ma60El.textContent = formatMetric(ma60);
}

async function watchlistSearch() {
    const input = document.getElementById('watchlistKeyword');
    const q = (input && input.value ? input.value : '').trim();
    const hint = document.getElementById('watchlistHint');
    const listEl = document.getElementById('watchlistResultsList');
    if (!q) {
        if (hint) hint.textContent = '请输入搜索关键词或代码。';
        return;
    }
    if (currentWatchlistMarket === 'hk' || currentWatchlistMarket === 'crypto') {
        if (hint) hint.textContent = '该市场暂不支持。';
        return;
    }
    if (listEl) listEl.innerHTML = '<div style="color:#8892b0;padding:10px;">正在搜索...</div>';
    try {
        const resp = await apiFetch(`/api/watchlist/search?market=${encodeURIComponent(currentWatchlistMarket)}&q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        if (!data.success) throw new Error(data.error || '搜索失败');
        const results = Array.isArray(data.data) ? data.data : [];
        if (listEl) listEl.innerHTML = '';
        if (!results.length) {
            if (listEl) listEl.innerHTML = '<div style="color:#8892b0;padding:10px;">暂无结果</div>';
            return;
        }
        results.slice(0, 10).forEach(r => {
            window[`__wl_ind_${currentWatchlistMarket}_${r.code}`] = null;
            renderWatchlistItem(listEl, { market: currentWatchlistMarket, code: r.code, name: r.name, indicators: null }, 'result');
        });
        for (const r of results.slice(0, 10)) {
            const ind = await fetchIndicatorsFor(currentWatchlistMarket, r.code, r.name);
            window[`__wl_ind_${currentWatchlistMarket}_${r.code}`] = ind;
            await applyIndicatorsToDom(currentWatchlistMarket, r.code, ind);
        }
    } catch (e) {
        if (listEl) listEl.innerHTML = '<div style="color:#ff4757;padding:10px;">搜索失败</div>';
        if (hint) hint.textContent = e && e.message ? e.message : '搜索失败';
    }
}

function renderSavedWatchlist() {
    const listEl = document.getElementById('watchlistSavedList');
    if (!listEl) return;
    const all = getSavedWatchlist();
    const list = all.filter(x => x.market === currentSavedWatchlistMarket);
    listEl.innerHTML = '';
    if (!list.length) {
        listEl.innerHTML = '<div style="color:#8892b0;padding:10px;">暂无自选股票</div>';
        return;
    }
    list.forEach(item => {
        renderWatchlistItem(listEl, item, 'saved');
    });
    list.forEach(async (item) => {
        if (item.indicators) {
            await applyIndicatorsToDom(item.market, item.code, item.indicators);
        }
    });
}

async function refreshSingleWatchlist(market, code) {
    const list = getSavedWatchlist();
    const item = list.find(x => x.market === market && x.code === code);
    if (!item) return;
    const ind = await fetchIndicatorsFor(market, code, item.name);
    if (!ind) return;
    item.indicators = ind;
    item.updatedAt = new Date().toISOString();
    saveWatchlist(list);
    await applyIndicatorsToDom(market, code, ind);
}

async function refreshWatchlistIndicators() {
    const list = getSavedWatchlist();
    for (const item of list) {
        const ind = await fetchIndicatorsFor(item.market, item.code, item.name);
        if (!ind) continue;
        item.indicators = ind;
        item.updatedAt = new Date().toISOString();
        await applyIndicatorsToDom(item.market, item.code, ind);
    }
    saveWatchlist(list);
}

let strategyLibScope = 'all';
let strategyLibPage = 1;
const strategyLibPageSize = 12;
let strategySelectedId = null;
let strategyEditingId = null;
let strategyBacktestId = null;
let strategyEquityChart = null;
let backtestRunsPage = 1;
const backtestRunsPageSize = 12;
let backtestSelectedId = null;
let backtestEquityChart = null;
let currentBacktestDetailId = null;

function initStrategyLibraryUIOnce() {
    const input = document.getElementById('strategySearchInput');
    if (input && input.dataset.bound !== '1') {
        input.dataset.bound = '1';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                strategyLibPage = 1;
                loadStrategyLibrary();
            }
        });
    }
}

function switchStrategyScope(scope) {
    strategyLibScope = scope;
    strategyLibPage = 1;
    const tabs = document.querySelectorAll('.strategy-lib-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.scope === scope));
    loadStrategyLibrary();
}

function _strategyBuiltinParam() {
    if (strategyLibScope === 'builtin') return '1';
    if (strategyLibScope === 'custom') return '0';
    return '';
}

async function loadStrategyLibrary(page) {
    if (page) strategyLibPage = page;
    const listEl = document.getElementById('strategyList');
    const qInput = document.getElementById('strategySearchInput');
    const q = qInput ? qInput.value.trim() : '';
    const builtin = _strategyBuiltinParam();
    const url = `/api/strategy-library?q=${encodeURIComponent(q)}&builtin=${encodeURIComponent(builtin)}&page=${encodeURIComponent(strategyLibPage)}&pageSize=${encodeURIComponent(strategyLibPageSize)}`;
    if (listEl) listEl.innerHTML = '<div style="color:#8892b0;padding:10px;">加载中...</div>';
    try {
        const resp = await apiFetch(url);
        let data = null;
        try {
            data = await resp.json();
        } catch (e) {
            const txt = await resp.text().catch(() => '');
            const head = (txt || '').slice(0, 120).replace(/\s+/g, ' ').trim();
            throw new Error(`返回非JSON（${resp.status}）：${head || 'empty body'}`);
        }
        if (!resp.ok || !data.success) throw new Error((data && data.error) || `加载失败(${resp.status})`);
        renderStrategyList(data.items || [], data.total || 0, data.page || 1, data.page_size || strategyLibPageSize);
    } catch (e) {
        if (listEl) listEl.innerHTML = `<div style="color:#ff4757;padding:10px;">${escapeHtml(e && e.message ? e.message : '加载失败')}</div>`;
    }
}

function renderStrategyList(items, total, page, pageSize) {
    const listEl = document.getElementById('strategyList');
    const pagEl = document.getElementById('strategyLibPagination');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!items.length) {
        listEl.innerHTML = '<div style="color:#8892b0;padding:10px;">暂无策略</div>';
    } else {
        items.forEach(it => {
            const tags = Array.isArray(it.tags) ? it.tags.slice(0, 4) : [];
            const tagHtml = tags.map(t => `<span class="strategy-tag">${escapeHtml(String(t))}</span>`).join('');
            const isActive = strategySelectedId === it.id;
            listEl.innerHTML += `
                <div class="strategy-list-item ${isActive ? 'active' : ''}" onclick="selectStrategy(${it.id})">
                    <div class="strategy-list-title">#${escapeHtml(String(it.id))} · ${escapeHtml(it.name || '')}</div>
                    <div class="strategy-list-desc">${escapeHtml((it.description || '').slice(0, 80))}</div>
                    <div class="strategy-list-meta">
                        ${it.type ? `<span class="strategy-tag">${escapeHtml(it.type)}</span>` : ''}
                        ${it.is_builtin ? `<span class="strategy-tag">内置</span>` : `<span class="strategy-tag">自定义</span>`}
                        ${tagHtml}
                    </div>
                </div>
            `;
        });
    }

    if (pagEl) {
        const pages = total > 0 ? Math.ceil(total / pageSize) : 1;
        const cur = Math.min(Math.max(page, 1), pages);
        pagEl.innerHTML = `
            <span class="news-page-info">共 ${total} 条，第 ${cur}/${pages} 页</span>
            <button class="news-page-btn" onclick="loadStrategyLibrary(1)" ${cur <= 1 ? 'disabled' : ''}>首页</button>
            <button class="news-page-btn" onclick="loadStrategyLibrary(${cur - 1})" ${cur <= 1 ? 'disabled' : ''}>上一页</button>
            <button class="news-page-btn" onclick="loadStrategyLibrary(${cur + 1})" ${cur >= pages ? 'disabled' : ''}>下一页</button>
            <button class="news-page-btn" onclick="loadStrategyLibrary(${pages})" ${cur >= pages ? 'disabled' : ''}>末页</button>
        `;
    }
}

async function selectStrategy(id) {
    strategySelectedId = id;
    loadStrategyLibrary(strategyLibPage);
    const detailEl = document.getElementById('strategyDetail');
    if (detailEl) detailEl.innerHTML = '<div style="color:#8892b0;padding:10px;">加载详情...</div>';
    try {
        const resp = await apiFetch(`/api/strategy-library/${id}`);
        let data = null;
        try {
            data = await resp.json();
        } catch (e) {
            const txt = await resp.text().catch(() => '');
            const head = (txt || '').slice(0, 120).replace(/\s+/g, ' ').trim();
            throw new Error(`返回非JSON（${resp.status}）：${head || 'empty body'}`);
        }
        if (!resp.ok || !data.success) throw new Error(data.error || `加载失败(${resp.status})`);
        renderStrategyDetail(data.data);
    } catch (e) {
        if (detailEl) detailEl.innerHTML = '<div style="color:#ff4757;padding:10px;">加载失败</div>';
    }
}

function _highlightPython(code) {
    const esc = escapeHtml(code || '');
    return esc
        .replace(/\b(def|return|import|from|for|while|if|elif|else|try|except|as|with|class)\b/g, '<span class="ta-metric">$1</span>')
        .replace(/\b(True|False|None)\b/g, '<span class="ta-num">$1</span>')
        .replace(/("([^"\\\\]|\\\\.)*"|'([^'\\\\]|\\\\.)*')/g, '<span class="ta-badge ta-badge-hold">$1</span>');
}

function renderStrategyDetail(s) {
    const detailEl = document.getElementById('strategyDetail');
    if (!detailEl) return;
    const tags = Array.isArray(s.tags) ? s.tags : [];
    const factors = Array.isArray(s.factors) ? s.factors : [];
    const tagHtml = tags.map(t => `<span class="strategy-tag">${escapeHtml(String(t))}</span>`).join('');
    const factorHtml = factors.map(f => `<span class="strategy-tag">${escapeHtml(String(f))}</span>`).join('');
    const isBuiltin = !!s.is_builtin;

    detailEl.innerHTML = `
        <div class="strategy-detail-title">#${escapeHtml(String(s.id))} · ${escapeHtml(s.name || '')}</div>
        <div class="strategy-detail-desc">${escapeHtml(s.description || '')}</div>
        <div class="strategy-list-meta">${s.type ? `<span class="strategy-tag">${escapeHtml(s.type)}</span>` : ''}${isBuiltin ? `<span class="strategy-tag">内置</span>` : `<span class="strategy-tag">自定义</span>`}${tagHtml}</div>
        <div class="strategy-factors">${factorHtml}</div>
        <div class="strategy-detail-actions">
            <button class="btn-primary" onclick="openStrategyBacktest(${s.id})">开始回测</button>
            <button class="btn-secondary" onclick="openStrategyEditor(${s.id})" ${isBuiltin ? 'disabled' : ''}>编辑策略</button>
            <button class="btn-secondary" onclick="deleteStrategyLibrary(${s.id})" ${isBuiltin ? 'disabled' : ''}>删除策略</button>
        </div>
        <div class="strategy-code">${_highlightPython(s.code || '')}</div>
        <div id="strategyBacktestResult" style="margin-top:14px;"></div>
    `;
}

function openStrategyEditor(id) {
    strategyEditingId = id || null;
    const modal = document.getElementById('strategyEditorModal');
    if (!modal) return;
    const titleEl = document.getElementById('strategyEditorTitle');
    if (titleEl) titleEl.textContent = id ? '编辑策略' : '新建策略';

    document.getElementById('strategyEditName').value = '';
    document.getElementById('strategyEditDesc').value = '';
    document.getElementById('strategyEditType').value = '';
    document.getElementById('strategyEditTags').value = '';
    document.getElementById('strategyEditParams').value = '{"fast_period":12,"slow_period":26}';
    document.getElementById('strategyEditCode').value = "import numpy as np\nimport pandas as pd\n\ndef strategy(df, params):\n    fast = int(params.get('fast_period', 12))\n    slow = int(params.get('slow_period', 26))\n    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()\n    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()\n    positions = pd.Series(np.where(ema_fast > ema_slow, 1.0, 0.0), index=df.index)\n    return positions\n";

    if (id) {
        apiFetch(`/api/strategy-library/${id}`).then(r => r.json()).then(res => {
            if (!res.success) return;
            const s = res.data;
            document.getElementById('strategyEditName').value = s.name || '';
            document.getElementById('strategyEditDesc').value = s.description || '';
            document.getElementById('strategyEditType').value = s.type || '';
            document.getElementById('strategyEditTags').value = Array.isArray(s.tags) ? s.tags.join(',') : '';
            document.getElementById('strategyEditParams').value = JSON.stringify(s.params || {}, null, 2);
            document.getElementById('strategyEditCode').value = s.code || '';
        });
    }

    modal.classList.remove('hidden');
}

function closeStrategyEditor() {
    const modal = document.getElementById('strategyEditorModal');
    if (modal) modal.classList.add('hidden');
}

async function saveStrategyLibrary() {
    const name = document.getElementById('strategyEditName').value.trim();
    const description = document.getElementById('strategyEditDesc').value.trim();
    const type = document.getElementById('strategyEditType').value.trim();
    const tagsRaw = document.getElementById('strategyEditTags').value.trim();
    const paramsRaw = document.getElementById('strategyEditParams').value.trim();
    const code = document.getElementById('strategyEditCode').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    let params = {};
    try {
        params = paramsRaw ? JSON.parse(paramsRaw) : {};
    } catch (e) {
        alert('参数 JSON 格式错误');
        return;
    }
    if (!name || !description || !code.trim()) {
        alert('名称/描述/代码不能为空');
        return;
    }
    const payload = { name, description, type, tags, params, code };
    try {
        const resp = await apiFetch(strategyEditingId ? `/api/strategy-library/${strategyEditingId}` : '/api/strategy-library', {
            method: strategyEditingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || '保存失败');
        closeStrategyEditor();
        loadStrategyLibrary(1);
    } catch (e) {
        alert(e && e.message ? e.message : '保存失败');
    }
}

async function deleteStrategyLibrary(id) {
    if (!confirm('确认删除该策略？')) return;
    try {
        const resp = await apiFetch(`/api/strategy-library/${id}`, { method: 'DELETE' });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || '删除失败');
        if (strategySelectedId === id) {
            const detailEl = document.getElementById('strategyDetail');
            if (detailEl) detailEl.innerHTML = '<div class="strategy-detail-empty">选择一个策略查看详情</div>';
            strategySelectedId = null;
        }
        loadStrategyLibrary(1);
    } catch (e) {
        alert(e && e.message ? e.message : '删除失败');
    }
}

function openStrategyBacktest(id) {
    strategyBacktestId = id;
    const modal = document.getElementById('strategyBacktestModal');
    if (!modal) return;
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const startD = new Date(now);
    startD.setFullYear(startD.getFullYear() - 1);
    const start = startD.toISOString().split('T')[0];
    document.getElementById('btStart').value = start;
    document.getElementById('btEnd').value = end;
    document.getElementById('btCash').value = '100000';
    document.getElementById('btParams').value = '';
    const hint = document.getElementById('btHint');
    if (hint) hint.textContent = '';
    modal.classList.remove('hidden');
}

function closeStrategyBacktest() {
    const modal = document.getElementById('strategyBacktestModal');
    if (modal) modal.classList.add('hidden');
}

async function runStrategyBacktest() {
    const hint = document.getElementById('btHint');
    const symbolRaw = document.getElementById('btSymbol').value.trim();
    const start_date = document.getElementById('btStart').value;
    const end_date = document.getElementById('btEnd').value;
    const initial_cash = Number(document.getElementById('btCash').value) || 100000;
    const paramsRaw = document.getElementById('btParams').value.trim();
    let params = {};
    try {
        params = paramsRaw ? JSON.parse(paramsRaw) : {};
    } catch {
        if (hint) hint.textContent = '参数 JSON 格式错误';
        return;
    }
    if (!strategyBacktestId) return;
    if (!symbolRaw) {
        if (hint) hint.textContent = '请填写股票代码';
        return;
    }
    const symbols = symbolRaw.replace('，', ',').replace('；', ',').split(',').map(s => s.trim()).filter(Boolean);
    if (hint) hint.textContent = '回测中...';
    try {
        const resp = await apiFetch(`/api/strategy-library/${strategyBacktestId}/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: symbolRaw, symbols, start_date, end_date, initial_cash, params })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || '回测失败');
        closeStrategyBacktest();
        renderBacktestResult(data.data);
        loadBacktestRuns(1);
        if (hint) hint.textContent = '';
    } catch (e) {
        if (hint) hint.textContent = e && e.message ? e.message : '回测失败';
    }
}

function renderBacktestResult(res) {
    const box = document.getElementById('strategyBacktestResult');
    if (!box) return;
    const m = res.metrics || {};
    box.innerHTML = `
        <div class="ta-section">
            <div class="ta-section-title">回测结果</div>
            <div class="ta-section-body">
                <div class="watchlist-metrics">
                    <div class="watchlist-metric"><div class="k">总收益率</div><div class="v">${formatMetric((m.total_return * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">年化收益</div><div class="v">${formatMetric((m.annualized_return * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">最大回撤</div><div class="v">${formatMetric((m.max_drawdown * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">夏普比率</div><div class="v">${formatMetric(m.sharpe)}</div></div>
                    <div class="watchlist-metric"><div class="k">胜率</div><div class="v">${formatMetric((m.win_rate * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">交易次数</div><div class="v">${formatMetric(m.trades)}</div></div>
                </div>
                <div style="margin-top:12px;">
                    <canvas id="strategyEquityChart" height="120"></canvas>
                </div>
            </div>
        </div>
    `;
    renderEquityChart(res.equity_curve || [], res.trades_list || []);
}

function renderEquityChart(curve, trades) {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('strategyEquityChart');
    if (!el) return;
    if (strategyEquityChart) {
        strategyEquityChart.destroy();
        strategyEquityChart = null;
    }
    const labels = curve.map(x => x.date);
    const data = curve.map(x => x.equity);
    const points = [];
    const exitPoints = [];
    const mapIdx = {};
    labels.forEach((d, i) => { mapIdx[d] = i; });
    trades.forEach(t => {
        const bt = t.buy_time || t.entry_date;
        const st = t.sell_time || t.exit_date;
        if (bt && mapIdx[bt] != null) {
            const i = mapIdx[bt];
            points.push({ x: labels[i], y: data[i] });
        }
        if (st && mapIdx[st] != null) {
            const i = mapIdx[st];
            exitPoints.push({ x: labels[i], y: data[i] });
        }
    });
    strategyEquityChart = new Chart(el.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Equity', data, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.10)', tension: 0.15, pointRadius: 0 },
                { label: 'Buy', type: 'scatter', data: points, pointBackgroundColor: '#00ff88', pointBorderColor: '#00ff88', pointRadius: 4 },
                { label: 'Sell', type: 'scatter', data: exitPoints, pointBackgroundColor: '#ff4757', pointBorderColor: '#ff4757', pointRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#ccd6f6' } } },
            scales: {
                x: { ticks: { color: '#8892b0', maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#8892b0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

async function loadBacktestRuns(page) {
    if (page) backtestRunsPage = page;
    const listEl = document.getElementById('backtestRunsList');
    const pagEl = document.getElementById('backtestRunsPagination');
    if (listEl) listEl.innerHTML = '<div style="color:#8892b0;padding:10px;">加载中...</div>';
    try {
        const sym = (document.getElementById('btFilterSymbol') && document.getElementById('btFilterSymbol').value || '').trim();
        const sid = (document.getElementById('btFilterStrategyId') && document.getElementById('btFilterStrategyId').value || '').trim();
        const sd = (document.getElementById('btFilterStart') && document.getElementById('btFilterStart').value || '').trim();
        const ed = (document.getElementById('btFilterEnd') && document.getElementById('btFilterEnd').value || '').trim();
        const qs = new URLSearchParams();
        qs.set('page', String(backtestRunsPage));
        qs.set('pageSize', String(backtestRunsPageSize));
        if (sym) qs.set('symbol', sym.split(',')[0].trim().toUpperCase());
        if (sid) qs.set('strategy_id', sid);
        if (sd) qs.set('start_date', sd);
        if (ed) qs.set('end_date', ed);
        const resp = await apiFetch(`/api/backtests?${qs.toString()}`);
        let data = null;
        try {
            data = await resp.json();
        } catch (e) {
            const txt = await resp.text().catch(() => '');
            const head = (txt || '').slice(0, 120).replace(/\s+/g, ' ').trim();
            throw new Error(`返回非JSON（${resp.status}）：${head || 'empty body'}`);
        }
        if (!resp.ok || !data.success) throw new Error((data && data.error) || `加载失败(${resp.status})`);
        renderBacktestRunsList(data.items || [], data.total || 0, data.page || 1, data.page_size || backtestRunsPageSize);
    } catch (e) {
        if (listEl) listEl.innerHTML = `<div style="color:#ff4757;padding:10px;">${escapeHtml(e && e.message ? e.message : '加载失败')}</div>`;
        if (pagEl) pagEl.innerHTML = '';
    }
}

function _statusBadge(status) {
    const s = (status || '').toLowerCase();
    if (s === 'done') return '<span class="strategy-tag">完成</span>';
    if (s === 'running') return '<span class="strategy-tag">运行中</span>';
    if (s === 'failed') return '<span class="strategy-tag">失败</span>';
    return `<span class="strategy-tag">${escapeHtml(status || '--')}</span>`;
}

function renderBacktestRunsList(items, total, page, pageSize) {
    const listEl = document.getElementById('backtestRunsList');
    const pagEl = document.getElementById('backtestRunsPagination');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!items.length) {
        listEl.innerHTML = '<div style="color:#8892b0;padding:10px;">暂无回测实例</div>';
    } else {
        items.forEach(it => {
            const isActive = backtestSelectedId === it.id;
            const symbols = Array.isArray(it.symbols) ? it.symbols : [];
            const symText = symbols.length ? symbols.join(' / ') : '';
            const tr = it.total_return != null ? (Number(it.total_return) * 100).toFixed(2) + '%' : '--';
            const mdd = it.max_drawdown != null ? (Number(it.max_drawdown) * 100).toFixed(2) + '%' : '--';
            listEl.innerHTML += `
                <div class="strategy-list-item ${isActive ? 'active' : ''}" onclick="navigateBacktestDetail(${it.id})">
                    <div class="strategy-list-title">${escapeHtml(it.name ? `${it.name}` : `回测#${it.id}`)}</div>
                    <div class="strategy-list-desc">${escapeHtml((it.strategy_name || ('策略#' + it.strategy_id)) + (symText ? ` · ${symText}` : ''))}</div>
                    <div class="strategy-list-meta">
                        ${_statusBadge(it.status)}
                        <span class="strategy-tag">${escapeHtml((it.start_date || '') + ' → ' + (it.end_date || ''))}</span>
                        <span class="strategy-tag">总收益 ${escapeHtml(tr)}</span>
                        <span class="strategy-tag">回撤 ${escapeHtml(mdd)}</span>
                    </div>
                </div>
            `;
        });
    }
    if (pagEl) {
        const pages = total > 0 ? Math.ceil(total / pageSize) : 1;
        const cur = Math.min(Math.max(page, 1), pages);
        pagEl.innerHTML = `
            <span class="news-page-info">共 ${total} 条，第 ${cur}/${pages} 页</span>
            <button class="news-page-btn" onclick="loadBacktestRuns(1)" ${cur <= 1 ? 'disabled' : ''}>首页</button>
            <button class="news-page-btn" onclick="loadBacktestRuns(${cur - 1})" ${cur <= 1 ? 'disabled' : ''}>上一页</button>
            <button class="news-page-btn" onclick="loadBacktestRuns(${cur + 1})" ${cur >= pages ? 'disabled' : ''}>下一页</button>
            <button class="news-page-btn" onclick="loadBacktestRuns(${pages})" ${cur >= pages ? 'disabled' : ''}>末页</button>
        `;
    }
}

function navigateBacktestList() {
    try {
        history.pushState({ page: 'backtest' }, '', '/backtest');
    } catch {}
    showBacktestListView();
}

function navigateBacktestDetail(id) {
    backtestSelectedId = id;
    try {
        history.pushState({ page: 'backtestDetail', id }, '', `/backtest/${id}`);
    } catch {}
    showBacktestDetailView(id);
}

function showBacktestListView() {
    hideAllAppViews();
    expandGroupForView('backtest');
    setActiveSidebarItem('backtest');
    persistAppSettings({ ...appSettings, lastView: 'backtest' });
    const searchSection = document.querySelector('.search-section');
    if (searchSection) searchSection.classList.add('hidden');
    const el = document.getElementById('backtestSection');
    if (el) el.classList.remove('hidden');
    loadBacktestRuns(1);
}

function navigateBacktestListNoPush() {
    showBacktestListView();
}

async function showBacktestDetailView(id) {
    currentBacktestDetailId = id;
    hideAllAppViews();
    expandGroupForView('backtestDetail');
    setActiveSidebarItem('backtest');
    persistAppSettings({ ...appSettings, lastView: 'backtest' });
    const searchSection = document.querySelector('.search-section');
    if (searchSection) searchSection.classList.add('hidden');
    const el = document.getElementById('backtestDetailSection');
    if (el) el.classList.remove('hidden');
    const box = document.getElementById('backtestDetailContent');
    if (box) box.innerHTML = '<div class="strategy-detail-empty">加载中...</div>';
    await loadBacktestDetail(id);
}

async function refreshBacktestDetail() {
    if (currentBacktestDetailId) {
        await loadBacktestDetail(currentBacktestDetailId);
    }
}

async function openBacktestDebug() {
    if (!currentBacktestDetailId) return;
    try {
        const resp = await apiFetch(`/api/backtests/${currentBacktestDetailId}/debug`);
        const data = await resp.json();
        alert(JSON.stringify(data, null, 2));
    } catch (e) {
        alert(e && e.message ? e.message : 'debug 失败');
    }
}

async function loadBacktestDetail(id) {
    const box = document.getElementById('backtestDetailContent');
    try {
        const resp = await apiFetch(`/api/backtests/${id}`);
        let data = null;
        try {
            data = await resp.json();
        } catch (e) {
            const txt = await resp.text().catch(() => '');
            const head = (txt || '').slice(0, 120).replace(/\s+/g, ' ').trim();
            throw new Error(`返回非JSON（${resp.status}）：${head || 'empty body'}`);
        }
        if (!resp.ok || !data.success) throw new Error((data && data.error) || `加载失败(${resp.status})`);
        const info = data.data && data.data.backtest_info ? data.data.backtest_info : (data.data || {});
        const trades = data.data && data.data.trades ? data.data.trades : (info.trades || []);
        renderBacktestDetailPage(info, trades);
    } catch (e) {
        if (box) box.innerHTML = `<div style="color:#ff4757;padding:10px;">${escapeHtml(e && e.message ? e.message : '加载失败')}</div>`;
    }
}

function renderBacktestDetailPage(info, trades) {
    const box = document.getElementById('backtestDetailContent');
    if (!box) return;
    const r = info || {};
    const status = (r.status || '').toLowerCase();
    const symbols = Array.isArray(r.symbols) ? r.symbols : [];
    const symText = symbols.length ? symbols.join(' / ') : '';
    const paramsText = r.params ? JSON.stringify(r.params, null, 2) : '{}';

    box.innerHTML = `
        <div class="strategy-detail-title">${escapeHtml(r.name || ('回测#' + r.id))}</div>
        <div class="strategy-detail-desc">${escapeHtml(r.strategy_name || ('策略#' + r.strategy_id))}</div>
        <div class="strategy-list-meta">
            ${_statusBadge(r.status)}
            <span class="strategy-tag">${escapeHtml((r.start_date || '') + ' → ' + (r.end_date || ''))}</span>
            <span class="strategy-tag">${escapeHtml(symText || '')}</span>
            <span class="strategy-tag">初始资金 ${escapeHtml(String(r.initial_capital || ''))}</span>
        </div>
        <div class="strategy-code" style="margin-top:12px;white-space:pre-wrap;">${escapeHtml(paramsText)}</div>
        ${status === 'failed' ? `<div style="color:#ff4757;margin-top:10px;">${escapeHtml(r.error || '失败')}</div>` : ''}
        <div id="backtestDetailResult" style="margin-top:14px;"></div>
    `;

    const result = r.result || {};
    const metrics = r.metrics || {
        total_return: r.total_return,
        annualized_return: r.annualized_return,
        max_drawdown: r.max_drawdown,
        sharpe: r.sharpe_ratio,
        win_rate: r.win_rate,
        trades: (trades || []).length
    };

    const body = document.getElementById('backtestDetailResult');
    if (status === 'done') {
        const merged = result && result.equity_curve ? result : { equity_curve: [], trades_list: [] };
        renderBacktestDetailResult(body, merged, metrics, trades || []);
    } else if (status === 'running') {
        if (body) body.innerHTML = '<div style="color:#8892b0;">回测运行中，稍后刷新查看结果。</div>';
    }
}

function renderBacktestDetailResult(container, result, metrics, trades) {
    const m = metrics || (result.metrics || {});
    const curve = result.equity_curve || [];
    container.innerHTML = `
        <div class="ta-section">
            <div class="ta-section-title">回测结果</div>
            <div class="ta-section-body">
                <div class="watchlist-metrics">
                    <div class="watchlist-metric"><div class="k">总收益率</div><div class="v">${formatMetric(((m.total_return || 0) * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">年化收益</div><div class="v">${formatMetric(((m.annualized_return || 0) * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">最大回撤</div><div class="v">${formatMetric(((m.max_drawdown || 0) * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">夏普比率</div><div class="v">${formatMetric(m.sharpe)}</div></div>
                    <div class="watchlist-metric"><div class="k">胜率</div><div class="v">${formatMetric(((m.win_rate || 0) * 100).toFixed(2) + '%')}</div></div>
                    <div class="watchlist-metric"><div class="k">交易次数</div><div class="v">${formatMetric(m.trades)}</div></div>
                </div>
                <div style="margin-top:12px;">
                    <canvas id="backtestEquityChart" height="120"></canvas>
                </div>
            </div>
        </div>
        <div class="ta-section">
            <div class="ta-section-title">交易明细</div>
            <div class="ta-section-body">
                <div class="strategy-lib-actions" style="margin-bottom:10px;">
                    <input type="text" id="tradeFilterSymbol" class="strategy-lib-search" placeholder="按股票筛选（可选）">
                    <button class="btn-secondary" onclick="applyTradeFilter()">筛选</button>
                    <button class="btn-secondary" onclick="resetTradeFilter()">重置</button>
                </div>
                <div class="finance-table-wrapper">
                    <table class="finance-table" id="tradeTable"></table>
                </div>
            </div>
        </div>
    `;
    window.__bt_trades_cache = Array.isArray(trades) ? trades : [];
    renderBacktestEquityChart(curve, trades);
    renderTradeTable(window.__bt_trades_cache);
}

function renderBacktestEquityChart(curve, trades) {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('backtestEquityChart');
    if (!el) return;
    if (backtestEquityChart) {
        backtestEquityChart.destroy();
        backtestEquityChart = null;
    }
    const labels = curve.map(x => x.date);
    const data = curve.map(x => x.equity);
    const points = [];
    const exitPoints = [];
    const mapIdx = {};
    labels.forEach((d, i) => { mapIdx[d] = i; });
    trades.forEach(t => {
        const bt = t.buy_time || t.entry_date;
        const st = t.sell_time || t.exit_date;
        if (bt && mapIdx[bt] != null) {
            const i = mapIdx[bt];
            points.push({ x: labels[i], y: data[i] });
        }
        if (st && mapIdx[st] != null) {
            const i = mapIdx[st];
            exitPoints.push({ x: labels[i], y: data[i] });
        }
    });
    backtestEquityChart = new Chart(el.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Equity', data, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.10)', tension: 0.15, pointRadius: 0 },
                { label: 'Buy', type: 'scatter', data: points, pointBackgroundColor: '#00ff88', pointBorderColor: '#00ff88', pointRadius: 4 },
                { label: 'Sell', type: 'scatter', data: exitPoints, pointBackgroundColor: '#ff4757', pointBorderColor: '#ff4757', pointRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#ccd6f6' } } },
            scales: {
                x: { ticks: { color: '#8892b0', maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#8892b0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function resetBacktestFilters() {
    const s = document.getElementById('btFilterSymbol');
    const sid = document.getElementById('btFilterStrategyId');
    const sd = document.getElementById('btFilterStart');
    const ed = document.getElementById('btFilterEnd');
    if (s) s.value = '';
    if (sid) sid.value = '';
    if (sd) sd.value = '';
    if (ed) ed.value = '';
    loadBacktestRuns(1);
}

function applyTradeFilter() {
    const input = document.getElementById('tradeFilterSymbol');
    const sym = (input && input.value ? input.value.trim().toUpperCase() : '');
    const all = window.__bt_trades_cache || [];
    const filtered = sym ? all.filter(t => String(t.symbol || '').toUpperCase().includes(sym)) : all;
    renderTradeTable(filtered);
}

function resetTradeFilter() {
    const input = document.getElementById('tradeFilterSymbol');
    if (input) input.value = '';
    renderTradeTable(window.__bt_trades_cache || []);
}

function renderTradeTable(trades) {
    const table = document.getElementById('tradeTable');
    if (!table) return;
    const rows = Array.isArray(trades) ? trades : [];
    table.innerHTML = `
        <thead>
            <tr>
                <th class="finance-th-index">股票</th>
                <th class="finance-th">买入时间</th>
                <th class="finance-th">买入价</th>
                <th class="finance-th">卖出时间</th>
                <th class="finance-th">卖出价</th>
                <th class="finance-th">持仓周期</th>
                <th class="finance-th">仓位(股)</th>
                <th class="finance-th">收益</th>
                <th class="finance-th">收益率</th>
                <th class="finance-th">触发原因</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(t => {
                const pnl = Number(t.pnl || 0);
                const pnlCls = pnl >= 0 ? 'finance-td-positive' : 'finance-td-negative';
                const pr = Number(t.pnl_ratio || 0) * 100;
                const prCls = pr >= 0 ? 'finance-td-positive' : 'finance-td-negative';
                let hold = '--';
                try {
                    const b = t.buy_time ? new Date(t.buy_time) : null;
                    const s = t.sell_time ? new Date(t.sell_time) : null;
                    if (b && s && !isNaN(b.getTime()) && !isNaN(s.getTime())) {
                        const days = Math.max(0, Math.round((s.getTime() - b.getTime()) / (24 * 3600 * 1000)));
                        hold = `${days}天`;
                    }
                } catch {}
                return `
                    <tr>
                        <td class="finance-td-index">${escapeHtml(t.symbol || '')}</td>
                        <td class="finance-td">${escapeHtml(t.buy_time || '')}</td>
                        <td class="finance-td">${escapeHtml(String(t.buy_price || ''))}</td>
                        <td class="finance-td">${escapeHtml(t.sell_time || '')}</td>
                        <td class="finance-td">${escapeHtml(String(t.sell_price || ''))}</td>
                        <td class="finance-td">${escapeHtml(hold)}</td>
                        <td class="finance-td">${escapeHtml(String(t.position_size || ''))}</td>
                        <td class="finance-td ${pnlCls}">${escapeHtml(String(pnl.toFixed(2)))}</td>
                        <td class="finance-td ${prCls}">${escapeHtml(String(pr.toFixed(2) + '%'))}</td>
                        <td class="finance-td" style="text-align:left;">${escapeHtml(t.signal_reason || '')}</td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
}

async function diagnoseTradingAgents() {
    const hint = document.getElementById('taHint');
    if (hint) hint.textContent = '诊断中...';
    try {
        const resp = await apiFetch('/api/ai/tradingagents/health');
        const result = await resp.json();
        if (!resp.ok) throw new Error((result && result.error) || `请求失败(${resp.status})`);
        const data = result && result.data ? result.data : {};
        const localKey = appSettings.tradingagents && (appSettings.tradingagents.openaiApiKey || '').trim();
        const lines = [];
        lines.push(`服务端 Python: ${data.server_python || '--'}`);
        lines.push(`服务端已配置 OPENAI_API_KEY: ${data.has_openai_api_key_env ? '是' : '否'}`);
        if (data.openai_key_fingerprint_env) lines.push(`服务端 Key 指纹: ${data.openai_key_fingerprint_env}`);
        if (data.openai_key_fingerprint_dotenv) lines.push(`.env Key 指纹: ${data.openai_key_fingerprint_dotenv}`);
        if (data.openai_key_fingerprint_env && data.openai_key_fingerprint_dotenv) {
            lines.push(`.env 与服务端一致: ${data.dotenv_matches_env ? '是' : '否'}`);
        }
        lines.push(`浏览器已保存 TradingAgents Key: ${localKey ? '是' : '否'}`);
        lines.push(`TradingAgents venv: ${data.tradingagents_venv_python_exists ? 'OK' : '缺失'}`);
        lines.push(`Runner 脚本: ${data.tradingagents_runner_exists ? 'OK' : '缺失'}`);
        if (!localKey && !data.has_openai_api_key_env) {
            lines.push('下一步：到“设置 → TradingAgents”填写 OpenAI API Key 并保存，然后回到此页生成报告。');
        } else {
            lines.push('下一步：回到此页点击“生成报告”，如果报错会显示具体原因。');
        }
        if (hint) hint.innerHTML = formatMarkdownSafe(lines.map(s => `- ${s}`).join('\n'));
    } catch (e) {
        if (hint) hint.textContent = `诊断失败：${e && e.message ? e.message : '未知错误'}`;
    }
}

function populateSettingsUI() {
    const apiBaseUrlInput = document.getElementById('settingApiBaseUrl');
    if (apiBaseUrlInput) apiBaseUrlInput.value = appSettings.apiBaseUrl || '';
    
    const providerSelect = document.getElementById('settingAiProvider');
    if (providerSelect) providerSelect.value = (appSettings.ai && appSettings.ai.provider) || 'backend';
    
    const aiApiKey = document.getElementById('settingAiApiKey');
    if (aiApiKey) aiApiKey.value = (appSettings.ai && appSettings.ai.apiKey) || '';
    
    const aiBaseUrl = document.getElementById('settingAiBaseUrl');
    if (aiBaseUrl) aiBaseUrl.value = (appSettings.ai && appSettings.ai.baseUrl) || '';
    
    const aiModel = document.getElementById('settingAiModel');
    if (aiModel) aiModel.value = (appSettings.ai && appSettings.ai.model) || '';
    
    const aiMaxTokens = document.getElementById('settingAiMaxTokens');
    if (aiMaxTokens) aiMaxTokens.value = (appSettings.ai && appSettings.ai.maxTokens) || 1024;
    
    const hint = document.getElementById('aiTestHint');
    if (hint) hint.textContent = '';

    const taKey = document.getElementById('settingTaOpenAiApiKey');
    if (taKey) taKey.value = (appSettings.tradingagents && appSettings.tradingagents.openaiApiKey) || '';

    const taBase = document.getElementById('settingTaOpenAiBaseUrl');
    if (taBase) taBase.value = (appSettings.tradingagents && appSettings.tradingagents.openaiBaseUrl) || '';

    const taDeep = document.getElementById('settingTaDeepModel');
    if (taDeep) taDeep.value = (appSettings.tradingagents && appSettings.tradingagents.deepModel) || '';

    const taQuick = document.getElementById('settingTaQuickModel');
    if (taQuick) taQuick.value = (appSettings.tradingagents && appSettings.tradingagents.quickModel) || '';

    const taDebate = document.getElementById('settingTaDebateRounds');
    if (taDebate) taDebate.value = (appSettings.tradingagents && appSettings.tradingagents.maxDebateRounds) || 1;

    const taRisk = document.getElementById('settingTaRiskRounds');
    if (taRisk) taRisk.value = (appSettings.tradingagents && appSettings.tradingagents.maxRiskDiscussRounds) || 1;
}

function saveAppSettingsFromUI() {
    const apiBaseUrlInput = document.getElementById('settingApiBaseUrl');
    const providerSelect = document.getElementById('settingAiProvider');
    const aiApiKey = document.getElementById('settingAiApiKey');
    const aiBaseUrl = document.getElementById('settingAiBaseUrl');
    const aiModel = document.getElementById('settingAiModel');
    const aiMaxTokens = document.getElementById('settingAiMaxTokens');
    const taKey = document.getElementById('settingTaOpenAiApiKey');
    const taBase = document.getElementById('settingTaOpenAiBaseUrl');
    const taDeep = document.getElementById('settingTaDeepModel');
    const taQuick = document.getElementById('settingTaQuickModel');
    const taDebate = document.getElementById('settingTaDebateRounds');
    const taRisk = document.getElementById('settingTaRiskRounds');
    
    const next = {
        ...appSettings,
        apiBaseUrl: apiBaseUrlInput ? apiBaseUrlInput.value.trim() : appSettings.apiBaseUrl,
        ai: {
            ...appSettings.ai,
            provider: providerSelect ? providerSelect.value : appSettings.ai.provider,
            apiKey: aiApiKey ? aiApiKey.value : appSettings.ai.apiKey,
            baseUrl: aiBaseUrl ? aiBaseUrl.value.trim() : appSettings.ai.baseUrl,
            model: aiModel ? aiModel.value.trim() : appSettings.ai.model,
            maxTokens: aiMaxTokens ? Number(aiMaxTokens.value) || 1024 : appSettings.ai.maxTokens
        },
        tradingagents: {
            ...appSettings.tradingagents,
            openaiApiKey: taKey ? taKey.value : appSettings.tradingagents.openaiApiKey,
            openaiBaseUrl: taBase ? taBase.value.trim() : appSettings.tradingagents.openaiBaseUrl,
            deepModel: taDeep ? taDeep.value.trim() : appSettings.tradingagents.deepModel,
            quickModel: taQuick ? taQuick.value.trim() : appSettings.tradingagents.quickModel,
            maxDebateRounds: taDebate ? Number(taDebate.value) || 1 : appSettings.tradingagents.maxDebateRounds,
            maxRiskDiscussRounds: taRisk ? Number(taRisk.value) || 1 : appSettings.tradingagents.maxRiskDiscussRounds
        }
    };
    
    persistAppSettings(next);
    populateSettingsUI();
    alert('设置已保存');
}

function resetAppSettings() {
    persistAppSettings(getDefaultAppSettings());
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('collapsed');
    ['stockAnalysis', 'trading', 'ai'].forEach(groupKey => {
        const submenu = document.querySelector(`[data-submenu="${groupKey}"]`);
        const caret = document.querySelector(`[data-caret="${groupKey}"]`);
        if (submenu) submenu.classList.remove('collapsed');
        if (caret) caret.textContent = '▾';
    });
    populateSettingsUI();
    alert('已恢复默认设置');
}

async function testAiChatConfig() {
    const hint = document.getElementById('aiTestHint');
    if (hint) hint.textContent = '测试中...';
    
    const providerSelect = document.getElementById('settingAiProvider');
    const aiApiKey = document.getElementById('settingAiApiKey');
    const aiBaseUrl = document.getElementById('settingAiBaseUrl');
    const aiModel = document.getElementById('settingAiModel');
    const aiMaxTokens = document.getElementById('settingAiMaxTokens');
    
    const tempSettings = {
        ...appSettings,
        ai: {
            ...appSettings.ai,
            provider: providerSelect ? providerSelect.value : appSettings.ai.provider,
            apiKey: aiApiKey ? aiApiKey.value : appSettings.ai.apiKey,
            baseUrl: aiBaseUrl ? aiBaseUrl.value.trim() : appSettings.ai.baseUrl,
            model: aiModel ? aiModel.value.trim() : appSettings.ai.model,
            maxTokens: aiMaxTokens ? Number(aiMaxTokens.value) || 256 : (appSettings.ai.maxTokens || 256)
        }
    };
    
    const prev = appSettings;
    try {
        appSettings = tempSettings;
        const reply = await sendAIChatMessage('你好，请用一句话说明你是谁。');
        if (hint) hint.textContent = `测试成功：${reply.slice(0, 80)}`;
    } catch (e) {
        if (hint) hint.textContent = `测试失败：${e && e.message ? e.message : '未知错误'}`;
    } finally {
        appSettings = prev;
    }
}

async function generateTradingAgentsReport() {
    const symbolInput = document.getElementById('taSymbol');
    const dateInput = document.getElementById('taDate');
    const languageSelect = document.getElementById('taLanguage');
    const modeSelect = document.getElementById('taMode');
    const hint = document.getElementById('taHint');
    const meta = document.getElementById('taMeta');
    const content = document.getElementById('taReportContent');
    
    const symbol = symbolInput ? symbolInput.value.trim().toUpperCase() : '';
    const date = dateInput ? dateInput.value : '';
    const language = languageSelect ? languageSelect.value : 'Chinese';
    const mode = modeSelect ? modeSelect.value : 'fast';
    const ta = appSettings.tradingagents || {};
    const openaiApiKey = (ta.openaiApiKey || '').trim();
    const openaiBaseUrl = (ta.openaiBaseUrl || '').trim();
    const deepModel = (ta.deepModel || '').trim();
    const quickModel = (ta.quickModel || '').trim();
    const maxDebateRounds = ta.maxDebateRounds;
    const maxRiskDiscussRounds = ta.maxRiskDiscussRounds;
    
    if (!symbol) {
        alert('请输入股票代码');
        return;
    }

    const shouldSendKey = !!openaiApiKey;
    
    if (hint) hint.textContent = '生成中...';
    if (meta) meta.textContent = '';
    if (content) content.textContent = '正在生成报告，请稍候...';
    const dl = document.getElementById('taDownloadBtn');
    if (dl) dl.disabled = true;
    
    try {
        const response = await apiFetch('/api/ai/tradingagents/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                symbol,
                date,
                language,
                mode,
                openai_api_key: shouldSendKey ? openaiApiKey : '',
                openai_base_url: openaiBaseUrl,
                deep_model: deepModel,
                quick_model: quickModel,
                max_debate_rounds: maxDebateRounds,
                max_risk_discuss_rounds: maxRiskDiscussRounds
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error((result && result.error) || `请求失败(${response.status})`);
        }
        
        if (!result.success || !result.data) {
            throw new Error((result && result.error) || '返回数据不完整');
        }
        
        const payload = result.data;
        const md = payload.report_markdown || '';
        const decision = payload.decision ? `\n\n### 信号摘要\n${payload.decision}` : '';
        const elapsed = payload.elapsed_seconds != null ? ` · 耗时: ${payload.elapsed_seconds}s` : '';
        const cached = result.cached ? ' · 缓存' : '';
        if (meta) meta.textContent = `${payload.symbol || symbol} · ${payload.trade_date || date || ''} · 数据源: ${payload.data_vendor || '--'}${elapsed}${cached}`;
        const merged = `${md}${decision}`.trim();
        __ta_last_md = merged;
        __ta_last_symbol = payload.symbol || symbol;
        __ta_last_date = payload.trade_date || date || '';
        if (content) content.innerHTML = renderTradingAgentsReport(merged || '暂无报告内容');
        if (dl) dl.disabled = !__ta_last_md;
        if (hint) hint.textContent = '生成完成';
    } catch (e) {
        if (hint) hint.textContent = `生成失败：${e && e.message ? e.message : '未知错误'}`;
        if (content) content.textContent = '生成失败，请检查后端配置与网络情况。';
        if (dl) dl.disabled = true;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && appSettings.sidebar && appSettings.sidebar.collapsed) {
        sidebar.classList.add('collapsed');
    }
    
    ['stockAnalysis', 'trading', 'ai'].forEach(groupKey => {
        const submenu = document.querySelector(`[data-submenu="${groupKey}"]`);
        const caret = document.querySelector(`[data-caret="${groupKey}"]`);
        const isCollapsed = appSettings.sidebar && appSettings.sidebar.groups && appSettings.sidebar.groups[groupKey];
        if (submenu) submenu.classList.toggle('collapsed', !!isCollapsed);
        if (caret) caret.textContent = isCollapsed ? '▸' : '▾';
    });
    
    const handleRoute = () => {
        const p = window.location && window.location.pathname ? window.location.pathname : '/';
        const m = p.match(/^\/backtest\/(\d+)$/);
        if (m) {
            showBacktestDetailView(Number(m[1]));
            return;
        }
        if (p === '/backtest') {
            navigateBacktestListNoPush();
            return;
        }
        const initialView = (appSettings && appSettings.lastView) ? appSettings.lastView : 'analysis';
        appNavigate(initialView);
    };

    window.addEventListener('popstate', () => {
        handleRoute();
    });

    handleRoute();
});

// 切换K线周期
async function switchKlinePeriod(period) {
    currentKlinePeriod = period;
    
    // 更新按钮状态
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btn = document.querySelector(`[data-period="${period}"]`);
    if (btn) btn.classList.add('active');
    
    // 重新加载数据 - 无论A股还是美股都重新调用
    const stockCode = document.getElementById('stockCode').value.trim().toUpperCase();
    const stockType = document.getElementById('stockType').value;
    
    if (stockCode) {
        await analyzeStock();
    }
}

// ==================== 财务报表模块 ====================

let currentFinancePeriod = 'annual';
let currentFinanceStatement = 'income';
let currentFinanceSymbol = '';
let currentFinanceName = '';
let financeSortCol = null;   // column key to sort by
let financeSortAsc = true;   // true = asc, false = desc
let financeRawData = [];      // keep raw rows for sorting

const FINANCE_LABELS = {
    // Income Statement
    operating_revenue: '营业总收入',
    total_revenue: '总收入',
    cost_of_revenue: '营业成本',
    gross_profit: '毛利润',
    selling_general_and_admin_expense: '管理费用（SGA）',
    research_and_development_expense: '研发费用（R&D）',
    operating_expense: '营业费用',
    operating_income: '营业利润',
    ebitda: 'EBITDA',
    total_pre_tax_income: '税前利润',
    tax_provision: '所得税',
    net_income: '净利润',
    basic_earnings_per_share: '基本每股收益',
    diluted_earnings_per_share: '稀释每股收益',
    // Balance Sheet
    cash_and_cash_equivalents: '现金及现金等价物',
    short_term_investments: '短期投资',
    net_receivables: '应收账款净额',
    inventories: '存货',
    total_current_assets: '流动资产合计',
    plant_property_equipment_net: '固定资产净值',
    total_non_current_assets: '非流动资产合计',
    total_assets: '资产总计',
    accounts_payable: '应付账款',
    current_debt: '短期债务',
    current_deferred_revenue: '递延收入（流动）',
    total_current_liabilities: '流动负债合计',
    long_term_debt: '长期债务',
    total_non_current_liabilities: '非流动负债合计',
    total_liabilities_net_minority_interest: '负债合计',
    common_stock_equity: '普通股权益',
    retained_earnings: '留存收益',
    // Cash Flow
    net_income_from_continuing_operations: '净利润（经营）',
    depreciation_and_amortization: '折旧与摊销',
    stock_based_compensation: '股票补偿（SBC）',
    change_in_working_capital: '营运资本变动',
    cash_flow_from_continuing_operating_activities: '经营活动现金流',
    investments_in_property_plant_and_equipment: '资本支出（PP&E）',
    net_investment_purchase_and_sale: '投资活动现金流净额',
    cash_flow_from_continuing_investing_activities: '投资活动现金流',
    net_issuance_payments_of_debt: '债务净变动',
    repurchase_of_common_equity: '股票回购',
    cash_dividends_paid: '支付股利',
    cash_flow_from_continuing_financing_activities: '筹资活动现金流',
    net_change_in_cash_and_equivalents: '现金及等价物净增加',
    beginning_cash_position: '期初现金',
    end_cash_position: '期末现金',
    free_cash_flow: '自由现金流',
};

function _fmtNum(v) {
    if (v === null || v === undefined || v === '') return '-';
    const n = parseFloat(v);
    if (isNaN(n)) return '-';
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3)  return n.toLocaleString('en-US', {maximumFractionDigits: 2});
    return n.toFixed(2);
}

function _fmtDate(v) {
    if (!v) return '-';
    try {
        const d = new Date(v);
        if (isNaN(d)) return '-';
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } catch { return '-'; }
}

function _getColLabel(key) {
    return FINANCE_LABELS[key] || key.replace(/_/g, ' ');
}

async function loadFinanceData() {
    const emptyEl = document.getElementById('financeEmpty');
    const loadingEl = document.getElementById('financeLoading');
    const wrapperEl = document.getElementById('financeTableWrapper');
    if (!currentFinanceSymbol) {
        if (emptyEl) { emptyEl.classList.remove('hidden'); emptyEl.querySelector('p').textContent = '\u2709 \u5728\u4e0a\u65b9\u641c\u7d22\u80a1\u7968\u540e\uff0c\u5373\u53ef\u67e5\u770b\u8d22\u52a1\u62a5\u8868'; }
        if (loadingEl) loadingEl.classList.add('hidden');
        if (wrapperEl) wrapperEl.classList.add('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (wrapperEl) wrapperEl.classList.add('hidden');

    const stmtMap = { income: 'income', balance: 'balance', cash: 'cash' };
    const endpoint = `/api/stock/financial/${stmtMap[currentFinanceStatement]}`;
    try {
        const resp = await apiFetch(`${endpoint}?code=${encodeURIComponent(currentFinanceSymbol)}&period=${currentFinancePeriod}`);
        const json = await resp.json();
        if (json.success && json.data && json.data.length > 0) {
            financeRawData = json.data;
            // reset sort on new data load
            financeSortCol = null;
            financeSortAsc = true;
            renderFinanceTable(json.data);
            if (loadingEl) loadingEl.classList.add('hidden');
            if (wrapperEl) wrapperEl.classList.remove('hidden');
        } else {
            financeRawData = [];
            if (loadingEl) loadingEl.classList.add('hidden');
            if (emptyEl) { emptyEl.classList.remove('hidden'); emptyEl.querySelector('p').textContent = '\u6682\u65e0\u8be5\u80a1\u7968\u7684\u8d22\u52a1\u6570\u636e'; }
        }
    } catch (e) {
        console.error('Finance load error:', e);
        financeRawData = [];
        if (loadingEl) loadingEl.classList.add('hidden');
        if (emptyEl) { emptyEl.classList.remove('hidden'); emptyEl.querySelector('p').textContent = '\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'; }
    }
}

function renderFinanceTable(rows) {
    const thead = document.getElementById('financeTableHead');
    const tbody = document.getElementById('financeTableBody');
    if (!thead || !tbody || !rows.length) return;

    const periods = rows.map(r => _fmtDate(r.period_ending));
    const fields = Object.keys(rows[0]).filter(k => k !== 'period_ending' && k !== 'fiscal_period' && rows[0][k] !== null && rows[0][k] !== undefined);

    // Build sortable header
    thead.innerHTML = '<tr><th class="finance-th-index">\u6307\u6807</th>' +
        periods.map((p, i) => {
            // find field index (column) — periods[i] corresponds to rows[i]
            return `<th class="finance-th finance-th-sortable" data-col="${i}" onclick="sortFinanceCol(${i})">
                <span class="finance-th-text">${p}</span>
                <span class="finance-sort-icon" id="sort-icon-${i}"></span>
            </th>`;
        }).join('') + '</tr>';

    // Apply current sort
    let sortedRows = rows.slice();
    if (financeSortCol !== null) {
        sortedRows.sort((a, b) => {
            const va = Object.values(a)[financeSortCol + 2]; // +2: skip period_ending, fiscal_period
            const vb = Object.values(b)[financeSortCol + 2];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const na = parseFloat(va), nb = parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb)) return financeSortAsc ? na - nb : nb - na;
            return financeSortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        // Update sort icons
        fields.forEach((_, i) => {
            const icon = document.getElementById(`sort-icon-${i}`);
            if (!icon) return;
            if (i === financeSortCol) {
                icon.textContent = financeSortAsc ? ' \u25b2' : ' \u25bc'; // ▲ or ▼
                icon.style.color = '#00d4ff';
            } else {
                icon.textContent = '';
            }
        });
    }

    // Find field keys in same order as values() iteration
    const fieldKeys = Object.keys(rows[0]).filter(k => k !== 'period_ending' && k !== 'fiscal_period');

    tbody.innerHTML = '';
    fields.forEach(key => {
        const fi = fieldKeys.indexOf(key);
        const label = _getColLabel(key);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="finance-td-index">${label}</td>` +
            sortedRows.map(row => {
                const val = row[key];
                const num = parseFloat(val);
                const cls = !isNaN(num) ? (num < 0 ? ' finance-td-negative' : num > 0 ? ' finance-td-positive' : '') : '';
                return `<td class="finance-td${cls}">${_fmtNum(val)}</td>`;
            }).join('');
        tbody.appendChild(tr);
    });
}

function sortFinanceCol(colIdx) {
    if (financeSortCol === colIdx) {
        financeSortAsc = !financeSortAsc;
    } else {
        financeSortCol = colIdx;
        financeSortAsc = true;
    }
    if (financeRawData.length) renderFinanceTable(financeRawData);
}

function switchFinancePeriod(period) {
    currentFinancePeriod = period;
    document.querySelectorAll('.finance-period-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.period === period);
    });
    loadFinanceData();
}

function switchFinanceStatement(stmt) {
    currentFinanceStatement = stmt;
    document.querySelectorAll('.finance-stmt-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.stmt === stmt);
    });
    loadFinanceData();
}

function exportFinanceTable() {
    const table = document.getElementById('financeTable');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(row =>
        Array.from(row.querySelectorAll('th, td'))
            .map(cell => `"${cell.textContent.replace(/"/g, '""')}"`)
            .join(',')
    ).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFinanceSymbol}_${currentFinanceStatement}_${currentFinancePeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleFinanceFullscreen(btn) {
    const wrapper = document.getElementById('financeTableWrapper');
    if (!wrapper) return;
    const isFullscreen = wrapper.classList.toggle('finance-fullscreen');
    if (btn) {
        btn.textContent = isFullscreen ? '\u2212' : '\u2b1a'; // − or ⬚
        btn.style.color = isFullscreen ? '#00ff88' : '';
    }
    document.getElementById('financeTableWrapper').dataset.fullscreen = isFullscreen;
}

// ESC key exits finance fullscreen
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const wrapper = document.getElementById('financeTableWrapper');
        if (wrapper && wrapper.dataset.fullscreen === 'true') {
            wrapper.classList.remove('finance-fullscreen');
            wrapper.dataset.fullscreen = 'false';
            const btn = document.querySelector('[data-fullscreen-btn]');
            if (btn) { btn.textContent = '\u2b1a'; btn.style.color = ''; }
        }
    }
});

// Sync finance tab when analyzeStock completes
const _origAnalyzeStock = window.analyzeStock;
window.analyzeStock = async function() {
    if (_origAnalyzeStock) await _origAnalyzeStock.apply(this, arguments);
    const codeInput = document.getElementById('stockCode');
    const nameEl = document.getElementById('stockName');
    currentFinanceSymbol = codeInput ? codeInput.value.trim().toUpperCase() : '';
    currentFinanceName = nameEl ? nameEl.textContent : '';
    const fNameEl = document.getElementById('financeStockName');
    const fCodeEl = document.getElementById('financeStockCode');
    if (fNameEl) fNameEl.textContent = currentFinanceName || currentFinanceSymbol;
    if (fCodeEl) fCodeEl.textContent = currentFinanceSymbol;
    const financeSection = document.getElementById('financeSection');
    if (financeSection && !financeSection.classList.contains('hidden')) {
        loadFinanceData();
    }
};
