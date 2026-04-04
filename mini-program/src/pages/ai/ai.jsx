import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './ai.scss'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

export default function AI() {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [stockCode, setStockCode] = useState('')

  useEffect(() => {
    const code = Taro.getStorageSync('stockCode')
    if (code) {
      setStockCode(code)
      fetchAnalysis(code)
    }
  }, [])

  const fetchAnalysis = async (code) => {
    setLoading(true)
    try {
      const response = await Taro.request({
        url: `${API_BASE_URL}/api/ai/analyze?code=${code}`,
        method: 'GET'
      })
      if (response.data && response.data.analysis) {
        setAnalysis(response.data.analysis)
      } else {
        throw new Error('Analysis failed')
      }
    } catch (error) {
      console.error('Error:', error)
      Taro.showToast({ title: 'AI分析失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='ai-container'>
      <View className='header'>
        <Text className='title'>🤖 AI 智能投顾</Text>
        <Text className='subtitle'>基于通义千问 & OpenBB 深度数据</Text>
      </View>

      <ScrollView className='content-section' scrollY>
        <View className='stock-card'>
          <Text className='stock-code'>当前分析: {stockCode.toUpperCase()}</Text>
          <Button className='refresh-btn' onClick={() => fetchAnalysis(stockCode)} loading={loading}>
            重新分析
          </Button>
        </View>

        <View className='analysis-card'>
          <Text className='card-title'>🔍 深度报告</Text>
          {loading ? (
            <View className='loading-box'>
              <Text className='loading-text'>AI 正在调取 OpenBB 基本面数据并进行分析...</Text>
            </View>
          ) : (
            <View className='analysis-text'>
              <Text>{analysis || '点击上方按钮开始分析'}</Text>
            </View>
          )}
        </View>

        <View className='disclaimer'>
          <Text>风险提示：AI 建议仅供参考，不构成投资建议。市场有风险，投资需谨慎。</Text>
        </View>
      </ScrollView>
    </View>
  )
}
