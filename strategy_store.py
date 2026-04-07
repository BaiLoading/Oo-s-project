import json
import os
import sqlite3
import tempfile
import time
from datetime import datetime


_DB_PATH = None


def _db_path():
    global _DB_PATH
    if _DB_PATH:
        return _DB_PATH
    env = (os.environ.get("STRATEGY_DB_PATH") or "").strip()
    if env:
        _DB_PATH = env
        return _DB_PATH
    preferred = os.path.join(os.path.dirname(__file__), "strategy_db.sqlite3")
    try:
        base_dir = os.path.dirname(preferred) or "."
        if os.access(base_dir, os.W_OK):
            _DB_PATH = preferred
            return _DB_PATH
    except Exception:
        pass
    _DB_PATH = os.path.join(tempfile.gettempdir(), "strategy_db.sqlite3")
    return _DB_PATH


def _conn():
    c = sqlite3.connect(_db_path())
    c.row_factory = sqlite3.Row
    return c


def init_db():
    c = _conn()
    cur = c.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS strategy_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        code TEXT NOT NULL,
        params TEXT NOT NULL,
        tags TEXT NOT NULL,
        type TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS backtest_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id INTEGER NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        strategy_name TEXT NOT NULL DEFAULT '',
        symbols TEXT NOT NULL DEFAULT '[]',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        initial_capital REAL NOT NULL DEFAULT 0,
        final_capital REAL NOT NULL DEFAULT 0,
        total_return REAL NOT NULL DEFAULT 0,
        annualized_return REAL NOT NULL DEFAULT 0,
        max_drawdown REAL NOT NULL DEFAULT 0,
        sharpe_ratio REAL NOT NULL DEFAULT 0,
        win_rate REAL NOT NULL DEFAULT 0,
        params TEXT NOT NULL,
        metrics TEXT NOT NULL,
        result TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'done',
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT '',
        runtime_seconds REAL NOT NULL DEFAULT 0
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS trade_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backtest_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        buy_time TEXT NOT NULL,
        buy_price REAL NOT NULL,
        sell_time TEXT NOT NULL,
        sell_price REAL NOT NULL,
        position_size REAL NOT NULL,
        pnl REAL NOT NULL,
        pnl_ratio REAL NOT NULL,
        signal_reason TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    cur.execute("PRAGMA table_info(backtest_table)")
    cols = {r[1] for r in cur.fetchall()}
    alters = []
    for name, ddl in [
        ("name", "ALTER TABLE backtest_table ADD COLUMN name TEXT NOT NULL DEFAULT ''"),
        ("strategy_name", "ALTER TABLE backtest_table ADD COLUMN strategy_name TEXT NOT NULL DEFAULT ''"),
        ("symbols", "ALTER TABLE backtest_table ADD COLUMN symbols TEXT NOT NULL DEFAULT '[]'"),
        ("initial_capital", "ALTER TABLE backtest_table ADD COLUMN initial_capital REAL NOT NULL DEFAULT 0"),
        ("final_capital", "ALTER TABLE backtest_table ADD COLUMN final_capital REAL NOT NULL DEFAULT 0"),
        ("total_return", "ALTER TABLE backtest_table ADD COLUMN total_return REAL NOT NULL DEFAULT 0"),
        ("annualized_return", "ALTER TABLE backtest_table ADD COLUMN annualized_return REAL NOT NULL DEFAULT 0"),
        ("max_drawdown", "ALTER TABLE backtest_table ADD COLUMN max_drawdown REAL NOT NULL DEFAULT 0"),
        ("sharpe_ratio", "ALTER TABLE backtest_table ADD COLUMN sharpe_ratio REAL NOT NULL DEFAULT 0"),
        ("win_rate", "ALTER TABLE backtest_table ADD COLUMN win_rate REAL NOT NULL DEFAULT 0"),
        ("result", "ALTER TABLE backtest_table ADD COLUMN result TEXT NOT NULL DEFAULT ''"),
        ("status", "ALTER TABLE backtest_table ADD COLUMN status TEXT NOT NULL DEFAULT 'done'"),
        ("error", "ALTER TABLE backtest_table ADD COLUMN error TEXT NOT NULL DEFAULT ''"),
        ("updated_at", "ALTER TABLE backtest_table ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"),
        ("runtime_seconds", "ALTER TABLE backtest_table ADD COLUMN runtime_seconds REAL NOT NULL DEFAULT 0"),
    ]:
        if name not in cols:
            alters.append(ddl)
    for sql in alters:
        try:
            cur.execute(sql)
        except Exception:
            pass
    c.commit()
    c.close()


def upsert_builtin(strategies):
    init_db()
    c = _conn()
    cur = c.cursor()
    now = datetime.now().isoformat()
    for s in strategies:
        name = s.get("name") or ""
        if not name:
            continue
        cur.execute("SELECT id, code, params, tags, description, type FROM strategy_table WHERE name=? AND is_builtin=1", (name,))
        row = cur.fetchone()
        payload = (
            s.get("description") or "",
            s.get("code") or "",
            json.dumps(s.get("params") or {}, ensure_ascii=False),
            json.dumps(s.get("tags") or [], ensure_ascii=False),
            s.get("type") or "",
        )
        if row:
            cur.execute(
                "UPDATE strategy_table SET description=?, code=?, params=?, tags=?, type=?, updated_at=? WHERE id=?",
                (*payload, now, int(row["id"])),
            )
        else:
            cur.execute(
                "INSERT INTO strategy_table (name, description, code, params, tags, type, is_builtin, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?)",
                (name, *payload, now, now),
            )
    c.commit()
    c.close()


def list_strategies(query="", tag="", type_name="", builtin=None, page=1, page_size=20):
    init_db()
    page = max(int(page or 1), 1)
    page_size = max(min(int(page_size or 20), 100), 1)
    where = []
    params = []
    if query:
        where.append("(name LIKE ? OR description LIKE ?)")
        q = f"%{query}%"
        params += [q, q]
    if type_name:
        where.append("type = ?")
        params.append(type_name)
    if builtin is not None:
        where.append("is_builtin = ?")
        params.append(1 if builtin else 0)
    sql = "SELECT id, name, description, tags, type, is_builtin, created_at, updated_at FROM strategy_table"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY is_builtin DESC, updated_at DESC"
    c = _conn()
    cur = c.cursor()
    cur.execute(f"SELECT COUNT(1) as cnt FROM ({sql})", params)
    total = int(cur.fetchone()["cnt"])
    offset = (page - 1) * page_size
    cur.execute(sql + " LIMIT ? OFFSET ?", params + [page_size, offset])
    rows = []
    for r in cur.fetchall():
        tags = []
        try:
            tags = json.loads(r["tags"] or "[]") or []
        except Exception:
            tags = []
        if tag and tag not in tags:
            continue
        rows.append({
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "tags": tags,
            "type": r["type"],
            "is_builtin": bool(r["is_builtin"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        })
    c.close()
    if tag:
        total = len(rows)
        start = (page - 1) * page_size
        rows = rows[start:start + page_size]
    return {"items": rows, "total": total, "page": page, "page_size": page_size}


def get_strategy(sid):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM strategy_table WHERE id=?", (int(sid),))
    r = cur.fetchone()
    c.close()
    if not r:
        return None
    try:
        params = json.loads(r["params"] or "{}") or {}
    except Exception:
        params = {}
    try:
        tags = json.loads(r["tags"] or "[]") or []
    except Exception:
        tags = []
    return {
        "id": r["id"],
        "name": r["name"],
        "description": r["description"],
        "code": r["code"],
        "params": params,
        "tags": tags,
        "type": r["type"],
        "is_builtin": bool(r["is_builtin"]),
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


def create_strategy(name, description, code, params, tags, type_name):
    init_db()
    c = _conn()
    cur = c.cursor()
    now = datetime.now().isoformat()
    cur.execute(
        "INSERT INTO strategy_table (name, description, code, params, tags, type, is_builtin, created_at, updated_at) VALUES (?,?,?,?,?,?,0,?,?)",
        (
            name,
            description,
            code,
            json.dumps(params or {}, ensure_ascii=False),
            json.dumps(tags or [], ensure_ascii=False),
            type_name or "",
            now,
            now,
        ),
    )
    sid = cur.lastrowid
    c.commit()
    c.close()
    return int(sid)


def update_strategy(sid, name, description, code, params, tags, type_name):
    init_db()
    c = _conn()
    cur = c.cursor()
    now = datetime.now().isoformat()
    cur.execute("SELECT is_builtin FROM strategy_table WHERE id=?", (int(sid),))
    row = cur.fetchone()
    if not row:
        c.close()
        return False
    if int(row["is_builtin"]) == 1:
        c.close()
        return False
    cur.execute(
        "UPDATE strategy_table SET name=?, description=?, code=?, params=?, tags=?, type=?, updated_at=? WHERE id=?",
        (
            name,
            description,
            code,
            json.dumps(params or {}, ensure_ascii=False),
            json.dumps(tags or [], ensure_ascii=False),
            type_name or "",
            now,
            int(sid),
        ),
    )
    c.commit()
    c.close()
    return True


def delete_strategy(sid):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT is_builtin FROM strategy_table WHERE id=?", (int(sid),))
    row = cur.fetchone()
    if not row:
        c.close()
        return False
    if int(row["is_builtin"]) == 1:
        c.close()
        return False
    cur.execute("DELETE FROM strategy_table WHERE id=?", (int(sid),))
    c.commit()
    c.close()
    return True


def create_backtest_run(strategy_id, strategy_name, symbols, start_date, end_date, initial_capital, params, name=""):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("PRAGMA table_info(backtest_table)")
    cols = {r[1] for r in cur.fetchall()}
    now = datetime.now().isoformat()
    symbols_json = json.dumps(symbols or [], ensure_ascii=False)
    if not name:
        sym_label = "/".join((symbols or [])[:3])
        name = f"{strategy_name or '策略'} · {sym_label} · {start_date}~{end_date}"
    insert_cols = [
        "strategy_id", "name", "strategy_name", "symbols",
        "start_date", "end_date",
        "initial_capital", "final_capital",
        "total_return", "annualized_return", "max_drawdown", "sharpe_ratio", "win_rate",
        "params", "metrics", "result", "status", "error", "created_at", "updated_at", "runtime_seconds"
    ]
    insert_vals = [
        int(strategy_id),
        name,
        strategy_name or "",
        symbols_json,
        start_date,
        end_date,
        float(initial_capital),
        float(initial_capital),
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        json.dumps(params or {}, ensure_ascii=False),
        json.dumps({}, ensure_ascii=False),
        "",
        "running",
        "",
        now,
        now,
        0.0,
    ]
    if "symbol" in cols:
        insert_cols.insert(4, "symbol")
        insert_vals.insert(4, (symbols or [""])[0])
    if "initial_cash" in cols:
        insert_cols.insert(9 if "symbol" in cols else 8, "initial_cash")
        insert_vals.insert(9 if "symbol" in cols else 8, float(initial_capital))

    placeholders = ",".join(["?"] * len(insert_cols))
    sql = f"INSERT INTO backtest_table ({', '.join(insert_cols)}) VALUES ({placeholders})"
    cur.execute(sql, tuple(insert_vals))
    bid = cur.lastrowid
    c.commit()
    c.close()
    return int(bid)


def finish_backtest_run(backtest_id, status, metrics=None, result=None, error="", runtime_seconds=0):
    init_db()
    c = _conn()
    cur = c.cursor()
    now = datetime.now().isoformat()
    m = metrics or {}
    final_capital = float(m.get("final_capital") or 0)
    total_return = float(m.get("total_return") or 0)
    annualized_return = float(m.get("annualized_return") or 0)
    max_drawdown = float(m.get("max_drawdown") or 0)
    sharpe_ratio = float(m.get("sharpe") or m.get("sharpe_ratio") or 0)
    win_rate = float(m.get("win_rate") or 0)
    cur.execute(
        "UPDATE backtest_table SET status=?, metrics=?, result=?, error=?, updated_at=?, runtime_seconds=?, final_capital=?, total_return=?, annualized_return=?, max_drawdown=?, sharpe_ratio=?, win_rate=? WHERE id=?",
        (
            status,
            json.dumps(metrics or {}, ensure_ascii=False),
            json.dumps(result or {}, ensure_ascii=False),
            error or "",
            now,
            float(runtime_seconds or 0),
            final_capital,
            total_return,
            annualized_return,
            max_drawdown,
            sharpe_ratio,
            win_rate,
            int(backtest_id),
        ),
    )
    c.commit()
    c.close()


def replace_trades(backtest_id, trades):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("DELETE FROM trade_table WHERE backtest_id=?", (int(backtest_id),))
    now = datetime.now().isoformat()
    for t in (trades or []):
        cur.execute(
            "INSERT INTO trade_table (backtest_id, symbol, buy_time, buy_price, sell_time, sell_price, position_size, pnl, pnl_ratio, signal_reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                int(backtest_id),
                str(t.get("symbol") or ""),
                str(t.get("buy_time") or ""),
                float(t.get("buy_price") or 0),
                str(t.get("sell_time") or ""),
                float(t.get("sell_price") or 0),
                float(t.get("position_size") or 0),
                float(t.get("pnl") or 0),
                float(t.get("pnl_ratio") or 0),
                str(t.get("signal_reason") or ""),
                now,
            ),
        )
    c.commit()
    c.close()


def create_backtest_log(strategy_id, symbol, start_date, end_date, initial_cash, params, metrics, runtime_seconds):
    bid = create_backtest_run(strategy_id, "", [symbol], start_date, end_date, initial_cash, params, name="")
    finish_backtest_run(bid, "done", metrics=metrics, result={}, error="", runtime_seconds=runtime_seconds)
    return int(bid)


def list_backtests(strategy_id, limit=20):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute(
        "SELECT id, strategy_id, name, symbols, start_date, end_date, initial_capital, metrics, created_at, runtime_seconds, status FROM backtest_table WHERE strategy_id=? ORDER BY id DESC LIMIT ?",
        (int(strategy_id), int(limit)),
    )
    out = []
    for r in cur.fetchall():
        try:
            metrics = json.loads(r["metrics"] or "{}") or {}
        except Exception:
            metrics = {}
        try:
            symbols = json.loads(r["symbols"] or "[]") or []
        except Exception:
            symbols = []
        out.append({
            "id": r["id"],
            "strategy_id": r["strategy_id"],
            "name": r["name"],
            "symbols": symbols,
            "start_date": r["start_date"],
            "end_date": r["end_date"],
            "initial_capital": r["initial_capital"],
            "metrics": metrics,
            "created_at": r["created_at"],
            "runtime_seconds": r["runtime_seconds"],
            "status": r["status"],
        })
    c.close()
    return out


def list_backtest_runs(page=1, page_size=20, status="", strategy_id="", symbol="", start_date="", end_date=""):
    init_db()
    page = max(int(page or 1), 1)
    page_size = max(min(int(page_size or 20), 100), 1)
    where = []
    params = []
    if status:
        where.append("status = ?")
        params.append(status)
    if strategy_id:
        where.append("strategy_id = ?")
        params.append(int(strategy_id))
    if symbol:
        where.append("symbols LIKE ?")
        params.append(f"%\"{symbol}\"%")
    if start_date:
        where.append("start_date >= ?")
        params.append(start_date)
    if end_date:
        where.append("end_date <= ?")
        params.append(end_date)
    sql = "SELECT id, name, strategy_id, strategy_name, symbols, start_date, end_date, initial_capital, final_capital, total_return, max_drawdown, status, created_at, updated_at, runtime_seconds FROM backtest_table"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY id DESC"
    c = _conn()
    cur = c.cursor()
    cur.execute(f"SELECT COUNT(1) as cnt FROM ({sql})", params)
    total = int(cur.fetchone()["cnt"])
    offset = (page - 1) * page_size
    cur.execute(sql + " LIMIT ? OFFSET ?", params + [page_size, offset])
    items = []
    for r in cur.fetchall():
        items.append({
            "id": r["id"],
            "name": r["name"],
            "strategy_id": r["strategy_id"],
            "strategy_name": r["strategy_name"],
            "symbols": json.loads(r["symbols"] or "[]") if "symbols" in r.keys() else [],
            "start_date": r["start_date"],
            "end_date": r["end_date"],
            "initial_capital": r["initial_capital"],
            "final_capital": r["final_capital"],
            "total_return": r["total_return"],
            "max_drawdown": r["max_drawdown"],
            "status": r["status"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "runtime_seconds": r["runtime_seconds"],
        })
    c.close()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_backtest_run(backtest_id):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM backtest_table WHERE id=?", (int(backtest_id),))
    r = cur.fetchone()
    c.close()
    if not r:
        return None
    try:
        params = json.loads(r["params"] or "{}") or {}
    except Exception:
        params = {}
    try:
        metrics = json.loads(r["metrics"] or "{}") or {}
    except Exception:
        metrics = {}
    try:
        result = json.loads(r["result"] or "{}") or {}
    except Exception:
        result = {}
    return {
        "id": r["id"],
        "name": r["name"] if "name" in r.keys() else "",
        "strategy_id": r["strategy_id"],
        "strategy_name": r["strategy_name"],
        "symbols": json.loads(r["symbols"] or "[]") if "symbols" in r.keys() else [r["symbol"]] if "symbol" in r.keys() else [],
        "start_date": r["start_date"],
        "end_date": r["end_date"],
        "initial_capital": r["initial_capital"] if "initial_capital" in r.keys() else r["initial_cash"] if "initial_cash" in r.keys() else 0,
        "final_capital": r["final_capital"] if "final_capital" in r.keys() else 0,
        "total_return": r["total_return"] if "total_return" in r.keys() else 0,
        "annualized_return": r["annualized_return"] if "annualized_return" in r.keys() else 0,
        "max_drawdown": r["max_drawdown"] if "max_drawdown" in r.keys() else 0,
        "sharpe_ratio": r["sharpe_ratio"] if "sharpe_ratio" in r.keys() else 0,
        "win_rate": r["win_rate"] if "win_rate" in r.keys() else 0,
        "params": params,
        "metrics": metrics,
        "result": result,
        "status": r["status"],
        "error": r["error"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
        "runtime_seconds": r["runtime_seconds"],
    }


def list_trades(backtest_id, symbol=""):
    init_db()
    c = _conn()
    cur = c.cursor()
    if symbol:
        cur.execute("SELECT * FROM trade_table WHERE backtest_id=? AND symbol=? ORDER BY buy_time ASC, id ASC", (int(backtest_id), symbol))
    else:
        cur.execute("SELECT * FROM trade_table WHERE backtest_id=? ORDER BY buy_time ASC, id ASC", (int(backtest_id),))
    out = []
    for r in cur.fetchall():
        out.append({
            "id": r["id"],
            "backtest_id": r["backtest_id"],
            "symbol": r["symbol"],
            "buy_time": r["buy_time"],
            "buy_price": r["buy_price"],
            "sell_time": r["sell_time"],
            "sell_price": r["sell_price"],
            "position_size": r["position_size"],
            "pnl": r["pnl"],
            "pnl_ratio": r["pnl_ratio"],
            "signal_reason": r["signal_reason"],
            "created_at": r["created_at"],
        })
    c.close()
    return out
