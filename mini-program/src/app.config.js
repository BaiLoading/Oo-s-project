export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/analysis/analysis',
    'pages/news/news',
    'pages/ai/ai',
    'pages/portfolio/portfolio'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1a1a2e',
    navigationBarTitleText: '股票智能分析',
    navigationBarTextStyle: 'white',
    backgroundColor: '#16213e'
  },
  tabBar: {
    color: '#8892b0',
    selectedColor: '#00d4ff',
    backgroundColor: '#1a1a2e',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: './assets/home.png',
        selectedIconPath: './assets/home-active.png'
      },
      {
        pagePath: 'pages/news/news',
        text: '新闻',
        iconPath: './assets/news.png',
        selectedIconPath: './assets/news-active.png'
      },
      {
        pagePath: 'pages/ai/ai',
        text: 'AI决策',
        iconPath: './assets/ai.png',
        selectedIconPath: './assets/ai-active.png'
      },
      {
        pagePath: 'pages/portfolio/portfolio',
        text: '持仓',
        iconPath: './assets/portfolio.png',
        selectedIconPath: './assets/portfolio-active.png'
      }
    ]
  }
})
