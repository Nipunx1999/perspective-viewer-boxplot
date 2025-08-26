const path = require("path");
const PerspectivePlugin = require("@finos/perspective-webpack-plugin");

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    
    return [
        // UMD build
        {
            mode: argv.mode || "development",
            entry: "./src/js/index.js",
            output: {
                filename: "perspective-viewer-boxplot.js",
                path: path.resolve(__dirname, "dist"),
                library: {
                    name: "perspective-viewer-boxplot",
                    type: "umd",
                    export: "default"
                },
                globalObject: "this",
                clean: false
            },
            externals: {
                // Don't bundle these - let the consuming app provide them
                "@finos/perspective": {
                    commonjs: "@finos/perspective",
                    commonjs2: "@finos/perspective",
                    amd: "@finos/perspective",
                    root: "perspective"
                },
                "@finos/perspective-viewer": {
                    commonjs: "@finos/perspective-viewer", 
                    commonjs2: "@finos/perspective-viewer",
                    amd: "@finos/perspective-viewer",
                    root: "perspective-viewer"
                }
                // d3 will be bundled
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
        },
        // ES Module build for React
        {
            mode: argv.mode || "development",
            entry: "./src/js/react-export.js",
            output: {
                filename: "perspective-viewer-boxplot.esm.js",
                path: path.resolve(__dirname, "dist"),
                library: {
                    type: "module"
                },
                environment: { module: true }
            },
            externals: {
                "@finos/perspective": "@finos/perspective",
                "@finos/perspective-viewer": "@finos/perspective-viewer"
                // d3 will be bundled
            },
            experiments: {
                outputModule: true
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
            }
        },
        // React-friendly CommonJS build
        {
            mode: argv.mode || "development",
            entry: "./src/js/react-export.js",
            output: {
                filename: "perspective-viewer-boxplot.cjs.js",
                path: path.resolve(__dirname, "dist"),
                library: {
                    type: "commonjs2"
                }
            },
            externals: {
                "@finos/perspective": "@finos/perspective",
                "@finos/perspective-viewer": "@finos/perspective-viewer"
                // d3 will be bundled
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
                                        modules: "commonjs"
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
            }
        }
    ];
};