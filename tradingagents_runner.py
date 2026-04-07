import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta


def _default_trade_date():
    return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

def _parse_csv_list(value):
    items = []
    for part in (value or "").split(","):
        s = part.strip()
        if s:
            items.append(s)
    return items

def _is_rate_limit_error(message):
    msg = (message or "").lower()
    return any(
        s in msg
        for s in [
            "too many requests",
            "rate limited",
            "rate limit",
            "429",
        ]
    )

def _supports_reasoning_effort(model):
    m = (model or "").lower().strip()
    return m.startswith("gpt-5")

def _install_local_vendor_and_fallbacks():
    from tradingagents.dataflows import interface as ta_interface
    from tradingagents.dataflows.alpha_vantage_common import AlphaVantageRateLimitError
    from yfinance.exceptions import YFRateLimitError

    from tradingagents_local_vendor import get_stock_data_local, get_indicators_local

    if "get_stock_data" in ta_interface.VENDOR_METHODS:
        ta_interface.VENDOR_METHODS["get_stock_data"]["local"] = get_stock_data_local
    if "get_indicators" in ta_interface.VENDOR_METHODS:
        ta_interface.VENDOR_METHODS["get_indicators"]["local"] = get_indicators_local

    original_route = ta_interface.route_to_vendor

    def route_to_vendor_patched(method: str, *args, **kwargs):
        category = ta_interface.get_category_for_method(method)
        vendor_config = ta_interface.get_vendor(category, method)
        primary_vendors = [v.strip() for v in vendor_config.split(",") if v.strip()]

        if method not in ta_interface.VENDOR_METHODS:
            raise ValueError(f"Method '{method}' not supported")

        all_available_vendors = list(ta_interface.VENDOR_METHODS[method].keys())
        fallback_vendors = primary_vendors.copy()
        for vendor in all_available_vendors:
            if vendor not in fallback_vendors:
                fallback_vendors.append(vendor)

        last_err = None
        for vendor in fallback_vendors:
            if vendor not in ta_interface.VENDOR_METHODS[method]:
                continue

            if vendor == "alpha_vantage" and not os.environ.get("ALPHA_VANTAGE_API_KEY"):
                continue

            impl = ta_interface.VENDOR_METHODS[method][vendor]
            try:
                return impl(*args, **kwargs)
            except AlphaVantageRateLimitError as e:
                last_err = e
                continue
            except YFRateLimitError as e:
                last_err = e
                continue
            except Exception as e:
                msg = str(e)
                if vendor == "alpha_vantage" and "ALPHA_VANTAGE_API_KEY" in msg:
                    last_err = e
                    continue
                last_err = e
                continue

        if last_err:
            raise last_err
        return original_route(method, *args, **kwargs)

    ta_interface.route_to_vendor = route_to_vendor_patched

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--date", default="")
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--deep_model", default="gpt-4.1")
    parser.add_argument("--quick_model", default="gpt-4.1-mini")
    parser.add_argument("--base_url", default="https://api.openai.com/v1")
    parser.add_argument("--max_debate_rounds", type=int, default=1)
    parser.add_argument("--max_risk_discuss_rounds", type=int, default=1)
    parser.add_argument("--mode", default="fast", choices=["fast", "standard"])
    parser.add_argument("--analysts", default="")
    parser.add_argument("--openai_retries", type=int, default=3)
    parser.add_argument("--openai_retry_base_seconds", type=int, default=6)
    parser.add_argument("--timeout_seconds", type=int, default=0)
    args = parser.parse_args()

    trade_date = (args.date or "").strip() or _default_trade_date()
    symbol = args.symbol.strip().upper()

    if not os.environ.get("OPENAI_API_KEY"):
        print(json.dumps({"ok": False, "error": "OPENAI_API_KEY 未设置"}, ensure_ascii=False))
        return 2

    from tradingagents.graph.trading_graph import TradingAgentsGraph
    from tradingagents.default_config import DEFAULT_CONFIG
    _install_local_vendor_and_fallbacks()

    base_config = dict(DEFAULT_CONFIG)
    base_config["llm_provider"] = "openai"
    base_config["backend_url"] = args.base_url
    base_config["deep_think_llm"] = args.deep_model
    base_config["quick_think_llm"] = args.quick_model
    base_config["openai_temperature"] = 0
    base_config["openai_seed"] = 42
    base_config["max_debate_rounds"] = int(args.max_debate_rounds)
    base_config["max_risk_discuss_rounds"] = int(args.max_risk_discuss_rounds)
    base_config["output_language"] = args.language
    base_config["results_dir"] = os.path.abspath(os.path.join(os.getcwd(), "results", "tradingagents"))

    selected_analysts = _parse_csv_list(args.analysts)
    if not selected_analysts:
        selected_analysts = ["market"] if args.mode == "fast" else ["market", "social", "news", "fundamentals"]

    if args.mode == "fast":
        base_config["deep_think_llm"] = args.quick_model
        if _supports_reasoning_effort(base_config.get("deep_think_llm")) or _supports_reasoning_effort(base_config.get("quick_think_llm")):
            base_config["openai_reasoning_effort"] = "low"
        else:
            base_config["openai_reasoning_effort"] = None

    def run_once(vendor_map):
        cfg = dict(base_config)
        cfg["data_vendors"] = dict(vendor_map)
        ta = TradingAgentsGraph(selected_analysts=selected_analysts, debug=False, config=cfg)

        attempts = max(1, int(args.openai_retries))
        last_err = None
        for i in range(attempts):
            try:
                state, decision = ta.propagate(symbol, trade_date)
                return state, decision
            except Exception as e:
                last_err = e
                if _is_rate_limit_error(str(e)) and i < attempts - 1:
                    sleep_s = int(args.openai_retry_base_seconds) * (2 ** i)
                    time.sleep(sleep_s)
                    continue
                raise

    if args.mode == "fast":
        vendor_map = {
            "core_stock_apis": "local,yfinance,alpha_vantage",
            "technical_indicators": "local,yfinance,alpha_vantage",
            "fundamental_data": "yfinance,alpha_vantage",
            "news_data": "yfinance,alpha_vantage",
        }
    else:
        vendor_map = {
            "core_stock_apis": "local,yfinance,alpha_vantage",
            "technical_indicators": "local,yfinance,alpha_vantage",
            "fundamental_data": "yfinance,alpha_vantage",
            "news_data": "yfinance,alpha_vantage",
        }

    used_vendor = vendor_map.get("core_stock_apis")
    try:
        state, decision = run_once(vendor_map)
    except Exception as e:
        msg = str(e)
        has_alpha = bool(os.environ.get("ALPHA_VANTAGE_API_KEY"))
        print(json.dumps({"ok": False, "error": msg, "can_fallback_alpha_vantage": has_alpha}, ensure_ascii=False))
        return 1

    report_sections = [
        ("市场分析", state.get("market_report")),
        ("情绪分析", state.get("sentiment_report")),
        ("新闻分析", state.get("news_report")),
        ("基本面分析", state.get("fundamentals_report")),
        ("交易计划", state.get("investment_plan")),
        ("最终决策", state.get("final_trade_decision")),
    ]

    md = []
    md.append(f"## TradingAgents 多智能体股票分析报告")
    md.append(f"- 标的：**{symbol}**")
    md.append(f"- 分析日期：**{trade_date}**")
    md.append(f"- 数据源：**{used_vendor}**")
    md.append("")
    for title, content in report_sections:
        if not content:
            continue
        md.append(f"### {title}")
        md.append(str(content).strip())
        md.append("")

    out = {
        "ok": True,
        "symbol": symbol,
        "trade_date": trade_date,
        "data_vendor": used_vendor,
        "decision": decision,
        "report_markdown": "\n".join(md).strip(),
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
