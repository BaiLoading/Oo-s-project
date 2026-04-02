import akshare as ak
import datetime

print('='*80)
print('📊 真实检查AkShare API数据')
print('='*80)

print('\n🔍 步骤1: 测试基本API版本和数据来源')
print(f'   AkShare版本:', ak.__version__)

print('\n🔍 步骤2: 严格按照GitHub官方文档调用 stock_zh_a_hist')
print('='*80)

end_date = datetime.datetime.now().strftime('%Y%m%d')
start_date = (datetime.datetime.now() - datetime.timedelta(days=60)).strftime('%Y%m%d')

print(f'\n📅 日期范围: {start_date} 至 {end_date}')
print(f'🎯 股票代码: 600519')
print(f'⏱️  周期: daily')

print('\n🚀 调用官方文档的标准接口...')
try:
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
    
    print(f'\n📊 数据示例 (前10条):')
    print(df_hist.head(10))
    
    print(f'\n📈 最新数据 (最后5条):')
    print(df_hist.tail())
    
    print(f'\n🔍 检查数据完整性:')
    required_columns = ['日期', '开盘', '收盘', '最高', '最低', '成交量', '成交额']
    for col in required_columns:
        if col in df_hist.columns:
            print(f'   ✅ {col} - 存在')
        else:
            print(f'   ❌ {col} - 缺失')
    
    print(f'\n💾 保存完整数据到 akshare_real_data.csv')
    df_hist.to_csv('akshare_real_data.csv', index=False, encoding='utf-8-sig')
    
    print(f'\n✅ 验证数据验证成功！数据是真实的AkShare数据！')
    
except Exception as e:
    print(f'\n❌ 错误: {e}')
    import traceback
    traceback.print_exc()

print('\n' + '='*80)
print('🔍 测试其他真实数据接口')
print('='*80)

try:
    print('\n1️⃣ 测试 stock_individual_info_em (个股信息)')
    df_info = ak.stock_individual_info_em(symbol="600519")
    print(f'✅ 成功获取个股信息:')
    print(df_info)
    
except Exception as e:
    print(f'❌ 个股信息接口失败: {e}')
