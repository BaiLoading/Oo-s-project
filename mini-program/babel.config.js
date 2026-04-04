module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    ['taro', {
      framework: 'react',
      ts: true
    }]
  ]
}
