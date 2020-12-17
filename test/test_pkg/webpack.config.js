const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: path.resolve(__dirname, 'src', 'index.js'),
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.js',
    },
    module: {
        rules: [
            {
                test: /(\.go|\.mod)$/,
                use: path.resolve(__dirname, '../..'),
            },
        ],
    },
    plugins: [new HtmlWebpackPlugin()],
};
