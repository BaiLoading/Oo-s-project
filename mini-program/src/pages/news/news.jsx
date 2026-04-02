import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './news.scss'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

export default function News() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(false)

  const loadNews = async () => {
    setLoading(true)
    try {
      const response = await Taro.request({
        url: `${API_BASE_URL}/api/news`,
        method: 'GET'
      })

      if (response.data && response.data.success) {
        setNews(response.data.data)
      }
    } catch (error) {
      console.error('Error:', error)
      Taro.showToast({
        title: '加载新闻失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNews()
  }, [])

  const getCategoryText = (category) => {
    const categories = {
      'market': '市场',
      'policy': '政策',
      'commodity': '商品',
      'industry': '行业',
      'global': '全球',
      'forex': '外汇'
    }
    return categories[category] || category
  }

  const getImpactClass = (impact) => {
    return impact === 'positive' ? 'positive' : 
           impact === 'negative' ? 'negative' : 'neutral'
  }

  return (
    <View className='news-container'>
      <View className='news-header'>
        <Text className='title'>📰 实时财经新闻</Text>
        <Button 
          className='refresh-btn' 
          loading={loading}
          onClick={loadNews}
        >
          刷新
        </Button>
      </View>

      <ScrollView className='news-list' scrollY>
        {loading ? (
          <View className='loading'>
            <Text>加载中...</Text>
          </View>
        ) : news.length === 0 ? (
          <View className='empty'>
            <Text>暂无新闻</Text>
          </View>
        ) : (
          news.map((item) => (
            <View 
              key={item.id} 
              className={`news-item ${getImpactClass(item.impact)}`}
            >
              <Text className='news-title'>{item.title}</Text>
              <View className='news-meta'>
                <Text className='news-time'>{item.time}</Text>
                <Text className='news-category'>{getCategoryText(item.category)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
