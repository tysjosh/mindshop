const path = require('path');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = !isProduction;

  return {
    entry: './src/index.ts',
    output: {
      filename: isProduction ? 'widget.min.js' : 'widget.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'RAGAssistant',
        type: 'umd',
        export: 'default'
      },
      globalObject: 'this',
      clean: true // Clean dist folder before each build
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: isDevelopment, // Faster builds in dev
              configFile: 'tsconfig.json'
            }
          },
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                sourceMap: isDevelopment
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
        'process.env.VERSION': JSON.stringify(require('./package.json').version)
      }),
      new webpack.BannerPlugin({
        banner: `RAG Assistant Widget v${require('./package.json').version}\n(c) ${new Date().getFullYear()} RAG Assistant\nLicense: MIT`
      })
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    optimization: {
      minimize: isProduction,
      usedExports: true, // Tree shaking
      sideEffects: false,
      ...(isProduction && {
        minimizer: [
          // Use default minimizer (terser)
          '...'
        ]
      })
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 250000, // 250kb
      maxAssetSize: 250000
    },
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    },
    devServer: {
      static: [
        {
          directory: path.join(__dirname, 'examples')
        },
        {
          directory: path.join(__dirname, 'dist'),
          publicPath: '/dist'
        }
      ],
      compress: true,
      port: 8080,
      hot: true,
      open: true
    }
  };
};
