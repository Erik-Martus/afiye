const path = require('path');
const _MiniCssExtractPlugin = require('mini-css-extract-plugin');
const _StyleLintPlugin = require('stylelint-webpack-plugin');
const _ESLintPlugin = require('eslint-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const Dotenv = require('dotenv-webpack');

const MiniCssExtractPlugin = new _MiniCssExtractPlugin({
  filename: './css/[name].[hash].bundle.css',
  chunkFilename: './css/[id].[hash].css',
});


const ESLintPlugin = new _ESLintPlugin({
  overrideConfigFile: path.resolve(__dirname, '../.eslintrc'),
  context: path.resolve(__dirname, '../src/js'),
  files: '**/*.js'
});

const StyleLintPlugin = new _StyleLintPlugin({
  configFile: path.resolve(__dirname, '../stylelint.config.js'),
  context: path.resolve(__dirname, '../src/scss'),
  files: '**/*.(s(c|a)ss|css)',
});

const DotenvPlugin = new Dotenv({
  path: './.env'
});

module.exports = {
  CleanWebpackPlugin: new CleanWebpackPlugin(),
  MiniCssExtractPlugin: MiniCssExtractPlugin,
  StyleLintPlugin: StyleLintPlugin,
  ESLintPlugin: ESLintPlugin,
  DotenvPlugin: DotenvPlugin,
};
