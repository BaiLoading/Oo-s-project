import json


def _tmpl_ema_crossover(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    fast = int(params.get('fast_period', {defaults['fast_period']}))\n"
        f"    slow = int(params.get('slow_period', {defaults['slow_period']}))\n"
        "    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()\n"
        "    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()\n"
        "    positions = pd.Series(np.where(ema_fast > ema_slow, 1.0, 0.0), index=df.index)\n"
        "    return positions\n"
    )


def _tmpl_sma_crossover(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    fast = int(params.get('fast_period', {defaults['fast_period']}))\n"
        f"    slow = int(params.get('slow_period', {defaults['slow_period']}))\n"
        "    sma_fast = df['close'].rolling(fast).mean()\n"
        "    sma_slow = df['close'].rolling(slow).mean()\n"
        "    positions = pd.Series(np.where(sma_fast > sma_slow, 1.0, 0.0), index=df.index)\n"
        "    return positions\n"
    )


def _tmpl_bollinger_breakout(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    period = int(params.get('period', {defaults['period']}))\n"
        f"    std = float(params.get('std_dev', {defaults['std_dev']}))\n"
        "    sma = df['close'].rolling(period).mean()\n"
        "    upper = sma + std * df['close'].rolling(period).std()\n"
        "    lower = sma - std * df['close'].rolling(period).std()\n"
        "    positions = pd.Series(0.0, index=df.index)\n"
        "    pos = 0.0\n"
        "    for i in range(period, len(df)):\n"
        "        if df['close'].iloc[i] > upper.iloc[i]:\n"
        "            pos = 1.0\n"
        "        elif df['close'].iloc[i] < lower.iloc[i]:\n"
        "            pos = 0.0\n"
        "        positions.iloc[i] = pos\n"
        "    return positions\n"
    )


def _tmpl_rsi_reversion(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    period = int(params.get('period', {defaults['period']}))\n"
        f"    buy_th = float(params.get('buy_threshold', {defaults['buy_threshold']}))\n"
        f"    sell_th = float(params.get('sell_threshold', {defaults['sell_threshold']}))\n"
        "    delta = df['close'].diff()\n"
        "    gain = delta.where(delta > 0, 0.0)\n"
        "    loss = (-delta).where(delta < 0, 0.0)\n"
        "    avg_gain = gain.rolling(period).mean()\n"
        "    avg_loss = loss.rolling(period).mean()\n"
        "    rs = avg_gain / avg_loss.replace(0, np.nan)\n"
        "    rsi = 100 - (100 / (1 + rs))\n"
        "    positions = pd.Series(0.0, index=df.index)\n"
        "    pos = 0.0\n"
        "    for i in range(period + 1, len(df)):\n"
        "        v = rsi.iloc[i]\n"
        "        if np.isnan(v):\n"
        "            positions.iloc[i] = pos\n"
        "            continue\n"
        "        if v <= buy_th:\n"
        "            pos = 1.0\n"
        "        elif v >= sell_th:\n"
        "            pos = 0.0\n"
        "        positions.iloc[i] = pos\n"
        "    return positions\n"
    )


def _tmpl_donchian_breakout(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    lookback = int(params.get('lookback', {defaults['lookback']}))\n"
        "    high_band = df['high'].rolling(lookback).max()\n"
        "    low_band = df['low'].rolling(lookback).min()\n"
        "    positions = pd.Series(0.0, index=df.index)\n"
        "    pos = 0.0\n"
        "    for i in range(lookback, len(df)):\n"
        "        if df['close'].iloc[i] > high_band.iloc[i]:\n"
        "            pos = 1.0\n"
        "        elif df['close'].iloc[i] < low_band.iloc[i]:\n"
        "            pos = 0.0\n"
        "        positions.iloc[i] = pos\n"
        "    return positions\n"
    )


def _tmpl_volume_breakout(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    vol_period = int(params.get('vol_period', {defaults['vol_period']}))\n"
        f"    price_period = int(params.get('price_period', {defaults['price_period']}))\n"
        f"    vol_mult = float(params.get('vol_mult', {defaults['vol_mult']}))\n"
        "    vma = df['volume'].rolling(vol_period).mean()\n"
        "    hh = df['high'].rolling(price_period).max()\n"
        "    positions = pd.Series(0.0, index=df.index)\n"
        "    pos = 0.0\n"
        "    for i in range(max(vol_period, price_period), len(df)):\n"
        "        if df['close'].iloc[i] >= hh.iloc[i] and df['volume'].iloc[i] >= vol_mult * vma.iloc[i]:\n"
        "            pos = 1.0\n"
        "        elif df['close'].iloc[i] < df['close'].rolling(5).mean().iloc[i]:\n"
        "            pos = 0.0\n"
        "        positions.iloc[i] = pos\n"
        "    return positions\n"
    )


def _tmpl_macd_trend(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    fast = int(params.get('fast_period', {defaults['fast_period']}))\n"
        f"    slow = int(params.get('slow_period', {defaults['slow_period']}))\n"
        f"    signal = int(params.get('signal_period', {defaults['signal_period']}))\n"
        "    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()\n"
        "    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()\n"
        "    macd = ema_fast - ema_slow\n"
        "    sig = macd.ewm(span=signal, adjust=False).mean()\n"
        "    positions = pd.Series(np.where(macd > sig, 1.0, 0.0), index=df.index)\n"
        "    return positions\n"
    )


def _tmpl_atr_breakout(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    period = int(params.get('period', {defaults['period']}))\n"
        f"    lookback = int(params.get('lookback', {defaults['lookback']}))\n"
        f"    atr_mult = float(params.get('atr_mult', {defaults['atr_mult']}))\n"
        "    high = df['high']\n"
        "    low = df['low']\n"
        "    close = df['close']\n"
        "    prev_close = close.shift(1)\n"
        "    tr = pd.concat([(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)\n"
        "    atr = tr.rolling(period).mean()\n"
        "    hh = high.rolling(lookback).max()\n"
        "    positions = pd.Series(0.0, index=df.index)\n"
        "    pos = 0.0\n"
        "    entry = np.nan\n"
        "    for i in range(max(period, lookback) + 1, len(df)):\n"
        "        if pos <= 0 and close.iloc[i] >= hh.iloc[i]:\n"
        "            pos = 1.0\n"
        "            entry = close.iloc[i]\n"
        "        elif pos > 0 and not np.isnan(entry) and close.iloc[i] <= entry - atr_mult * atr.iloc[i]:\n"
        "            pos = 0.0\n"
        "            entry = np.nan\n"
        "        positions.iloc[i] = pos\n"
        "    return positions\n"
    )


def _tmpl_kdj(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    n = int(params.get('n', {defaults['n']}))\n"
        f"    k_period = int(params.get('k_period', {defaults['k_period']}))\n"
        f"    d_period = int(params.get('d_period', {defaults['d_period']}))\n"
        f"    buy_level = float(params.get('buy_level', {defaults['buy_level']}))\n"
        f"    sell_level = float(params.get('sell_level', {defaults['sell_level']}))\n"
        "    low_n = df['low'].rolling(n).min()\n"
        "    high_n = df['high'].rolling(n).max()\n"
        "    rsv = (df['close'] - low_n) / (high_n - low_n).replace(0, np.nan) * 100\n"
        "    k = rsv.ewm(span=k_period, adjust=False).mean()\n"
        "    d = k.ewm(span=d_period, adjust=False).mean()\n"
        "    positions = pd.Series(0.0, index=df.index)\n"
        "    pos = 0.0\n"
        "    for i in range(n + max(k_period, d_period) + 1, len(df)):\n"
        "        if k.iloc[i] > d.iloc[i] and k.iloc[i] < buy_level:\n"
        "            pos = 1.0\n"
        "        elif k.iloc[i] < d.iloc[i] and k.iloc[i] > sell_level:\n"
        "            pos = 0.0\n"
        "        positions.iloc[i] = pos\n"
        "    return positions\n"
    )


def _tmpl_adx(defaults):
    return (
        "import numpy as np\n"
        "import pandas as pd\n"
        "def strategy(df, params):\n"
        f"    period = int(params.get('period', {defaults['period']}))\n"
        f"    threshold = float(params.get('threshold', {defaults['threshold']}))\n"
        "    high = df['high']\n"
        "    low = df['low']\n"
        "    close = df['close']\n"
        "    up = high.diff()\n"
        "    down = -low.diff()\n"
        "    plus_dm = np.where((up > down) & (up > 0), up, 0.0)\n"
        "    minus_dm = np.where((down > up) & (down > 0), down, 0.0)\n"
        "    prev_close = close.shift(1)\n"
        "    tr = pd.concat([(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)\n"
        "    atr = tr.rolling(period).mean()\n"
        "    plus_di = 100 * pd.Series(plus_dm, index=df.index).rolling(period).sum() / atr.replace(0, np.nan)\n"
        "    minus_di = 100 * pd.Series(minus_dm, index=df.index).rolling(period).sum() / atr.replace(0, np.nan)\n"
        "    dx = (abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, np.nan) * 100)\n"
        "    adx = dx.rolling(period).mean()\n"
        "    positions = pd.Series(0.0, index=df.index)\n"
        "    pos = 0.0\n"
        "    for i in range(period * 2 + 2, len(df)):\n"
        "        if adx.iloc[i] >= threshold and plus_di.iloc[i] > minus_di.iloc[i]:\n"
        "            pos = 1.0\n"
        "        elif adx.iloc[i] >= threshold and plus_di.iloc[i] < minus_di.iloc[i]:\n"
        "            pos = 0.0\n"
        "        positions.iloc[i] = pos\n"
        "    return positions\n"
    )


def _make(name, description, code, params, tags, type_name):
    return {
        "name": name,
        "description": description,
        "code": code,
        "params": params,
        "tags": tags,
        "type": type_name,
        "is_builtin": True,
    }


def builtin_strategies():
    out = []

    out.append(_make(
        "EMA Crossover 双均线",
        "快慢双均线交叉策略：当快线上穿慢线持有多头，否则空仓。仅演示，不保证收益，回测默认使用下一根K线执行以避免未来函数。",
        _tmpl_ema_crossover({"fast_period": 12, "slow_period": 26}),
        {"fast_period": 12, "slow_period": 26},
        ["均线", "EMA", "趋势"],
        "均线类",
    ))

    out.append(_make(
        "Bollinger Breakout 布林带突破",
        "价格突破布林带上轨持有多头，跌破下轨空仓。仅演示，不保证收益。",
        _tmpl_bollinger_breakout({"period": 20, "std_dev": 2.0}),
        {"period": 20, "std_dev": 2.0},
        ["波动", "布林带", "突破"],
        "波动类",
    ))

    ma_pairs = [(5, 20), (10, 30), (20, 60), (50, 200), (8, 21), (13, 34)]
    for fast, slow in ma_pairs:
        out.append(_make(
            f"SMA Crossover {fast}/{slow}",
            f"SMA 双均线交叉（{fast}/{slow}）。仅演示，不保证收益。",
            _tmpl_sma_crossover({"fast_period": fast, "slow_period": slow}),
            {"fast_period": fast, "slow_period": slow},
            ["均线", "SMA", "趋势"],
            "均线类",
        ))

    ema_pairs = [(5, 20), (9, 21), (10, 30), (20, 60), (26, 50), (50, 200), (7, 35), (12, 50)]
    for fast, slow in ema_pairs:
        if fast >= slow:
            continue
        out.append(_make(
            f"EMA Crossover {fast}/{slow}",
            f"EMA 双均线交叉（{fast}/{slow}）。仅演示，不保证收益。",
            _tmpl_ema_crossover({"fast_period": fast, "slow_period": slow}),
            {"fast_period": fast, "slow_period": slow},
            ["均线", "EMA", "趋势"],
            "均线类",
        ))

    boll_variants = [(20, 2.0), (20, 2.5), (15, 2.0), (30, 2.0), (10, 1.5), (50, 2.0)]
    for period, std in boll_variants:
        out.append(_make(
            f"Bollinger Breakout {period}/{std}",
            f"布林带突破（period={period}, std={std}）。仅演示，不保证收益。",
            _tmpl_bollinger_breakout({"period": period, "std_dev": std}),
            {"period": period, "std_dev": std},
            ["波动", "布林带", "突破"],
            "波动类",
        ))

    rsi_variants = [(14, 30, 70), (14, 25, 75), (10, 30, 70), (20, 30, 65), (6, 20, 80), (14, 35, 65)]
    for period, buy_th, sell_th in rsi_variants:
        out.append(_make(
            f"RSI Reversion {period} {buy_th}/{sell_th}",
            f"RSI 均值回归（period={period}）。RSI 低于阈值做多，高于阈值空仓。仅演示，不保证收益。",
            _tmpl_rsi_reversion({"period": period, "buy_threshold": buy_th, "sell_threshold": sell_th}),
            {"period": period, "buy_threshold": buy_th, "sell_threshold": sell_th},
            ["动量", "RSI", "均值回归"],
            "动量类",
        ))

    donchian_variants = [10, 20, 55, 30, 15, 40, 80, 25]
    for lookback in donchian_variants:
        out.append(_make(
            f"Donchian Breakout {lookback}",
            f"Donchian 通道突破（lookback={lookback}）。仅演示，不保证收益。",
            _tmpl_donchian_breakout({"lookback": lookback}),
            {"lookback": lookback},
            ["突破", "Donchian", "趋势"],
            "突破类",
        ))

    vol_variants = [(20, 20, 1.5), (20, 55, 1.8), (10, 20, 2.0), (30, 30, 1.6), (20, 10, 2.2), (14, 20, 1.7)]
    for vol_period, price_period, mult in vol_variants:
        out.append(_make(
            f"Volume Breakout v{vol_period}/p{price_period}/x{mult}",
            "量价突破：放量并创新高持有多头，否则空仓。仅演示，不保证收益。",
            _tmpl_volume_breakout({"vol_period": vol_period, "price_period": price_period, "vol_mult": mult}),
            {"vol_period": vol_period, "price_period": price_period, "vol_mult": mult},
            ["成交量", "突破", "量价"],
            "成交量类",
        ))

    macd_variants = [(12, 26, 9), (8, 21, 9), (5, 35, 5), (12, 50, 9)]
    for fast, slow, sig in macd_variants:
        out.append(_make(
            f"MACD Trend {fast}/{slow}/{sig}",
            "MACD 趋势跟随：MACD 线上穿信号线持有多头。仅演示，不保证收益。",
            _tmpl_macd_trend({"fast_period": fast, "slow_period": slow, "signal_period": sig}),
            {"fast_period": fast, "slow_period": slow, "signal_period": sig},
            ["趋势", "MACD"],
            "趋势类",
        ))

    atr_variants = [(14, 20, 2.0), (14, 55, 2.5), (20, 20, 1.8), (10, 20, 2.2)]
    for period, lookback, mult in atr_variants:
        out.append(_make(
            f"ATR Breakout p{period}/lb{lookback}/x{mult}",
            "ATR 突破 + ATR 止损：突破创新高入场，ATR 回撤止损退出。仅演示，不保证收益。",
            _tmpl_atr_breakout({"period": period, "lookback": lookback, "atr_mult": mult}),
            {"period": period, "lookback": lookback, "atr_mult": mult},
            ["波动", "ATR", "突破"],
            "波动类",
        ))

    kdj_variants = [(9, 3, 3, 30, 70), (9, 3, 3, 20, 80), (14, 3, 3, 30, 70), (9, 5, 5, 25, 75)]
    for n, kp, dp, buy_lv, sell_lv in kdj_variants:
        out.append(_make(
            f"KDJ Oscillator n{n}",
            "KDJ 震荡：低位金叉偏多，高位死叉偏空仓。仅演示，不保证收益。",
            _tmpl_kdj({"n": n, "k_period": kp, "d_period": dp, "buy_level": buy_lv, "sell_level": sell_lv}),
            {"n": n, "k_period": kp, "d_period": dp, "buy_level": buy_lv, "sell_level": sell_lv},
            ["动量", "KDJ"],
            "动量类",
        ))

    adx_variants = [(14, 25), (14, 20), (20, 25), (10, 25)]
    for period, th in adx_variants:
        out.append(_make(
            f"ADX Trend p{period}/th{th}",
            "ADX 趋势强度过滤：ADX 高于阈值且 +DI>-DI 持有多头。仅演示，不保证收益。",
            _tmpl_adx({"period": period, "threshold": th}),
            {"period": period, "threshold": th},
            ["趋势", "ADX"],
            "趋势类",
        ))

    combo_defs = [
        ("EMA+RSI Filter", "均线趋势 + RSI 过滤：趋势向上且 RSI 未过热才持有多头。", {"fast_period": 12, "slow_period": 26, "rsi_period": 14, "rsi_max": 70}),
        ("Boll+RSI Reversion", "布林带下轨 + RSI 超卖：超卖区域持有多头，回到中轨附近退出。", {"period": 20, "std_dev": 2.0, "rsi_period": 14, "buy_threshold": 30, "exit_threshold": 50}),
        ("Donchian+Volume", "Donchian 突破 + 放量确认：突破并放量才持有多头。", {"lookback": 20, "vol_period": 20, "vol_mult": 1.8}),
        ("SMA Trend + Pullback", "均线多头趋势中回撤买入：价格回到 SMA 附近且趋势未破。", {"trend_period": 60, "entry_period": 20, "band": 0.02}),
        ("Momentum 20D", "20日动量：过去 20 日收益为正则持有多头。", {"lookback": 20}),
    ]

    for name, desc, params in combo_defs:
        code = (
            "import numpy as np\n"
            "import pandas as pd\n"
            "def strategy(df, params):\n"
            f"    cfg = {json.dumps(params)}\n"
            "    for k,v in cfg.items():\n"
            "        if k not in params:\n"
            "            params[k] = v\n"
            "    positions = pd.Series(0.0, index=df.index)\n"
            "    pos = 0.0\n"
            "    if params.get('fast_period') and params.get('slow_period') and params.get('rsi_period'):\n"
            "        fast = int(params.get('fast_period'))\n"
            "        slow = int(params.get('slow_period'))\n"
            "        ema_fast = df['close'].ewm(span=fast, adjust=False).mean()\n"
            "        ema_slow = df['close'].ewm(span=slow, adjust=False).mean()\n"
            "        delta = df['close'].diff()\n"
            "        gain = delta.where(delta > 0, 0.0)\n"
            "        loss = (-delta).where(delta < 0, 0.0)\n"
            "        p = int(params.get('rsi_period'))\n"
            "        avg_gain = gain.rolling(p).mean()\n"
            "        avg_loss = loss.rolling(p).mean()\n"
            "        rs = avg_gain / avg_loss.replace(0, np.nan)\n"
            "        rsi = 100 - (100 / (1 + rs))\n"
            "        rsi_max = float(params.get('rsi_max', 70))\n"
            "        for i in range(max(slow, p) + 1, len(df)):\n"
            "            if ema_fast.iloc[i] > ema_slow.iloc[i] and (np.isnan(rsi.iloc[i]) or rsi.iloc[i] < rsi_max):\n"
            "                pos = 1.0\n"
            "            else:\n"
            "                pos = 0.0\n"
            "            positions.iloc[i] = pos\n"
            "        return positions\n"
            "    if params.get('period') and params.get('std_dev') and params.get('buy_threshold') and params.get('exit_threshold'):\n"
            "        period = int(params.get('period'))\n"
            "        std = float(params.get('std_dev'))\n"
            "        sma = df['close'].rolling(period).mean()\n"
            "        upper = sma + std * df['close'].rolling(period).std()\n"
            "        lower = sma - std * df['close'].rolling(period).std()\n"
            "        delta = df['close'].diff()\n"
            "        gain = delta.where(delta > 0, 0.0)\n"
            "        loss = (-delta).where(delta < 0, 0.0)\n"
            "        p = int(params.get('rsi_period', 14))\n"
            "        avg_gain = gain.rolling(p).mean()\n"
            "        avg_loss = loss.rolling(p).mean()\n"
            "        rs = avg_gain / avg_loss.replace(0, np.nan)\n"
            "        rsi = 100 - (100 / (1 + rs))\n"
            "        buy_th = float(params.get('buy_threshold'))\n"
            "        exit_th = float(params.get('exit_threshold'))\n"
            "        for i in range(max(period, p) + 1, len(df)):\n"
            "            if df['close'].iloc[i] < lower.iloc[i] and (np.isnan(rsi.iloc[i]) or rsi.iloc[i] <= buy_th):\n"
            "                pos = 1.0\n"
            "            elif df['close'].iloc[i] >= sma.iloc[i] and (np.isnan(rsi.iloc[i]) or rsi.iloc[i] >= exit_th):\n"
            "                pos = 0.0\n"
            "            positions.iloc[i] = pos\n"
            "        return positions\n"
            "    if params.get('lookback') and params.get('vol_period') and params.get('vol_mult'):\n"
            "        lb = int(params.get('lookback'))\n"
            "        vp = int(params.get('vol_period'))\n"
            "        vm = float(params.get('vol_mult'))\n"
            "        hh = df['high'].rolling(lb).max()\n"
            "        vma = df['volume'].rolling(vp).mean()\n"
            "        for i in range(max(lb, vp), len(df)):\n"
            "            if df['close'].iloc[i] >= hh.iloc[i] and df['volume'].iloc[i] >= vm * vma.iloc[i]:\n"
            "                pos = 1.0\n"
            "            elif df['close'].iloc[i] < df['close'].rolling(5).mean().iloc[i]:\n"
            "                pos = 0.0\n"
            "            positions.iloc[i] = pos\n"
            "        return positions\n"
            "    if params.get('trend_period') and params.get('entry_period') and params.get('band'):\n"
            "        tp = int(params.get('trend_period'))\n"
            "        ep = int(params.get('entry_period'))\n"
            "        band = float(params.get('band'))\n"
            "        trend = df['close'].rolling(tp).mean()\n"
            "        entry = df['close'].rolling(ep).mean()\n"
            "        for i in range(max(tp, ep), len(df)):\n"
            "            if df['close'].iloc[i] > trend.iloc[i] and df['close'].iloc[i] <= entry.iloc[i] * (1 + band):\n"
            "                pos = 1.0\n"
            "            elif df['close'].iloc[i] < trend.iloc[i]:\n"
            "                pos = 0.0\n"
            "            positions.iloc[i] = pos\n"
            "        return positions\n"
            "    if params.get('lookback'):\n"
            "        lb = int(params.get('lookback'))\n"
            "        ret = df['close'].pct_change(lb)\n"
            "        for i in range(lb + 1, len(df)):\n"
            "            pos = 1.0 if (ret.iloc[i] is not None and ret.iloc[i] > 0) else 0.0\n"
            "            positions.iloc[i] = pos\n"
            "        return positions\n"
            "    return positions\n"
        )
        out.append(_make(
            name,
            desc + " 仅演示，不保证收益。",
            code,
            params,
            ["组合", "多因子"],
            "组合策略",
        ))

    return out
