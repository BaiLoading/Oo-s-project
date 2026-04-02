import akshare as ak
import datetime

print('='*80)
print('📊 重新测试AkShare API - 按照官方文档')
print('='*80)

# 按照GitHub官方文档的标准用法
print('\n🔍 测试 stock_zh_a_hist 接口（官方标准用法）')
print('   参考: https://github.com/akfamily/akshare')
print('='*80)

try:
    # 计算日期范围
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=60)).strftime('%Y%m%d')
    
    print(f'\n📅 日期范围: {start_date} 至 {end_date}')
    print(f'🎯 股票代码: 600519 (贵州茅台)')
    print(f'⏱️  周期: daily (日K)')
    print(f'📈 复权: 不复权')
    
    # 严格按照GitHub文档的标准用法
    print('\n🚀 调用接口...')
    df_hist = ak.stock_zh_a_hist(
        symbol="600519",
        period="daily",
        start_date=start_date,
        end_date=end_date,
        adjust=""
    )
    
    print(f'\n✅ 成功获取数据！')
    print(f'   数据行数: {len(df_hist)}')
    print(f'   列名: {list(df_hist.columns)}')
    
    print(f'\n📊 数据示例:')
    print(df_hist.head(10))
    
    print(f'\n📈 最新数据:')
    print(df_hist.tail())
    
    # 保存数据到文件
    df_hist.to_csv('akshare_test_data.csv', index=False, encoding='utf-8-sig')
    print(f'\n💾 数据已保存到 akshare_test_data.csv')
    
    # 检查是否包含需要的列
    required_columns = ['日期', '开盘', '收盘', '最高', '最低', '成交量', '成交额']
    print(f'\n🔍 列名检查:')
    for col in required_columns:
        if col in df_hist.columns:
            print(f'   ✅ {col} - 存在')
        else:
            print(f'   ❌ {col} - 缺失')
    
except Exception as e:
    print(f'\n❌ 测试失败: {e}')
    import traceback
    traceback.print_exc()

print('\n' + '='*80)
print('📊 测试其他接口')
print('='*80)

try:
    print('\n🔍 测试 stock_zh_a_spot_em 接口（实时行情）')
    df_spot = ak.stock_zh_a_spot_em()
    print(f'✅ 成功获取实时行情！')
    print(f'   股票数量: {len(df_spot)}')
    print(f'   列名: {list(df_spot.columns)}')
except Exception as e:
    print(f'❌ 实时行情接口失败: {e}')

try:
    print('\n🔍 测试 stock_individual_info_em 接口（个股信息）')
    df_info = ak.stock_individual_info_em(symbol="600519")
    print(f'✅ 成功获取个股信息！')
    print(df_info)
except Exception as e:
    print(f'❌ 个股信息接口失败: {e}')
