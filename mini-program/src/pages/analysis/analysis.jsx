import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './analysis.scss'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

export default function Analysis() {
  const [stockCode, setStockCode] = useState('')
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const code = Taro.getStorageSync('stockCode')
    if (code) {
      setStockCode(code)
      fetchDashboard(code)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchDashboard = async (code) => {
    setLoading(true)
    try {
      const response = await Taro.request({
        url: `${API_BASE_URL}/api/technical/dashboard?code=${code}`,
        method: 'GET'
      })
      if (response.data && !response.data.error) {
        setDashboardData(response.data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSignalColor = (signal) => {
    if (signal === 'overbought' || signal === 'bearish') return '#eb4436'
    if (signal === 'oversold' || signal === 'bullish') return '#00a854'
    return '#999'
  }

  const getSignalText = (signal) => {
    if (signal === 'overbought') return '超买'
    if (signal === 'oversold') return '超卖'
    if (signal === 'bullish') return '金叉/看涨'
    if (signal === 'bearish') return '死叉/看跌'
    return '震荡'
  }

  if (loading) {
    return (
      <View className='analysis-container'>
        <View className='loading'>
          <Text>加载技术指标数据中...</Text>
        </View>
      </View>
    )
  }

  if (!dashboardData) {
    return (
      <View className='analysis-container'>
        <View className='empty'>
          <Text>暂无数据，请先搜索股票</Text>
        </View>
      </View>
    )
  }

  const { quote, rsi, macd, kdj, bbands, adx, ema, kline } = dashboardData

  return (
    <ScrollView className='analysis-container' scrollY>
      <View className='header'>
        <Text className='title'>📊 {stockCode.toUpperCase()} 技术分析仪表盘</Text>
        <Text className='subtitle'>OpenBB 驱动 · 多指标综合分析</Text>
      </View>

      {/* 行情概览 */}
      <View className='card quote-card'>
        <View className='price-row'>
          <Text className='price'>${quote.last_price.toFixed(2)}</Text>
          <Text className={`change ${quote.change >= 0 ? 'up' : 'down'}`}>
            {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.change_percent >= 0 ? '+' : ''}{quote.change_percent.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* RSI 指标 */}
      <View className='card'>
        <View className='indicator-header'>
          <Text className='indicator-name'>RSI (14)</Text>
          <Text className='indicator-value' style={{ color: getSignalColor(rsi.signal) }}>
            {rsi.value.toFixed(1)}
          </Text>
        </View>
        <View className='indicator-bar'>
          <View className='bar-bg'>
            <View className='bar-fill' style={{ width: `${Math.min(rsi.value, 100)}%`, backgroundColor: getSignalColor(rsi.signal) }} />
          </View>
          <View className='bar-markers'>
            <Text className='marker'>0</Text>
            <Text className='marker'>30</Text>
            <Text className='marker'>70</Text>
            <Text className='marker'>100</Text>
          </View>
        </View>
        <Text className='signal-tag' style={{ backgroundColor: getSignalColor(rsi.signal) }}>
          {getSignalText(rsi.signal)}
        </Text>
      </View>

      {/* MACD 指标 */}
      <View className='card'>
        <View className='indicator-header'>
          <Text className='indicator-name'>MACD (12,26,9)</Text>
        </View>
        <View className='macd-values'>
          <View className='macd-item'>
            <Text className='label'>MACD</Text>
            <Text className='value'>{macd.macd.toFixed(3)}</Text>
          </View>
          <View className='macd-item'>
            <Text className='label'>Signal</Text>
            <Text className='value'>{macd.signal.toFixed(3)}</Text>
          </View>
          <View className='macd-item'>
            <Text className='label'>Histogram</Text>
            <Text className={`value ${macd.histogram >= 0 ? 'up' : 'down'}`}>
              {macd.histogram >= 0 ? '+' : ''}{macd.histogram.toFixed(3)}
            </Text>
          </View>
        </View>
        <Text className='signal-tag' style={{ backgroundColor: getSignalColor(macd.trend) }}>
          {getSignalText(macd.trend)}
        </Text>
      </View>

      {/* KDJ 指标 */}
      <View className='card'>
        <View className='indicator-header'>
          <Text className='indicator-name'>KDJ (14,3,3)</Text>
        </View>
        <View className='kdj-values'>
          <View className='kdj-item'>
            <Text className='label'>K</Text>
            <Text className='value'>{kdj.k.toFixed(1)}</Text>
          </View>
          <View className='kdj-item'>
            <Text className='label'>D</Text>
            <Text className='value'>{kdj.d.toFixed(1)}</Text>
          </View>
          <View className='kdj-item'>
            <Text className='label'>J</Text>
            <Text className={`value ${kdj.j > 80 || kdj.j < 20 ? 'special' : ''}`}>
              {kdj.j.toFixed(1)}
            </Text>
          </View>
        </View>
        <Text className='signal-tag' style={{ backgroundColor: getSignalColor(kdj.signal) }}>
          {getSignalText(kdj.signal)}
        </Text>
      </View>

      {/* 布林带 */}
      <View className='card'>
        <View className='indicator-header'>
          <Text className='indicator-name'>Bollinger Bands (20,2)</Text>
        </View>
        <View className='bb-values'>
          <View className='bb-item'>
            <Text className='label'>Upper</Text>
            <Text className='value up'>${bbands.upper.toFixed(2)}</Text>
          </View>
          <View className='bb-item'>
            <Text className='label'>Middle</Text>
            <Text className='value'>${bbands.middle.toFixed(2)}</Text>
          </View>
          <View className='bb-item'>
            <Text className='label'>Lower</Text>
            <Text className='value down'>${bbands.lower.toFixed(2)}</Text>
          </View>
        </View>
        <View className='position-bar'>
          <View className='position-track'>
            <View className='position-fill' style={{ width: `${bbands.position}%`, backgroundColor: bbands.position > 80 ? '#eb4436' : bbands.position < 20 ? '#00a854' : '#1890ff' }} />
          </View>
          <Text className='position-label'>当前价格在布林带中的位置: {bbands.position.toFixed(1)}%</Text>
        </View>
      </View>

      {/* ADX 趋势强度 */}
      <View className='card'>
        <View className='indicator-header'>
          <Text className='indicator-name'>ADX (14) - 趋势强度</Text>
          <Text className='indicator-value'>{adx.value.toFixed(1)}</Text>
        </View>
        <View className='adx-level'>
          <Text className={`level ${adx.value > 25 ? 'strong' : 'weak'}`}>
            {adx.trend_strength === 'strong' ? '📈 强趋势' : '📉 弱趋势'}
          </Text>
        </View>
      </View>

      {/* EMA 均线 */}
      <View className='card'>
        <View className='indicator-header'>
          <Text className='indicator-name'>EMA 均线</Text>
        </View>
        <View className='ema-values'>
          <View className='ema-item'>
            <Text className='label'>EMA 20</Text>
            <Text className='value'>${ema.ema20.toFixed(2)}</Text>
          </View>
          <View className='ema-item'>
            <Text className='label'>EMA 60</Text>
            <Text className='value'>${ema.ema60.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* 综合建议 */}
      <View className='card summary-card'>
        <Text className='card-title'>🎯 综合分析</Text>
        <View className='summary-list'>
          <View className='summary-item'>
            <Text className='dot' style={{ backgroundColor: getSignalColor(rsi.signal) }} />
            <Text>RSI: {getSignalText(rsi.signal)}</Text>
          </View>
          <View className='summary-item'>
            <Text className='dot' style={{ backgroundColor: getSignalColor(macd.trend) }} />
            <Text>MACD: {macd.histogram >= 0 ? '多头排列' : '空头排列'}</Text>
          </View>
          <View className='summary-item'>
            <Text className='dot' style={{ backgroundColor: getSignalColor(kdj.signal) }} />
            <Text>KDJ: {getSignalText(kdj.signal)}</Text>
          </View>
          <View className='summary-item'>
            <Text className='dot' style={{ backgroundColor: bbands.position > 80 ? '#eb4436' : bbands.position < 20 ? '#00a854' : '#1890ff' }} />
            <Text>布林带: {bbands.position > 80 ? '触及上轨' : bbands.position < 20 ? '触及下轨' : '正常运行'}</Text>
          </View>
          <View className='summary-item'>
            <Text className='dot' style={{ backgroundColor: adx.value > 25 ? '#00a854' : '#999' }} />
            <Text>趋势: {adx.trend_strength}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
