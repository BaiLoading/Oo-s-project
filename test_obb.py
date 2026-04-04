from openbb import obb
try:
    q = obb.equity.quote('AAPL', provider='yfinance')
    print(q.to_dataframe())
except Exception as e:
    print(f'Error: {e}')
