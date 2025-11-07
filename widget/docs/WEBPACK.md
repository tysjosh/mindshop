# Webpack Configuration Documentation

## Overview

The RAG Assistant Widget uses Webpack 5 to bundle TypeScript source code, CSS styles, and assets into a single JavaScript file that can be embedded on any website.

## Configuration File

**Location**: `webpack.config.js`

The configuration exports a function that receives environment and command-line arguments, allowing for different builds based on the mode (development/production).

## Key Features

### 1. Entry Point
```javascript
entry: './src/index.ts'
```
- Single entry point that exports the RAGAssistant class
- Includes all dependencies and styles

### 2. Output Configuration
```javascript
output: {
  filename: isProduction ? 'widget.min.js' : 'widget.js',
  path: path.resolve(__dirname, 'dist'),
  library: {
    name: 'RAGAssistant',
    type: 'umd',
    export: 'default'
  },
  globalObject: 'this',
  clean: true
}
```

**Features**:
- **Dynamic filename**: `.min.js` for production, `.js` for development
- **UMD format**: Works with AMD, CommonJS, and global variables
- **Library name**: Exposed as `RAGAssistant` globally
- **Clean output**: Removes old files before each build

### 3. Module Resolution
```javascript
resolve: {
  extensions: ['.ts', '.js', '.json'],
  alias: {
    '@': path.resolve(__dirname, 'src')
  }
}
```

**Features**:
- Auto-resolves `.ts`, `.js`, and `.json` extensions
- Path alias `@` points to `src/` directory
- Simplifies imports: `import { X } from '@/services/X'`

### 4. Loaders

#### TypeScript Loader
```javascript
{
  test: /\.ts$/,
  use: {
    loader: 'ts-loader',
    options: {
      transpileOnly: isDevelopment,
      configFile: 'tsconfig.json'
    }
  },
  exclude: /node_modules/
}
```

**Features**:
- Compiles TypeScript to JavaScript
- Type checking disabled in dev mode for faster builds
- Uses `tsconfig.json` for compiler options

#### CSS Loader
```javascript
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
```

**Features**:
- `css-loader`: Processes CSS imports
- `style-loader`: Injects CSS into DOM at runtime
- Source maps enabled in development

### 5. Plugins

#### DefinePlugin
```javascript
new webpack.DefinePlugin({
  'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
  'process.env.VERSION': JSON.stringify(require('./package.json').version)
})
```

**Purpose**: Inject environment variables at build time

**Usage in code**:
```typescript
if (process.env.NODE_ENV === 'production') {
  // Production-only code
}

console.log(`Widget version: ${process.env.VERSION}`);
```

#### BannerPlugin
```javascript
new webpack.BannerPlugin({
  banner: `RAG Assistant Widget v${version}\n(c) ${year} RAG Assistant\nLicense: MIT`
})
```

**Purpose**: Adds a comment banner to the top of the output file

### 6. Source Maps

```javascript
devtool: isProduction ? 'source-map' : 'eval-source-map'
```

**Production**: `source-map`
- Separate `.map` file
- Full source maps for debugging
- Slower build, better quality

**Development**: `eval-source-map`
- Inline source maps
- Faster rebuilds
- Good debugging experience

### 7. Optimization

```javascript
optimization: {
  minimize: isProduction,
  usedExports: true,
  sideEffects: false
}
```

**Features**:
- **Minification**: Only in production (uses Terser)
- **Tree shaking**: Removes unused exports
- **Side effects**: Assumes no side effects for better optimization

### 8. Performance

```javascript
performance: {
  hints: isProduction ? 'warning' : false,
  maxEntrypointSize: 250000,
  maxAssetSize: 250000
}
```

**Features**:
- Warns if bundle exceeds 250KB
- Only enabled in production
- Helps maintain bundle size

### 9. Development Server

```javascript
devServer: {
  static: {
    directory: path.join(__dirname, 'examples')
  },
  compress: true,
  port: 8080,
  hot: true,
  open: true
}
```

**Features**:
- Serves from `examples/` directory
- Gzip compression enabled
- Hot module replacement
- Auto-opens browser

## Build Modes

### Production Build

**Command**: `npm run build`

**Characteristics**:
- Minified output (`widget.min.js`)
- Tree shaking enabled
- Source maps in separate file
- Performance warnings enabled
- Optimized for size and speed

**Output**:
```
dist/
├── widget.min.js          (~68KB)
├── widget.min.js.map      (source map)
├── widget.min.js.LICENSE.txt (licenses)
└── *.d.ts                 (TypeScript declarations)
```

### Development Build

**Command**: `npm run build:dev`

**Characteristics**:
- Unminified output (`widget.js`)
- Inline source maps
- Faster build times
- Better debugging

**Output**:
```
dist/
├── widget.js              (~626KB unminified)
└── *.d.ts                 (TypeScript declarations)
```

### Watch Mode

**Command**: `npm run dev`

**Characteristics**:
- Watches for file changes
- Incremental rebuilds
- Fast feedback loop
- Development mode

### Development Server

**Command**: `npm run serve`

**Characteristics**:
- Live reload
- Hot module replacement
- Serves examples
- Opens browser automatically

## Build Process Flow

```
1. Clean dist/ directory (prebuild)
   ↓
2. Read entry point (src/index.ts)
   ↓
3. Resolve imports and dependencies
   ↓
4. Apply loaders (TypeScript, CSS)
   ↓
5. Apply plugins (DefinePlugin, BannerPlugin)
   ↓
6. Optimize (tree shaking, minification)
   ↓
7. Generate output (widget.min.js)
   ↓
8. Generate source maps
   ↓
9. Generate TypeScript declarations
```

## Customization

### Adding a New Loader

Example: Adding SVG support
```javascript
module: {
  rules: [
    // ... existing rules
    {
      test: /\.svg$/,
      use: 'svg-inline-loader'
    }
  ]
}
```

### Adding External Dependencies

To exclude a dependency from the bundle:
```javascript
externals: {
  'axios': 'axios'  // Expect axios to be available globally
}
```

### Multiple Entry Points

For multiple widgets:
```javascript
entry: {
  widget: './src/index.ts',
  'widget-minimal': './src/minimal.ts'
},
output: {
  filename: '[name].min.js'
}
```

### Code Splitting

For lazy loading:
```javascript
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10
      }
    }
  }
}
```

## Troubleshooting

### Build Fails with TypeScript Errors

**Solution**: Run type checking separately
```bash
npx tsc --noEmit
```

### Bundle Size Too Large

**Solutions**:
1. Analyze bundle: `npm install --save-dev webpack-bundle-analyzer`
2. Enable code splitting
3. Use dynamic imports for large features
4. Check for duplicate dependencies

### Source Maps Not Working

**Solutions**:
1. Verify `devtool` setting in webpack.config.js
2. Check browser DevTools settings
3. Ensure `.map` files are served correctly
4. Check CORS headers if serving from CDN

### Hot Reload Not Working

**Solutions**:
1. Ensure `hot: true` in devServer config
2. Check that files are in watched directories
3. Restart dev server
4. Clear browser cache

## Performance Tips

### Faster Development Builds
- Use `transpileOnly: true` in ts-loader
- Use `eval-source-map` for source maps
- Disable type checking (use IDE instead)

### Smaller Production Builds
- Enable tree shaking
- Use production mode
- Minimize dependencies
- Use dynamic imports for optional features

### Better Caching
- Use content hashes in filenames: `[name].[contenthash].js`
- Configure cache headers on CDN
- Use long-term caching for versioned files

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Build Widget
  run: |
    cd widget
    npm ci
    npm run build
    
- name: Upload to S3
  run: |
    aws s3 cp widget/dist/widget.min.js \
      s3://cdn.rag-assistant.com/v1/widget.min.js \
      --cache-control "public, max-age=31536000"
```

### Versioned Deployments
```bash
# Build
npm run build

# Upload with version
VERSION=$(node -p "require('./package.json').version")
aws s3 cp dist/widget.min.js \
  s3://cdn.rag-assistant.com/v${VERSION}/widget.min.js
```

## Best Practices

1. **Always test production builds locally** before deploying
2. **Monitor bundle size** - keep under 250KB
3. **Use source maps** in production for debugging
4. **Version your CDN URLs** for cache busting
5. **Enable gzip/brotli** compression on CDN
6. **Test in multiple browsers** before release
7. **Keep dependencies updated** for security
8. **Document breaking changes** in widget API

## Resources

- [Webpack Documentation](https://webpack.js.org/)
- [TypeScript Loader](https://github.com/TypeStrong/ts-loader)
- [CSS Loader](https://webpack.js.org/loaders/css-loader/)
- [UMD Format](https://github.com/umdjs/umd)
