import akshare as ak
import time

def test_akshare():
    print('Testing akshare...')
    print('Version:', ak.__version__)
    
    # 测试不同的接口
    test_cases = [
        ('stock_zh_a_spot_em', '实时行情'),
        ('stock_zh_a_hist', '历史K线'),
        ('stock_individual_info_em', '个股信息')
    ]
    
    for func_name, desc in test_cases:
        print(f'\n=== 测试 {desc} ({func_name}) ===')
        try:
            if func_name == 'stock_zh_a_spot_em':
                # 实时行情接口
                df = ak.stock_zh_a_spot_em()
                print(f'Success! 数据行数: {len(df)}')
                print('前5行数据:')
                print(df.head())
            elif func_name == 'stock_zh_a_hist':
                # 历史K线接口
                df = ak.stock_zh_a_hist(
                    symbol="600519",
                    period="daily",
                    start_date="20240101",
                    end_date="20240110",
                    adjust=""
                )
                print(f'Success! 数据行数: {len(df)}')
                print('前5行数据:')
                print(df.head())
            elif func_name == 'stock_individual_info_em':
                # 个股信息接口
                df = ak.stock_individual_info_em(symbol="600519")
                print(f'Success! 数据行数: {len(df)}')
                print('数据:')
                print(df)
            print(f'✅ {desc} 测试成功')
        except Exception as e:
            print(f'❌ {desc} 测试失败: {e}')
            import traceback
            traceback.print_exc()
        time.sleep(2)

if __name__ == '__main__':
    test_akshare()