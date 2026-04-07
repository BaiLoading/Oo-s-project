import ast
import builtins
import json
import os
import sys
import time


def _fail(msg):
    sys.stdout.write(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
    return 1


def _limit_resources():
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
        try:
            resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
        except Exception:
            pass
    except Exception:
        pass


def _validate_code(code):
    try:
        tree = ast.parse(code)
    except Exception as e:
        return f"代码解析失败: {e}"

    allowed_imports = {"numpy", "pandas"}
    banned_names = {"open", "exec", "eval", "compile", "__import__", "input"}
    banned_attrs = {"system", "popen", "walk", "remove", "rmdir", "unlink", "kill", "fork", "spawn"}

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            mods = []
            if isinstance(node, ast.Import):
                mods = [n.name.split(".")[0] for n in node.names]
            else:
                if node.module:
                    mods = [node.module.split(".")[0]]
            for m in mods:
                if m not in allowed_imports:
                    return f"禁止导入模块: {m}"
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in banned_names:
                return f"禁止调用: {node.func.id}"
        if isinstance(node, ast.Attribute):
            if node.attr in banned_attrs:
                return f"禁止属性访问: {node.attr}"
        if isinstance(node, ast.Name):
            if node.id.startswith("__"):
                return f"禁止访问: {node.id}"
    return None


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    mod = (name or "").split(".", 1)[0]
    if mod not in {"numpy", "pandas"}:
        raise ImportError(f"禁止导入模块: {mod}")
    return builtins.__import__(name, globals, locals, fromlist, level)


def main():
    _limit_resources()
    t0 = time.time()
    raw = sys.stdin.read()
    if not raw:
        return _fail("Empty input")
    try:
        payload = json.loads(raw)
    except Exception as e:
        return _fail(f"Invalid JSON: {e}")

    code = payload.get("code") or ""
    params = payload.get("params") or {}
    data_path = payload.get("data_path") or ""

    if not code.strip():
        return _fail("Empty code")
    if not data_path or not os.path.exists(data_path):
        return _fail("Missing data file")

    err = _validate_code(code)
    if err:
        return _fail(err)

    try:
        import pandas as pd
        df = pd.read_csv(data_path)
    except Exception as e:
        return _fail(f"Load data failed: {e}")

    need_cols = {"open", "high", "low", "close", "volume"}
    cols = {c.lower() for c in df.columns}
    if "date" in cols:
        try:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")
            df = df.dropna(subset=["date"]).sort_values("date")
            df = df.set_index("date")
        except Exception:
            pass
    df.columns = [c.lower() for c in df.columns]
    if not need_cols.issubset(set(df.columns)):
        return _fail(f"Missing columns: {sorted(list(need_cols - set(df.columns)))}")

    safe_builtins = {
        "abs": abs,
        "min": min,
        "max": max,
        "sum": sum,
        "len": len,
        "range": range,
        "float": float,
        "int": int,
        "bool": bool,
        "dict": dict,
        "list": list,
        "set": set,
        "tuple": tuple,
        "enumerate": enumerate,
        "zip": zip,
        "Exception": Exception,
        "__import__": _safe_import,
    }

    scope = {"__builtins__": safe_builtins}
    try:
        exec(code, scope, scope)
    except Exception as e:
        return _fail(f"Exec failed: {e}")

    fn = scope.get("strategy")
    if not callable(fn):
        return _fail("未找到 strategy(df, params) 函数")

    try:
        pos = fn(df, params)
    except Exception as e:
        return _fail(f"Strategy run failed: {e}")

    try:
        import pandas as pd
        if isinstance(pos, pd.Series):
            s = pos.reindex(df.index).fillna(0.0).astype(float)
        else:
            s = pd.Series(pos, index=df.index).fillna(0.0).astype(float)
        s = s.clip(lower=0.0, upper=1.0)
    except Exception as e:
        return _fail(f"Normalize positions failed: {e}")

    out = {
        "ok": True,
        "positions": [float(x) for x in s.tolist()],
        "elapsed_seconds": round(time.time() - t0, 3),
    }
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
