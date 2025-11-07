# Widget Build Guide

## Overview

The RAG Assistant Widget uses Webpack 5 for bundling TypeScript, CSS, and other assets into a single distributable JavaScript file that can be embedded on merchant websites.

## Build System

### Technology Stack

- **Bundler**: Webpack 5
- **Language**: TypeScript
- **Styles**: CSS with style-loader and css-loader
- **Output Format**: UMD (Universal Module Definition)

### Build Modes

#### Production Build
```bash
npm run build
```

Creates an optimized, minified bundle:
- Output: `dist/widget.min.js`
- Source maps: `dist/widget.min.js.map`
- Minified and optimized for CDN distribution
- Tree-shaking enabled
- Performance hints enabled

#### Development Build
```bash
npm run build:dev
```

Creates an unminified bundle for debugging:
- Output: `dist/widget.js`
- Source maps: `dist/widget.js.map`
- Faster build times
- Better debugging experience

#### Watch Mode
```bash
npm run dev
```

Watches for file changes and rebuilds automatically:
- Runs in development mode
- Faster incremental builds
- Ideal for active development

#### Development Server
```bash
npm run serve
```

Starts a development server with hot reload:
- Serves from `examples/` directory
- Hot module replacement enabled
- Opens browser automatically
- Available at http://localhost:8080

## Output Structure

```
dist/
├── widget.min.js          # Production bundle (minified)
├── widget.min.js.map      # Production source map
├── widget.js              # Development bundle
├── widget.js.map          # Development source map
├── index.d.ts             # TypeScript declarations
├── RAGAssistant.d.ts      # Main class declarations
└── types/                 # Type definitions
    └── *.d.ts
```

## Configuration

### Webpack Configuration (`webpack.config.js`)

Key features:
- **Entry**: `src/index.ts`
- **Output**: UMD format for universal compatibility
- **Library Name**: `RAGAssistant` (global variable)
- **Loaders**:
  - `ts-loader`: Compiles TypeScript
  - `css-loader`: Processes CSS imports
  - `style-loader`: Injects CSS into DOM
- **Optimization**:
  - Tree shaking (removes unused code)
  - Minification (production only)
  - Source maps (both modes)
- **Performance**:
  - Max bundle size: 250KB
  - Warnings for large bundles

### Environment Variables

The build injects these variables:
- `process.env.NODE_ENV`: 'production' or 'development'
- `process.env.VERSION`: Package version from package.json

Access in code:
```typescript
console.log(`Widget version: ${process.env.VERSION}`);
```

## Bundle Analysis

### Check Bundle Size
```bash
npm run build
# Look for "asset widget.min.js" in output
```

### Performance Considerations

Target bundle size: < 250KB (uncompressed)
- Current size: ~80KB (excellent!)
- Gzipped: ~25KB (estimated)

If bundle grows too large:
1. Review dependencies (use `webpack-bundle-analyzer`)
2. Enable code splitting for large features
3. Lazy load non-critical components
4. Use dynamic imports for optional features

## CDN Deployment

### Build for CDN
```bash
npm run build
```

### Upload to CDN
The production bundle (`dist/widget.min.js`) should be uploaded to:
```
https://cdn.rag-assistant.com/v1/widget.min.js
```

### Versioned URLs
For cache busting, use versioned URLs:
```
https://cdn.rag-assistant.com/v1.0.0/widget.min.js
```

### CDN Configuration
- Enable gzip compression
- Set cache headers: `Cache-Control: public, max-age=31536000`
- Enable CORS: `Access-Control-Allow-Origin: *`
- Serve with `Content-Type: application/javascript`

## Integration Examples

### Script Tag (Production)
```html
<script src="https://cdn.rag-assistant.com/v1/widget.min.js"></script>
<script>
  const assistant = new RAGAssistant({
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...'
  });
</script>
```

### NPM Package (Development)
```bash
npm install @rag-assistant/widget
```

```typescript
import RAGAssistant from '@rag-assistant/widget';

const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...'
});
```

## Troubleshooting

### Build Fails
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### TypeScript Errors
```bash
# Check TypeScript configuration
npx tsc --noEmit
```

### Large Bundle Size
```bash
# Install bundle analyzer
npm install --save-dev webpack-bundle-analyzer

# Add to webpack.config.js
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

plugins: [
  new BundleAnalyzerPlugin()
]
```

### Source Maps Not Working
- Ensure `devtool` is set in webpack.config.js
- Check browser DevTools settings
- Verify source map files are served correctly

## Development Workflow

### 1. Make Changes
Edit files in `src/`

### 2. Test Locally
```bash
npm run serve
# Opens http://localhost:8080
```

### 3. Build for Production
```bash
npm run build
```

### 4. Test Production Build
```bash
# Serve dist folder
npx http-server dist -p 8080
```

### 5. Deploy to CDN
Upload `dist/widget.min.js` to CDN

## Advanced Configuration

### Custom Webpack Config

To customize the build, edit `webpack.config.js`:

```javascript
// Add custom plugins
plugins: [
  new webpack.DefinePlugin({
    'process.env.API_URL': JSON.stringify('https://api.example.com')
  })
]

// Add custom loaders
module: {
  rules: [
    {
      test: /\.svg$/,
      use: 'svg-inline-loader'
    }
  ]
}

// Configure externals (don't bundle these)
externals: {
  'axios': 'axios' // Expect axios to be available globally
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

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Build Widget

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Upload to CDN
        run: |
          aws s3 cp dist/widget.min.js s3://cdn.rag-assistant.com/v1/
```

## Performance Optimization

### Current Optimizations
✅ Tree shaking enabled
✅ Minification enabled (production)
✅ Source maps for debugging
✅ CSS inlined in bundle
✅ UMD format for compatibility

### Future Optimizations
- [ ] Code splitting for large features
- [ ] Lazy loading for optional components
- [ ] Dynamic imports for heavy dependencies
- [ ] Service worker for offline support
- [ ] Preload/prefetch hints

## Browser Compatibility

Target browsers:
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- iOS Safari: Last 2 versions
- Android Chrome: Last 2 versions

Polyfills included:
- None currently (ES2020 target)

To add polyfills:
```bash
npm install core-js
```

```typescript
// src/index.ts
import 'core-js/stable';
```

## License

MIT License - See LICENSE file for details
