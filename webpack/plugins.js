const path = require('path');
const _MiniCssExtractPlugin = require('mini-css-extract-plugin');
const _StyleLintPlugin = require('stylelint-webpack-plugin');
const _ESLintPlugin = require('eslint-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const _ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');


const MiniCssExtractPlugin = new _MiniCssExtractPlugin({
  filename: './css/app.css',
  chunkFilename: './css/app.css',
});


const ESLintPlugin = new _ESLintPlugin({
  overrideConfigFile: path.resolve(__dirname, '../.eslintrc'),
  context: path.resolve(__dirname, '../src/js'),
  files: '**/*.js'
});

const StyleLintPlugin = new _StyleLintPlugin({
  configFile: path.resolve(__dirname, '../stylelint.config.js'),
  context: path.resolve(__dirname, '../'),
  files: '**/*.(s(c|a)ss|css)',
});

const DotenvPlugin = new Dotenv({
  path: './.env'
});

const ImageMinPlugin = new _ImageMinimizerPlugin({
  minimizerOptions: {
    plugins: [
      ['gifsicle', { interlaced: true }],
      ['jpegtran', { progressive: true }],
      ['optipng', { optimizationLevel: 5 }],
      [
        'svgo',
        {
          plugins: [
            {
              removeViewBox: false,
            },
          ],
        },
      ],
    ],
  },
});

module.exports = {
  MiniCssExtractPlugin: MiniCssExtractPlugin,
  StyleLintPlugin: StyleLintPlugin,
  ESLintPlugin: ESLintPlugin,
  DotenvPlugin: DotenvPlugin,
  ImageMinPlugin: ImageMinPlugin,
};
