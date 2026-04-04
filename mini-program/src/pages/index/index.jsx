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
    if (!stockCode) {
      Taro.showToast({
        title: '请输入股票代码',
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
      } else {
        throw new Error('Data not found')
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

  const getCurrencySymbol = (code) => {
    if (!code) return '¥'
    return /^[0-9]/.test(code) ? '¥' : '$'
  }

  return (
    <View className='index-container'>
      <View className='header'>
        <Text className='title'>📈 股票智能分析</Text>
        <Text className='subtitle'>支持A股/美股 · 技术分析 · OpenBB驱动</Text>
      </View>

      <View className='search-section'>
        <View className='search-box'>
          <Input
            className='search-input'
            type='text'
            placeholder='输入代码（如：600519 或 AAPL）'
            value={stockCode}
            onInput={(e) => setStockCode(e.detail.value)}
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
              <Text className='stock-code'>{stockCode.toUpperCase()}</Text>
            </View>
            
            <View className='price-display'>
              <Text className={price }>
                {getCurrencySymbol(stockCode)}{stockData.quote.price.toFixed(2)}
              </Text>
              <Text className={change }>
                {stockData.quote.change >= 0 ? '+' : ''}
                {stockData.quote.change.toFixed(2)} ({stockData.quote.changePercent >= 0 ? '+' : ''}{stockData.quote.changePercent.toFixed(2)}%)
              </Text>
            </View>

            <View className='stock-meta'>
              <View className='meta-item'>
                <Text className='meta-label'>今开</Text>
                <Text className='meta-value'>{getCurrencySymbol(stockCode)}{stockData.quote.open || '--'}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>最高</Text>
                <Text className='meta-value'>{getCurrencySymbol(stockCode)}{stockData.quote.high || '--'}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>最低</Text>
                <Text className='meta-value'>{getCurrencySymbol(stockCode)}{stockData.quote.low || '--'}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>成交量</Text>
                <Text className='meta-value'>{(stockData.quote.volume / 1000000).toFixed(2)}M</Text>
              </View>
            </View>
          </View>

          <View className='action-buttons'>
            <Button
              className='detail-btn'
              onClick={() => {
                Taro.setStorageSync('stockData', stockData)
                Taro.setStorageSync('stockCode', stockCode)
                Taro.navigateTo({ url: '/pages/analysis/analysis' })
              }}
            >
              📊 技术分析
            </Button>
            <Button
              className='ai-btn'
              onClick={() => {
                Taro.setStorageSync('stockCode', stockCode)
                Taro.switchTab({ url: '/pages/ai/ai' })
              }}
            >
              🤖 AI 决策
            </Button>
          </View>
        </ScrollView>
      )}
    </View>
  )
}
