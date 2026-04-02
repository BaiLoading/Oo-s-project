import { useState } from 'react'
import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

export default function Index() {
  const [stockCode, setStockCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [stockData, setStockData] = useState(null)

  const analyzeStock = async () => {
    if (!stockCode || stockCode.length !== 6) {
      Taro.showToast({
        title: '请输入6位股票代码',
        icon: 'none'
      })
      return
    }

    setLoading(true)
    try {
      const response = await Taro.request({
        url: `${API_BASE_URL}/api/stock/full?code=${stockCode}`,
        method: 'GET'
      })

      if (response.data && response.data.quote) {
        setStockData(response.data)
        Taro.showToast({
          title: '获取成功',
          icon: 'success'
        })
      }
    } catch (error) {
      console.error('Error:', error)
      Taro.showToast({
        title: '获取数据失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='index-container'>
      <View className='header'>
        <Text className='title'>📈 股票智能分析</Text>
        <Text className='subtitle'>支持A股 · 技术分析 · AI智能建议</Text>
      </View>

      <View className='search-section'>
        <View className='search-box'>
          <Input
            className='search-input'
            type='number'
            placeholder='输入股票代码（如：600519）'
            value={stockCode}
            onInput={(e) => setStockCode(e.detail.value)}
            maxlength={6}
          />
          <Button
            className='search-btn'
            loading={loading}
            onClick={analyzeStock}
          >
            开始分析
          </Button>
        </View>
      </View>

      {stockData && (
        <ScrollView className='result-section' scrollY>
          <View className='stock-info'>
            <View className='stock-header'>
              <Text className='stock-name'>{stockData.quote.name}</Text>
              <Text className='stock-code'>{stockCode}</Text>
            </View>
            
            <View className='price-display'>
              <Text className={`price ${stockData.quote.price >= stockData.quote.preClose ? 'up' : 'down'}`}>
                ¥{stockData.quote.price}
              </Text>
              <Text className={`change ${stockData.quote.price >= stockData.quote.preClose ? 'up' : 'down'}`}>
                {stockData.quote.price >= stockData.quote.preClose ? '+' : ''}
                {(stockData.quote.price - stockData.quote.preClose).toFixed(2)}
              </Text>
            </View>

            <View className='stock-meta'>
              <View className='meta-item'>
                <Text className='meta-label'>今开</Text>
                <Text className='meta-value'>¥{stockData.quote.open}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>最高</Text>
                <Text className='meta-value'>¥{stockData.quote.high}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>最低</Text>
                <Text className='meta-value'>¥{stockData.quote.low}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>成交量</Text>
                <Text className='meta-value'>{(stockData.quote.volume / 1000000).toFixed(2)}M</Text>
              </View>
            </View>
          </View>

          <Button
            className='detail-btn'
            onClick={() => {
              Taro.setStorageSync('stockData', stockData)
              Taro.setStorageSync('stockCode', stockCode)
              Taro.navigateTo({ url: '/pages/analysis/analysis' })
            }}
          >
            查看详细技术分析
          </Button>
        </ScrollView>
      )}
    </View>
  )
}
