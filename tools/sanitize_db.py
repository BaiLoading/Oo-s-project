import os
import sqlite3
import sys


ROOT = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.join(ROOT, "strategy_db.sqlite3")


def _exec(cur, sql):
    try:
        cur.execute(sql)
        return True
    except Exception:
        return False


def main():
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)
    c = sqlite3.connect(DB_PATH)
    cur = c.cursor()

    for table in [
        "futu_trade_log",
        "paper_trades",
        "paper_orders",
        "paper_positions",
        "paper_accounts",
        "trade_table",
        "backtest_table",
    ]:
        _exec(cur, f"DELETE FROM {table}")

    c.commit()
    c.close()

    import strategy_store
    from strategy_builtin import builtin_strategies

    strategy_store.upsert_builtin(builtin_strategies())


if __name__ == "__main__":
    main()
