const path = require('path');
const webpack = require('webpack')

// TODO change this from testing config
module.exports = {
  mode: 'development',

  entry: './src/race.js',
  output: {
    filename: 'race.js',
    path: path.resolve(__dirname, 'static/dist'),
  },
    module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  target: 'web',

  // this is for numjs package to work
  resolve: {
    fallback: {
      "buffer": require.resolve("buffer/"),
      "util": require.resolve("util/")
    }
  },

  plugins: [
    // fix "process is not defined" error:
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ]
};