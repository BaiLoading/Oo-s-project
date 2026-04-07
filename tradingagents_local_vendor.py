from datetime import datetime
from typing import Optional

import pandas as pd
import requests
from stockstats import wrap


def _get_base_url() -> str:
    import os
    base = (os.environ.get("TA_DATA_BASE_URL") or "").strip().rstrip("/")
    if not base:
        raise RuntimeError("TA_DATA_BASE_URL not set")
    return base


def _infer_market(symbol: str) -> str:
    s = (symbol or "").strip().upper()
    if s.isdigit() and len(s) == 6:
        return "cn"
    if s.endswith(".HK"):
        return "hk"
    if "-" in s:
        return "crypto"
    return "us"


def _fetch_kline(symbol: str, start_date: str, end_date: str, timeout_seconds: int = 120):
    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)
    days = int(max(10, (end_dt - start_dt).days + 5))

    base = _get_base_url()
    market = _infer_market(symbol)
    url = f"{base}/api/stock/data"
    resp = requests.get(
        url,
        params={"code": symbol, "market": market, "days": days},
        timeout=timeout_seconds,
    )
    resp.raise_for_status()
    payload = resp.json()
    rows = (payload or {}).get("data") or []
    if not isinstance(rows, list) or len(rows) < 2:
        raise RuntimeError("No sufficient kline data from local data API")
    return rows


def get_stock_data_local(symbol: str, start_date: str, end_date: str) -> str:
    rows = _fetch_kline(symbol, start_date, end_date)
    df = pd.DataFrame(rows)
    df["Date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["Date"]).sort_values("Date")
    df = df.rename(columns={"open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"})
    df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]

    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)
    df = df[(df["Date"] >= start_dt) & (df["Date"] <= end_dt)].copy()
    df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")

    header = f"# Stock data for {symbol.upper()} from {start_date} to {end_date}\n"
    header += f"# Total records: {len(df)}\n"
    header += f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    header += "# Source: local /api/stock/data\n\n"
    return header + df.to_csv(index=False)


def get_indicators_local(symbol: str, indicator: str, curr_date: str, look_back_days: int = 30) -> str:
    end_date = curr_date
    curr_dt = pd.to_datetime(curr_date)
    start_dt = curr_dt - pd.Timedelta(days=int(look_back_days) + 60)
    rows = _fetch_kline(symbol, start_dt.strftime("%Y-%m-%d"), end_date)

    df = pd.DataFrame(rows)
    df["Date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["Date"]).sort_values("Date")
    df = df.rename(columns={"open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"})
    df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]
    df = df[df["Date"] <= curr_dt].copy()
    if df.empty:
        raise RuntimeError("No data for indicator calculation")

    ind = (indicator or "").strip().lower()
    ss = wrap(df)
    ss["Date"] = pd.to_datetime(ss["Date"], errors="coerce")
    ss = ss.dropna(subset=["Date"]).sort_values("Date")
    ss["date_str"] = ss["Date"].dt.strftime("%Y-%m-%d")

    window_start = curr_dt - pd.Timedelta(days=int(look_back_days))
    window = ss[ss["Date"] >= window_start].copy()
    if window.empty:
        window = ss.tail(int(look_back_days) + 1).copy()

    if ind not in window.columns:
        _ = window[ind]

    out_df = window[["date_str", ind]].rename(columns={"date_str": "Date", ind: ind})
    header = f"# Indicator `{ind}` for {symbol.upper()} up to {curr_date} (look_back_days={look_back_days})\n"
    header += "# Source: local /api/stock/data\n\n"
    return header + out_df.to_csv(index=False)
