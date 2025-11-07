# Widget Architecture

## Overview

The RAG Assistant Widget is an embeddable JavaScript widget that allows merchants to integrate the RAG Assistant chat functionality into their e-commerce websites.

## Project Structure

```
widget/
├── src/
│   ├── index.ts                    # Entry point & exports
│   ├── RAGAssistant.ts            # Main widget class
│   ├── components/
│   │   ├── ChatWidget.ts          # Main chat UI container
│   │   ├── MessageList.ts         # Message display component
│   │   ├── ProductCard.ts         # Product recommendation cards
│   │   └── InputBox.ts            # User input component
│   ├── services/
│   │   ├── ApiClient.ts           # API communication layer
│   │   └── Storage.ts             # LocalStorage management
│   ├── styles/
│   │   └── widget.css             # Widget styles
│   └── types/
│       └── index.ts               # TypeScript type definitions
├── examples/
│   └── basic.html                 # Basic integration example
├── dist/                          # Build output (generated)
│   └── widget.js                  # Compiled bundle
├── package.json                   # NPM configuration
├── tsconfig.json                  # TypeScript configuration
├── webpack.config.js              # Webpack build configuration
├── jest.config.js                 # Jest test configuration
├── .eslintrc.json                 # ESLint configuration
└── README.md                      # Documentation

```

## Component Architecture

### RAGAssistant (Main Class)
- **Purpose**: Entry point and orchestrator
- **Responsibilities**:
  - Initialize all services and components
  - Manage session lifecycle
  - Handle message sending
  - Coordinate between API, storage, and UI

### ChatWidget
- **Purpose**: Main UI container
- **Responsibilities**:
  - Render widget structure (toggle button, window, header, footer)
  - Handle open/close state
  - Apply theme configuration
  - Coordinate child components

### MessageList
- **Purpose**: Display conversation messages
- **Responsibilities**:
  - Render user and assistant messages
  - Display product recommendations
  - Show typing indicator
  - Auto-scroll to latest message

### ProductCard
- **Purpose**: Display product recommendations
- **Responsibilities**:
  - Render product information (image, title, price, stock)
  - Handle add-to-cart action
  - Format prices and descriptions

### InputBox
- **Purpose**: User message input
- **Responsibilities**:
  - Handle text input
  - Auto-resize textarea
  - Send messages on Enter key
  - Disable during API calls

### ApiClient
- **Purpose**: API communication
- **Responsibilities**:
  - Make HTTP requests to backend
  - Handle authentication (API key)
  - Error handling and retry logic
  - Request/response logging

### Storage
- **Purpose**: LocalStorage management
- **Responsibilities**:
  - Persist session ID
  - Store conversation history
  - Handle storage quota limits
  - Auto-cleanup stale data

## Data Flow

```
User Input
    ↓
InputBox → RAGAssistant.sendMessage()
    ↓
ApiClient.chat() → Backend API
    ↓
Response ← Backend API
    ↓
RAGAssistant → MessageList.addMessage()
    ↓
Storage.addMessage() (persist)
    ↓
UI Update (display message + recommendations)
```

## Configuration

### Required Configuration
```typescript
{
  merchantId: string;  // Merchant identifier
  apiKey: string;      // API authentication key
}
```

### Optional Configuration
```typescript
{
  apiBaseUrl?: string;           // Custom API endpoint
  theme?: {
    primaryColor?: string;       // Brand color
    fontFamily?: string;         // Custom font
    borderRadius?: string;       // Border radius
    position?: string;           // Widget position
    zIndex?: number;            // Z-index for stacking
  };
  behavior?: {
    autoOpen?: boolean;          // Auto-open on load
    greeting?: string;           // Initial greeting message
    placeholder?: string;        // Input placeholder
    maxRecommendations?: number; // Max products to show
    showTimestamps?: boolean;    // Show message timestamps
  };
  integration?: {
    addToCartCallback?: Function;    // Add to cart handler
    checkoutCallback?: Function;     // Checkout handler
    analyticsCallback?: Function;    // Analytics tracker
  };
}
```

## Build Process

### Development
```bash
npm run dev
```
- Watches for file changes
- Rebuilds automatically
- Generates source maps

### Production
```bash
npm run build
```
- Minifies code
- Optimizes bundle size
- Generates type definitions
- Creates `dist/widget.js`

## Integration Methods

### 1. Script Tag (Recommended)
```html
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
<script>
  new RAGAssistant({ merchantId: '...', apiKey: '...' });
</script>
```

### 2. NPM Package
```bash
npm install @rag-assistant/widget
```
```javascript
import RAGAssistant from '@rag-assistant/widget';
new RAGAssistant({ merchantId: '...', apiKey: '...' });
```

### 3. ES Module
```javascript
import('https://cdn.rag-assistant.com/v1/widget.js')
  .then(({ RAGAssistant }) => {
    new RAGAssistant({ merchantId: '...', apiKey: '...' });
  });
```

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: iOS Safari 12+, Chrome Mobile
- **Features Used**:
  - ES2020 syntax
  - Fetch API
  - LocalStorage
  - CSS Grid/Flexbox
  - CSS Custom Properties

## Performance Considerations

### Bundle Size
- Target: < 100KB gzipped
- Minification: Webpack with Terser
- Tree-shaking: ES modules

### Loading Strategy
- Async script loading
- Non-blocking initialization
- Lazy component rendering

### Caching
- Conversation history in LocalStorage
- Session persistence
- 7-day auto-cleanup

### API Optimization
- Request debouncing
- Response caching (future)
- Retry with exponential backoff

## Security

### API Key Protection
- Keys transmitted via HTTPS only
- Authorization header (Bearer token)
- No key storage in localStorage

### XSS Prevention
- Content sanitization
- No innerHTML with user content
- CSP-compatible

### CORS
- Configured on backend
- Credentials not included
- Specific origin allowlist

## Testing Strategy

### Unit Tests
- Service layer (ApiClient, Storage)
- Utility functions
- Component logic

### Integration Tests
- API communication
- Storage persistence
- Component interaction

### E2E Tests
- Full user flows
- Cross-browser testing
- Mobile responsiveness

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic chat interface
- ✅ Product recommendations
- ✅ LocalStorage persistence
- ✅ Theme customization

### Phase 2 (Planned)
- [ ] Voice input support
- [ ] Image upload
- [ ] Multi-language support
- [ ] Offline mode

### Phase 3 (Future)
- [ ] Video chat
- [ ] Screen sharing
- [ ] Co-browsing
- [ ] Advanced analytics

## Deployment

### CDN Deployment
```bash
# Build production bundle
npm run build

# Upload to CDN
aws s3 cp dist/widget.js s3://cdn.rag-assistant.com/v1/widget.js
aws cloudfront create-invalidation --distribution-id XXX --paths "/v1/widget.js"
```

### Versioning
- Semantic versioning (semver)
- Version in URL path: `/v1/widget.js`
- Backward compatibility maintained

## Monitoring

### Metrics to Track
- Widget load time
- API response time
- Error rate
- User engagement (messages sent)
- Conversion rate (add to cart clicks)

### Error Tracking
- Console errors logged
- API errors reported
- Network failures handled gracefully

## Support

For issues or questions:
- Documentation: https://docs.rag-assistant.com
- Email: support@rag-assistant.com
- GitHub: https://github.com/rag-assistant/widget
