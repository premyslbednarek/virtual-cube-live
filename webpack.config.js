const path = require('path');
const webpack = require('webpack')

// TODO change this from testing config
module.exports = {
  mode: 'development',

  entry: './ts-src/race.ts',
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

  // this is for numjs package to work
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
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