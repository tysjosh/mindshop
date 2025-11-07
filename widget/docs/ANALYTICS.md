# Analytics Tracking

The RAG Assistant widget includes comprehensive analytics tracking to help you understand how users interact with the assistant.

## Features

- **Automatic Event Tracking**: Key events are tracked automatically
- **Custom Callback Integration**: Send events to your analytics service
- **Session Metrics**: Get real-time metrics about the current session
- **Privacy-Friendly**: No PII is tracked by default

## Tracked Events

### Widget Lifecycle Events

| Event | Description | Metadata |
|-------|-------------|----------|
| `widget_initialized` | Widget successfully initialized | merchantId, userAgent, screenResolution, language |
| `widget_opened` | User opened the chat widget | sessionId |
| `widget_closed` | User closed the chat widget | sessionId, durationMs |

### Conversation Events

| Event | Description | Metadata |
|-------|-------------|----------|
| `message_sent` | User sent a message | query, responseTime, sessionId, queryLength |
| `message_received` | Assistant response received | responseTime, hasRecommendations, sessionId |
| `typing_started` | User started typing | sessionId |

### Product Interaction Events

| Event | Description | Metadata |
|-------|-------------|----------|
| `product_clicked` | User clicked a product recommendation | productId, position, sessionId |
| `add_to_cart` | User added product to cart | productId, sessionId |
| `checkout_initiated` | User initiated checkout | itemCount, sessionId |

### Session Events

| Event | Description | Metadata |
|-------|-------------|----------|
| `session_created` | New session created | sessionId |
| `session_restored` | Existing session restored | sessionId, messageCount |
| `history_cleared` | Conversation history cleared | sessionId |

### Error Events

| Event | Description | Metadata |
|-------|-------------|----------|
| `error_occurred` | An error occurred | errorType, errorMessage, sessionId |

## Usage

### Basic Setup

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    analyticsCallback: (event) => {
      console.log('Analytics event:', event);
      
      // Send to your analytics service
      // Example: Google Analytics
      if (typeof gtag !== 'undefined') {
        gtag('event', event.event, {
          event_category: 'RAG_Widget',
          event_label: event.query || event.productId || '',
          value: event.responseTime || 0
        });
      }
    }
  }
});
```

### Integration with Google Analytics

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    analyticsCallback: (event) => {
      // Send to Google Analytics 4
      gtag('event', event.event, {
        event_category: 'RAG_Widget',
        event_label: event.query || event.productId || '',
        value: event.responseTime || 0,
        session_id: event.metadata?.sessionId,
        merchant_id: 'your_merchant_id'
      });
    }
  }
});
```

### Integration with Mixpanel

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    analyticsCallback: (event) => {
      // Send to Mixpanel
      mixpanel.track(event.event, {
        query: event.query,
        product_id: event.productId,
        response_time: event.responseTime,
        session_id: event.metadata?.sessionId,
        ...event.metadata
      });
    }
  }
});
```

### Integration with Segment

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    analyticsCallback: (event) => {
      // Send to Segment
      analytics.track(event.event, {
        query: event.query,
        productId: event.productId,
        responseTime: event.responseTime,
        sessionId: event.metadata?.sessionId,
        timestamp: event.timestamp,
        ...event.metadata
      });
    }
  }
});
```

### Custom Analytics Endpoint

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    analyticsCallback: async (event) => {
      // Send to your custom analytics endpoint
      try {
        await fetch('https://your-api.com/analytics/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your_token'
          },
          body: JSON.stringify({
            event: event.event,
            properties: {
              query: event.query,
              productId: event.productId,
              responseTime: event.responseTime,
              sessionId: event.metadata?.sessionId,
              timestamp: event.timestamp,
              ...event.metadata
            }
          })
        });
      } catch (error) {
        console.error('Failed to send analytics:', error);
      }
    }
  }
});
```

## Manual Tracking

You can also manually track events:

```javascript
// Track product click
assistant.trackProductClick('product_123', 0);

// Track add to cart
assistant.trackAddToCart('product_123');

// Track checkout
assistant.trackCheckout(3); // 3 items in cart
```

## Session Metrics

Get real-time metrics about the current session:

```javascript
const metrics = assistant.getAnalyticsSummary();

console.log(metrics);
// {
//   totalEvents: 15,
//   messagesSent: 5,
//   messagesReceived: 5,
//   productsClicked: 3,
//   addToCartCount: 2,
//   errors: 0,
//   avgResponseTime: 245
// }
```

## Enable/Disable Analytics

You can enable or disable analytics tracking at runtime:

```javascript
// Disable analytics
assistant.setAnalyticsEnabled(false);

// Enable analytics
assistant.setAnalyticsEnabled(true);
```

## Event Structure

All analytics events follow this structure:

```typescript
interface AnalyticsEvent {
  event: string;              // Event name (e.g., 'message_sent')
  query?: string;             // User query (for message events)
  responseTime?: number;      // Response time in milliseconds
  productId?: string;         // Product ID (for product events)
  timestamp?: Date;           // Event timestamp
  metadata?: {                // Additional metadata
    sessionId?: string;
    queryLength?: number;
    hasRecommendations?: boolean;
    errorType?: string;
    errorMessage?: string;
    [key: string]: any;
  };
}
```

## Privacy Considerations

- **No PII by Default**: The widget does not track personally identifiable information (PII) by default
- **Query Content**: User queries are included in events. If you need to redact sensitive information, do so in your analytics callback
- **Session IDs**: Session IDs are included for tracking user journeys but are not linked to user identities
- **GDPR Compliance**: Ensure your analytics callback complies with GDPR and other privacy regulations

### Example: Redacting Sensitive Information

```javascript
const assistant = new RAGAssistant({
  merchantId: 'your_merchant_id',
  apiKey: 'pk_live_...',
  integration: {
    analyticsCallback: (event) => {
      // Redact sensitive information from queries
      if (event.query) {
        // Remove email addresses
        event.query = event.query.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
        
        // Remove phone numbers
        event.query = event.query.replace(/\d{3}[-.]?\d{3}[-.]?\d{4}/g, '[PHONE]');
        
        // Remove credit card numbers
        event.query = event.query.replace(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, '[CARD]');
      }
      
      // Send to analytics
      gtag('event', event.event, event);
    }
  }
});
```

## Best Practices

1. **Batch Events**: If sending to a remote endpoint, consider batching events to reduce network requests
2. **Error Handling**: Always wrap analytics calls in try-catch to prevent errors from breaking the widget
3. **Performance**: Keep analytics callbacks lightweight to avoid impacting widget performance
4. **Privacy**: Review your analytics implementation for privacy compliance
5. **Testing**: Use the analytics integration example to test your implementation

## Example Dashboard

See `examples/analytics-integration.html` for a complete example of building a real-time analytics dashboard.

## Troubleshooting

### Events Not Firing

1. Check that `analyticsCallback` is properly configured
2. Check browser console for errors
3. Verify the widget is initialized: `assistant.isReady()`

### Missing Metadata

Some events may not include all metadata fields. Always check for field existence:

```javascript
analyticsCallback: (event) => {
  const sessionId = event.metadata?.sessionId || 'unknown';
  const responseTime = event.responseTime || 0;
  // ...
}
```

### Performance Issues

If analytics callbacks are causing performance issues:

1. Use asynchronous operations (async/await, promises)
2. Implement request batching
3. Add debouncing for high-frequency events
4. Consider using a web worker for heavy processing

## Support

For questions or issues with analytics tracking, please contact support@rag-assistant.com or open an issue on GitHub.
