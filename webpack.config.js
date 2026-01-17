const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    sidepanel: './src/sidepanel/sidepanel.js',
    viewer: './src/viewer/viewer.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "." },
        { from: "src/sidepanel/sidepanel.html", to: "sidepanel.html" },
        { from: "src/sidepanel/sidepanel.css", to: "sidepanel.css" },
        { from: "src/viewer/viewer.html", to: "viewer.html" },
        { from: "src/viewer/viewer.css", to: "viewer.css" },
        { from: "assets/icon.svg", to: "assets/icon.svg" }
      ],
    }),
  ],
  devtool: 'cheap-module-source-map',
};
