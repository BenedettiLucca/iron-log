module.exports = {
  presets: [
    ['babel-preset-expo', { jsxRuntime: 'automatic' }],
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
  plugins: [
    'babel-plugin-inline-import',
    require.resolve('expo-router/babel'),
  ],
};
