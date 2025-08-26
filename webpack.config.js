const path = require("path");
const PerspectivePlugin = require("@finos/perspective-webpack-plugin");

module.exports = {
    mode: "development",
    entry: "./src/js/index.js",
    output: {
        filename: "perspective-viewer-boxplot.js",
        path: path.resolve(__dirname, "dist"),
        library: "perspective-viewer-boxplot",
        libraryTarget: "umd",
        globalObject: "this"
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: [
                            ["@babel/preset-env", {
                                targets: "defaults",
                                modules: false
                            }]
                        ]
                    }
                }
            },
            {
                test: /\.less$/,
                use: [
                    "style-loader",
                    "css-loader",
                    "less-loader"
                ]
            },
            {
                test: /\.css$/,
                use: [
                    "style-loader",
                    "css-loader"
                ]
            }
        ]
    },
    plugins: [new PerspectivePlugin()],
    resolve: {
        extensions: [".js", ".json"]
    },
    devServer: {
        static: {
            directory: path.join(__dirname),
        },
        compress: true,
        port: 9000,
        open: '/index.html'
    }
};