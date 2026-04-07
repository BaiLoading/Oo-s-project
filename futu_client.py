import os
import threading
from datetime import datetime


class FutuNotReadyError(RuntimeError):
    pass


def _import_futu():
    original_home = os.environ.get("HOME", "")
    runtime_home = (os.environ.get("FUTU_PY_HOME") or "").strip()
    if not runtime_home:
        runtime_home = os.path.join(os.path.dirname(__file__), ".futu_runtime")
    try:
        os.makedirs(runtime_home, exist_ok=True)
    except Exception:
        runtime_home = "/tmp"
        try:
            os.makedirs(runtime_home, exist_ok=True)
        except Exception:
            pass

    try:
        os.environ["HOME"] = runtime_home
    except Exception:
        pass
    try:
        from futu import (
            OpenQuoteContext,
            OpenSecTradeContext,
            RET_OK,
            SecurityFirm,
            TrdSide,
        )
        return {
            "OpenQuoteContext": OpenQuoteContext,
            "OpenSecTradeContext": OpenSecTradeContext,
            "RET_OK": RET_OK,
            "SecurityFirm": SecurityFirm,
            "TrdSide": TrdSide,
        }
    except Exception as e:
        raise FutuNotReadyError(f"futu-api 未安装或不可用: {e}")
    finally:
        if original_home:
            os.environ["HOME"] = original_home


class FutuClient:
    def __init__(self):
        self._lock = threading.Lock()
        self._quote = None
        self._trade_sim_by_market = {}
        self._trade_real_by_market = {}
        self._last_error = ""
        self._host = ""
        self._port = 0

    def connect(self, host, port):
        futu = _import_futu()
        host = (host or "").strip() or "127.0.0.1"
        port = int(port or 11111)
        with self._lock:
            self._close_all()
            self._host = host
            self._port = port
            self._quote = futu["OpenQuoteContext"](host=host, port=port)
            self._trade_sim_by_market = {
                "US": futu["OpenSecTradeContext"](filter_trdmarket="US", host=host, port=port, security_firm=futu["SecurityFirm"].FUTUSECURITIES),
                "HK": futu["OpenSecTradeContext"](filter_trdmarket="HK", host=host, port=port, security_firm=futu["SecurityFirm"].FUTUSECURITIES),
            }
            self._trade_real_by_market = {
                "US": futu["OpenSecTradeContext"](filter_trdmarket="US", host=host, port=port, security_firm=futu["SecurityFirm"].FUTUSECURITIES),
                "HK": futu["OpenSecTradeContext"](filter_trdmarket="HK", host=host, port=port, security_firm=futu["SecurityFirm"].FUTUSECURITIES),
            }
        return {"host": host, "port": port}

    def _norm_code(self, code):
        s = (code or "").strip().upper()
        if not s:
            return ""
        if "." not in s:
            if s.isdigit() and len(s) == 5:
                return f"HK.{s}"
            if s.isdigit() and len(s) == 6:
                return f"SH.{s}" if s.startswith("6") else f"SZ.{s}"
            return f"US.{s}"
        return s

    def _norm_codes(self, symbols):
        out = []
        for s in (symbols or []):
            c = self._norm_code(s)
            if not c:
                continue
            if c not in out:
                out.append(c)
        return out

    def _close_all(self):
        for ctx in [self._quote, *list(self._trade_sim_by_market.values()), *list(self._trade_real_by_market.values())]:
            try:
                if ctx:
                    ctx.close()
            except Exception:
                pass
        self._quote = None
        self._trade_sim_by_market = {}
        self._trade_real_by_market = {}

    def status(self):
        with self._lock:
            ok = self._quote is not None
            return {
                "connected": ok,
                "host": self._host,
                "port": self._port,
                "last_error": self._last_error,
            }

    def _ctx(self):
        with self._lock:
            if not self._quote:
                raise FutuNotReadyError("OpenD 未连接（请先 connect）")
            return self._quote, dict(self._trade_sim_by_market), dict(self._trade_real_by_market)

    def unlock_trade(self, pwd, env):
        futu = _import_futu()
        env = (env or "SIMULATE").upper()
        quote, sim_by_market, real_by_market = self._ctx()
        ctx_by_market = sim_by_market if env == "SIMULATE" else real_by_market
        if env != "SIMULATE":
            if (os.environ.get("ENABLE_FUTU_REAL") or "").strip().lower() not in ["1", "true", "yes", "on"]:
                raise FutuNotReadyError("REAL 交易被禁用（设置 ENABLE_FUTU_REAL=1 才允许）")
        pwd = (pwd or "").strip()
        if not pwd:
            raise FutuNotReadyError("缺少解锁密码")
        last_err = ""
        for ctx in ctx_by_market.values():
            ret, data = ctx.unlock_trade(pwd)
            if ret != futu["RET_OK"]:
                last_err = str(data)
        if last_err:
            raise FutuNotReadyError(last_err)
        return True

    def acc_list(self, env):
        futu = _import_futu()
        env = (env or "SIMULATE").upper()
        quote, sim_by_market, real_by_market = self._ctx()
        ctx_by_market = sim_by_market if env == "SIMULATE" else real_by_market
        by_id = {}
        last_err = ""
        for mk, ctx in ctx_by_market.items():
            ret, data = ctx.get_acc_list()
            if ret != futu["RET_OK"]:
                last_err = str(data)
                continue
            for _, r in data.iterrows():
                acc_id = str(r.get("acc_id"))
                if not acc_id:
                    continue
                trd_env = str(r.get("trd_env") or "").upper()
                if trd_env and trd_env != env:
                    continue
                by_id.setdefault(acc_id, {
                    "acc_id": acc_id,
                    "trd_env": trd_env or env,
                    "trd_market": mk,
                })
        if not by_id and last_err:
            raise FutuNotReadyError(last_err)
        return list(by_id.values())

    def _market_for_account(self, env, acc_id):
        acc_id = str(acc_id).strip()
        if not acc_id:
            return ""
        try:
            items = self.acc_list(env)
            for it in items:
                if str(it.get("acc_id")) == acc_id:
                    m = (it.get("trd_market") or "").strip().upper()
                    if m in ["US", "HK"]:
                        return m
        except Exception:
            pass
        return ""

    def _trade_ctx(self, env, acc_id="", code=""):
        env = (env or "SIMULATE").upper()
        _, sim_by_market, real_by_market = self._ctx()
        ctx_by_market = sim_by_market if env == "SIMULATE" else real_by_market
        market = self._market_for_account(env, acc_id) or ((code or "").split(".", 1)[0].upper() if "." in (code or "") else "")
        if market in ctx_by_market:
            return ctx_by_market[market]
        return ctx_by_market.get("US") or ctx_by_market.get("HK") or next(iter(ctx_by_market.values()))

    def positions(self, env, acc_id):
        futu = _import_futu()
        env = (env or "SIMULATE").upper()
        ctx = self._trade_ctx(env, acc_id=acc_id)
        ret, data = ctx.position_list_query(trd_env=env, acc_id=int(acc_id))
        if ret != futu["RET_OK"]:
            raise FutuNotReadyError(str(data))
        out = []
        for _, r in data.iterrows():
            out.append({
                "symbol": str(r.get("code") or ""),
                "qty": float(r.get("qty") or 0),
                "cost_price": float(r.get("cost_price") or 0),
                "market_val": float(r.get("market_val") or 0),
                "pl_ratio": float(r.get("pl_ratio") or 0),
            })
        return out

    def quote_price(self, symbols):
        futu = _import_futu()
        quote, _, _ = self._ctx()
        codes = self._norm_codes(symbols)
        if not codes:
            return {}
        ret, data = quote.get_market_snapshot(codes)
        if ret != futu["RET_OK"]:
            raise FutuNotReadyError(str(data))
        out = {}
        for _, r in data.iterrows():
            code = str(r.get("code") or "")
            out[code] = {
                "symbol": code,
                "price": float(r.get("last_price") or 0),
                "change_percent": float(r.get("price_change_rate") or 0) * 100.0,
                "volume": float(r.get("volume") or 0),
                "time": str(r.get("update_time") or ""),
            }
        return out

    def history_kline(self, symbol, count=200, kline_type="K_DAY"):
        futu = _import_futu()
        quote, _, _ = self._ctx()
        code = self._norm_code(symbol)
        if not code:
            raise FutuNotReadyError("empty symbol")
        try:
            from futu import KLType, AuType
        except Exception:
            from futu import KLType, AuType
        kt = (kline_type or "K_DAY").strip().upper()
        kt_map = {
            "K_DAY": KLType.K_DAY,
            "K_1M": getattr(KLType, "K_1M", KLType.K_DAY),
            "K_3M": getattr(KLType, "K_3M", KLType.K_DAY),
            "K_5M": getattr(KLType, "K_5M", KLType.K_DAY),
            "K_15M": getattr(KLType, "K_15M", KLType.K_DAY),
            "K_30M": getattr(KLType, "K_30M", KLType.K_DAY),
            "K_60M": getattr(KLType, "K_60M", KLType.K_DAY),
        }
        ktype = kt_map.get(kt, KLType.K_DAY)
        res = quote.request_history_kline(code, ktype=ktype, autype=AuType.QFQ, max_count=int(count))
        if isinstance(res, tuple) and len(res) >= 2:
            ret, data = res[0], res[1]
        else:
            raise FutuNotReadyError("request_history_kline 返回格式异常")
        if ret != futu["RET_OK"]:
            raise FutuNotReadyError(str(data))
        rows = []
        for _, r in data.iterrows():
            rows.append({
                "date": str(r.get("time_key") or ""),
                "open": float(r.get("open") or 0),
                "high": float(r.get("high") or 0),
                "low": float(r.get("low") or 0),
                "close": float(r.get("close") or 0),
                "volume": float(r.get("volume") or 0),
            })
        return rows

    def normalize_symbol(self, symbol):
        return self._norm_code(symbol)

    def place_order(self, env, acc_id, symbol, side, quantity, limit_price):
        futu = _import_futu()
        env = (env or "SIMULATE").upper()
        code = self._norm_code(symbol)
        if not code:
            raise FutuNotReadyError("empty symbol")
        ctx = self._trade_ctx(env, acc_id=acc_id, code=code)
        side = (side or "").strip().lower()
        trd_side = futu["TrdSide"].BUY if side == "buy" else futu["TrdSide"].SELL
        ret, data = ctx.place_order(
            price=float(limit_price),
            qty=float(quantity),
            code=code,
            trd_side=trd_side,
            order_type="NORMAL",
            trd_env=env,
            acc_id=int(acc_id),
        )
        if ret != futu["RET_OK"]:
            raise FutuNotReadyError(str(data))
        try:
            order_id = str(data.iloc[0].get("order_id"))
        except Exception:
            order_id = ""
        return {"order_id": order_id, "time": datetime.now().isoformat()}


_singleton = FutuClient()


def get_futu_client():
    return _singleton
