import { View, Text } from '@tarojs/components'
import './portfolio.scss'

export default function Portfolio() {
  return (
    <View className='portfolio-container'>
      <Text className='title'>💼 我的持仓</Text>
      <View className='empty-box'>
        <Text>功能开发中...</Text>
      </View>
    </View>
  )
}
