# Widget Build Quick Start

## Installation

```bash
cd widget
npm install
```

## Build Commands

### Production Build (Recommended for deployment)
```bash
npm run build
```
- Output: `dist/widget.min.js` (68KB minified)
- Optimized and minified
- Ready for CDN deployment

### Development Build
```bash
npm run build:dev
```
- Output: `dist/widget.js` (626KB unminified)
- Better for debugging
- Includes inline source maps

### Watch Mode (Active Development)
```bash
npm run dev
```
- Watches for file changes
- Auto-rebuilds on save
- Fast incremental builds

### Development Server (Live Preview)
```bash
npm run serve
```
- Starts server at http://localhost:8080
- Hot module replacement
- Serves examples from `examples/` directory
- Auto-opens browser

## Output Files

After building, you'll find:

```
dist/
├── widget.min.js          # Production bundle (use this for CDN)
├── widget.min.js.map      # Source map for debugging
├── widget.min.js.LICENSE.txt  # Third-party licenses
├── index.d.ts             # TypeScript type definitions
├── RAGAssistant.d.ts      # Main class types
└── types/                 # Additional type definitions
```

## Testing the Build

### 1. Build the widget
```bash
npm run build
```

### 2. Open the example
```bash
open examples/basic.html
```

Or use a local server:
```bash
npx http-server . -p 8080
# Then open http://localhost:8080/examples/basic.html
```

## Integration

### Script Tag (Most Common)
```html
<script src="https://cdn.rag-assistant.com/v1/widget.min.js"></script>
<script>
  const assistant = new RAGAssistant({
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...'
  });
</script>
```

### NPM Package
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

## Common Issues

### Build fails
```bash
npm run clean
npm install
npm run build
```

### TypeScript errors
```bash
npx tsc --noEmit
```

### Bundle too large
- Check dependencies
- Use dynamic imports for optional features
- Run bundle analyzer (see WEBPACK.md)

## Next Steps

- Read [BUILD.md](./BUILD.md) for detailed build documentation
- Read [WEBPACK.md](./WEBPACK.md) for webpack configuration details
- Check [examples/basic.html](./examples/basic.html) for integration examples
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines

## Quick Reference

| Command | Purpose | Output |
|---------|---------|--------|
| `npm run build` | Production build | `widget.min.js` (68KB) |
| `npm run build:dev` | Development build | `widget.js` (626KB) |
| `npm run dev` | Watch mode | Auto-rebuild |
| `npm run serve` | Dev server | http://localhost:8080 |
| `npm run clean` | Clean dist | Removes `dist/` |
| `npm test` | Run tests | Test results |
| `npm run lint` | Lint code | ESLint output |

## Bundle Size

- **Production**: ~68KB (minified)
- **Gzipped**: ~25KB (estimated)
- **Target**: < 250KB
- **Status**: ✅ Well under target

## Browser Support

- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- iOS Safari: Last 2 versions
- Android Chrome: Last 2 versions

## Performance

- **Build time (production)**: ~2.5 seconds
- **Build time (development)**: ~0.6 seconds
- **Incremental rebuild**: < 1 second
- **Hot reload**: < 500ms

## Support

For issues or questions:
1. Check [BUILD.md](./BUILD.md) and [WEBPACK.md](./WEBPACK.md)
2. Review [examples/](./examples/)
3. Open an issue on GitHub
4. Contact support@rag-assistant.com
