# Widget CDN URLs Reference

Quick reference for widget CDN URLs across different environments.

## Production

### Latest Version (Recommended)
```
https://cdn.rag-assistant.com/v1/widget.js
```
- Always points to the latest stable version
- Cache TTL: 1 hour
- Use this for most integrations

### Specific Version (Immutable)
```
https://cdn.rag-assistant.com/v1.2.3/widget.min.js
```
- Version-specific URL (never changes)
- Cache TTL: 1 year
- Use for version pinning

### Legacy (Backward Compatibility)
```
https://cdn.rag-assistant.com/widget.js
```
- For existing integrations
- Cache TTL: 1 hour

## Staging

### Latest Version
```
https://cdn-staging.rag-assistant.com/v1/widget.js
```

### Specific Version
```
https://cdn-staging.rag-assistant.com/v1.2.3/widget.min.js
```

## Development

### Latest Version
```
https://d1234567890abc.cloudfront.net/v1/widget.js
```
(Replace with actual CloudFront domain from deployment)

## Embed Code Examples

### Production (Recommended)

```html
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
<script>
  const assistant = new RAGAssistant({
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...'
  });
</script>
```

### Async Loading (Best Performance)

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...'
  });
</script>
```

### Version Pinning (Stable)

```html
<script src="https://cdn.rag-assistant.com/v1.2.3/widget.min.js"></script>
<script>
  const assistant = new RAGAssistant({
    merchantId: 'your_merchant_id',
    apiKey: 'pk_live_...'
  });
</script>
```

## Performance Optimization

### Preconnect Hints

Add these to your `<head>` for faster loading:

```html
<link rel="dns-prefetch" href="https://cdn.rag-assistant.com">
<link rel="preconnect" href="https://cdn.rag-assistant.com">
<link rel="preconnect" href="https://api.rag-assistant.com">
```

### Lazy Loading

Load widget only when needed:

```html
<script>
  // Load after 3 seconds
  setTimeout(function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.rag-assistant.com/v1/widget.js';
    script.async = true;
    document.body.appendChild(script);
  }, 3000);
</script>
```

## Integrity Hashes (SRI)

For enhanced security, use Subresource Integrity:

```html
<script 
  src="https://cdn.rag-assistant.com/v1.2.3/widget.min.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous">
</script>
```

Generate hash:
```bash
curl -s https://cdn.rag-assistant.com/v1.2.3/widget.min.js | \
  openssl dgst -sha384 -binary | \
  openssl base64 -A
```

## Fallback URLs

If primary CDN is unavailable, use fallback:

```html
<script src="https://cdn.rag-assistant.com/v1/widget.js"></script>
<script>
  // Fallback to backup CDN
  if (typeof RAGAssistant === 'undefined') {
    document.write('<script src="https://cdn-backup.rag-assistant.com/v1/widget.js"><\/script>');
  }
</script>
```

## Version History

| Version | Release Date | CDN URL | Notes |
|---------|--------------|---------|-------|
| 1.0.0 | 2025-11-02 | `/v1.0.0/widget.min.js` | Initial release |
| 1.0.1 | TBD | `/v1.0.1/widget.min.js` | Bug fixes |
| 1.1.0 | TBD | `/v1.1.0/widget.min.js` | New features |

## Monitoring

### Check Widget Availability

```bash
curl -I https://cdn.rag-assistant.com/v1/widget.js
```

Expected response:
```
HTTP/2 200
content-type: application/javascript
cache-control: public, max-age=3600
x-cache: Hit from cloudfront
```

### Check Version

```bash
curl -s https://cdn.rag-assistant.com/v1/widget.js | head -n 1
```

Output:
```javascript
// RAG Assistant Widget v1.0.0
```

## Support

- **Status Page**: https://status.rag-assistant.com
- **Documentation**: https://docs.rag-assistant.com
- **Support Email**: support@rag-assistant.com
