import json
import os
import sqlite3
from datetime import datetime


def _db_path():
    env = (os.environ.get("FUTU_DB_PATH") or "").strip()
    if env:
        return env
    return os.path.join(os.path.dirname(__file__), "strategy_db.sqlite3")


def _conn():
    c = sqlite3.connect(_db_path())
    c.row_factory = sqlite3.Row
    return c


def init_db():
    c = _conn()
    cur = c.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS futu_trade_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        env TEXT NOT NULL,
        account_id TEXT NOT NULL,
        strategy_id INTEGER NOT NULL,
        strategy_name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        desired_position REAL NOT NULL,
        current_position REAL NOT NULL,
        order_id TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
    )
    """)
    c.commit()
    c.close()


def add_log(user_id, env, account_id, strategy_id, strategy_name, symbol, action, desired_position, current_position, order_id, status, message):
    init_db()
    c = _conn()
    cur = c.cursor()
    now = datetime.now().isoformat()
    cur.execute(
        "INSERT INTO futu_trade_log (user_id, env, account_id, strategy_id, strategy_name, symbol, action, desired_position, current_position, order_id, status, message, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            user_id,
            env,
            account_id,
            str(strategy_id),
            strategy_name or "",
            symbol or "",
            action or "",
            float(desired_position or 0),
            float(current_position or 0),
            str(order_id or ""),
            status or "",
            message or "",
            now,
        ),
    )
    rid = cur.lastrowid
    c.commit()
    c.close()
    return int(rid)


def list_logs(user_id, limit=100):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM futu_trade_log WHERE user_id=? ORDER BY id DESC LIMIT ?", (user_id, int(limit)))
    out = [dict(r) for r in cur.fetchall()]
    c.close()
    return out

