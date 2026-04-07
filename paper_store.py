import json
import os
import sqlite3
from datetime import datetime


def _db_path():
    env = (os.environ.get("PAPER_DB_PATH") or "").strip()
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
    CREATE TABLE IF NOT EXISTS paper_accounts (
        user_id TEXT PRIMARY KEY,
        currency TEXT NOT NULL DEFAULT 'USD',
        initial_cash REAL NOT NULL DEFAULT 100000,
        cash REAL NOT NULL DEFAULT 100000,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS paper_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        limit_price REAL NOT NULL,
        quantity REAL NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        filled_at TEXT NOT NULL DEFAULT '',
        filled_price REAL NOT NULL DEFAULT 0
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS paper_positions (
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        avg_cost REAL NOT NULL,
        quantity REAL NOT NULL,
        last_price REAL NOT NULL DEFAULT 0,
        unrealized_pnl REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, symbol)
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS paper_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        order_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        price REAL NOT NULL,
        quantity REAL NOT NULL,
        pnl REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)
    c.commit()
    c.close()


def ensure_account(user_id, initial_cash=100000):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT user_id FROM paper_accounts WHERE user_id=?", (user_id,))
    row = cur.fetchone()
    if row:
        c.close()
        return
    now = datetime.now().isoformat()
    cur.execute(
        "INSERT INTO paper_accounts (user_id, currency, initial_cash, cash, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (user_id, "USD", float(initial_cash), float(initial_cash), now, now),
    )
    c.commit()
    c.close()


def reset_account(user_id, initial_cash):
    init_db()
    now = datetime.now().isoformat()
    c = _conn()
    cur = c.cursor()
    cur.execute("DELETE FROM paper_orders WHERE user_id=?", (user_id,))
    cur.execute("DELETE FROM paper_positions WHERE user_id=?", (user_id,))
    cur.execute("DELETE FROM paper_trades WHERE user_id=?", (user_id,))
    cur.execute("DELETE FROM paper_accounts WHERE user_id=?", (user_id,))
    cur.execute(
        "INSERT INTO paper_accounts (user_id, currency, initial_cash, cash, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (user_id, "USD", float(initial_cash), float(initial_cash), now, now),
    )
    c.commit()
    c.close()


def get_account(user_id):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM paper_accounts WHERE user_id=?", (user_id,))
    r = cur.fetchone()
    c.close()
    if not r:
        return None
    return dict(r)


def list_positions(user_id):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM paper_positions WHERE user_id=? ORDER BY symbol ASC", (user_id,))
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def list_orders(user_id, status=""):
    init_db()
    c = _conn()
    cur = c.cursor()
    if status:
        cur.execute("SELECT * FROM paper_orders WHERE user_id=? AND status=? ORDER BY id DESC", (user_id, status))
    else:
        cur.execute("SELECT * FROM paper_orders WHERE user_id=? ORDER BY id DESC", (user_id,))
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def list_trades(user_id, limit=50):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM paper_trades WHERE user_id=? ORDER BY id DESC LIMIT ?", (user_id, int(limit)))
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def _reserved_sell_qty(cur, user_id, symbol):
    cur.execute(
        "SELECT COALESCE(SUM(quantity),0) as qty FROM paper_orders WHERE user_id=? AND symbol=? AND side='sell' AND status='pending'",
        (user_id, symbol),
    )
    return float(cur.fetchone()["qty"])


def create_order(user_id, symbol, side, limit_price, quantity):
    init_db()
    now = datetime.now().isoformat()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT cash FROM paper_accounts WHERE user_id=?", (user_id,))
    acc = cur.fetchone()
    if not acc:
        c.close()
        raise RuntimeError("account not found")
    cash = float(acc["cash"])
    if side == "buy":
        need = float(limit_price) * float(quantity)
        if need > cash + 1e-9:
            c.close()
            raise RuntimeError("insufficient cash")
    else:
        cur.execute("SELECT quantity FROM paper_positions WHERE user_id=? AND symbol=?", (user_id, symbol))
        pos = cur.fetchone()
        have = float(pos["quantity"]) if pos else 0.0
        reserved = _reserved_sell_qty(cur, user_id, symbol)
        if float(quantity) > have - reserved + 1e-9:
            c.close()
            raise RuntimeError("insufficient shares")

    cur.execute(
        "INSERT INTO paper_orders (user_id, symbol, side, limit_price, quantity, status, created_at) VALUES (?,?,?,?,?,?,?)",
        (user_id, symbol, side, float(limit_price), float(quantity), "pending", now),
    )
    oid = cur.lastrowid
    c.commit()
    c.close()
    return int(oid)


def cancel_order(user_id, order_id):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT status FROM paper_orders WHERE id=? AND user_id=?", (int(order_id), user_id))
    r = cur.fetchone()
    if not r:
        c.close()
        return False
    if r["status"] != "pending":
        c.close()
        return False
    cur.execute("UPDATE paper_orders SET status='cancelled' WHERE id=? AND user_id=?", (int(order_id), user_id))
    c.commit()
    c.close()
    return True


def _update_position_on_buy(cur, user_id, symbol, fill_price, quantity):
    cur.execute("SELECT avg_cost, quantity FROM paper_positions WHERE user_id=? AND symbol=?", (user_id, symbol))
    r = cur.fetchone()
    now = datetime.now().isoformat()
    if not r:
        cur.execute(
            "INSERT INTO paper_positions (user_id, symbol, avg_cost, quantity, last_price, unrealized_pnl, updated_at) VALUES (?,?,?,?,?,?,?)",
            (user_id, symbol, float(fill_price), float(quantity), float(fill_price), 0.0, now),
        )
        return
    old_qty = float(r["quantity"])
    old_cost = float(r["avg_cost"])
    new_qty = old_qty + float(quantity)
    new_cost = (old_cost * old_qty + float(fill_price) * float(quantity)) / max(1e-12, new_qty)
    cur.execute(
        "UPDATE paper_positions SET avg_cost=?, quantity=?, last_price=?, updated_at=? WHERE user_id=? AND symbol=?",
        (float(new_cost), float(new_qty), float(fill_price), now, user_id, symbol),
    )


def _update_position_on_sell(cur, user_id, symbol, fill_price, quantity):
    cur.execute("SELECT avg_cost, quantity FROM paper_positions WHERE user_id=? AND symbol=?", (user_id, symbol))
    r = cur.fetchone()
    if not r:
        raise RuntimeError("no position")
    old_qty = float(r["quantity"])
    if float(quantity) > old_qty + 1e-9:
        raise RuntimeError("insufficient shares")
    new_qty = old_qty - float(quantity)
    now = datetime.now().isoformat()
    if new_qty <= 1e-9:
        cur.execute("DELETE FROM paper_positions WHERE user_id=? AND symbol=?", (user_id, symbol))
    else:
        cur.execute(
            "UPDATE paper_positions SET quantity=?, last_price=?, updated_at=? WHERE user_id=? AND symbol=?",
            (float(new_qty), float(fill_price), now, user_id, symbol),
        )
    return float(r["avg_cost"])


def fill_orders(user_id, quotes_by_symbol):
    init_db()
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM paper_orders WHERE user_id=? AND status='pending' ORDER BY id ASC", (user_id,))
    pending = [dict(r) for r in cur.fetchall()]
    if not pending:
        c.close()
        return []

    cur.execute("SELECT cash FROM paper_accounts WHERE user_id=?", (user_id,))
    acc = cur.fetchone()
    if not acc:
        c.close()
        raise RuntimeError("account not found")
    cash = float(acc["cash"])

    filled = []
    now = datetime.now().isoformat()
    for o in pending:
        sym = o["symbol"]
        q = quotes_by_symbol.get(sym)
        if not q:
            continue
        market = float(q.get("price") or 0)
        if market <= 0:
            continue
        side = o["side"]
        limit_price = float(o["limit_price"])
        qty = float(o["quantity"])

        can_fill = (side == "buy" and market <= limit_price + 1e-9) or (side == "sell" and market >= limit_price - 1e-9)
        if not can_fill:
            continue

        fill_price = market
        if side == "buy":
            cost = fill_price * qty
            if cost > cash + 1e-9:
                continue
            cash -= cost
            _update_position_on_buy(cur, user_id, sym, fill_price, qty)
            pnl = 0.0
        else:
            avg_cost = _update_position_on_sell(cur, user_id, sym, fill_price, qty)
            cash += fill_price * qty
            pnl = (fill_price - avg_cost) * qty

        cur.execute(
            "UPDATE paper_orders SET status='filled', filled_at=?, filled_price=? WHERE id=? AND user_id=?",
            (now, float(fill_price), int(o["id"]), user_id),
        )
        cur.execute(
            "INSERT INTO paper_trades (user_id, order_id, symbol, side, price, quantity, pnl, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (user_id, int(o["id"]), sym, side, float(fill_price), float(qty), float(pnl), now),
        )
        filled.append({**o, "filled_at": now, "filled_price": float(fill_price), "pnl": float(pnl)})

    cur.execute("UPDATE paper_accounts SET cash=?, updated_at=? WHERE user_id=?", (float(cash), now, user_id))
    c.commit()
    c.close()
    return filled


def update_positions_prices(user_id, quotes_by_symbol):
    init_db()
    c = _conn()
    cur = c.cursor()
    now = datetime.now().isoformat()
    cur.execute("SELECT symbol, avg_cost, quantity FROM paper_positions WHERE user_id=?", (user_id,))
    rows = cur.fetchall()
    for r in rows:
        sym = r["symbol"]
        q = quotes_by_symbol.get(sym)
        if not q:
            continue
        px = float(q.get("price") or 0)
        if px <= 0:
            continue
        avg_cost = float(r["avg_cost"])
        qty = float(r["quantity"])
        upl = (px - avg_cost) * qty
        cur.execute(
            "UPDATE paper_positions SET last_price=?, unrealized_pnl=?, updated_at=? WHERE user_id=? AND symbol=?",
            (float(px), float(upl), now, user_id, sym),
        )
    c.commit()
    c.close()

