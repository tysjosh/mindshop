# RAG Assistant Widget - Test Sites

This directory contains comprehensive test sites for validating the RAG Assistant widget integration across different platforms and scenarios.

## 📁 Test Sites

### 1. Vanilla HTML (`vanilla-html.html`)
**Purpose:** Test widget in pure HTML environment with no frameworks

**Features:**
- Direct script tag integration
- No build tools or dependencies
- Simple product catalog
- All widget control functions
- Console logging and status tracking
- Callback integration testing

**Use Case:** Validates basic widget functionality and ensures it works in the simplest possible environment.

### 2. jQuery Site (`jquery-site.html`)
**Purpose:** Test widget with jQuery library integration

**Features:**
- jQuery-based DOM manipulation
- Dynamic product loading
- Shopping cart functionality
- Event handling with jQuery
- Real-time cart updates
- Comprehensive event logging

**Use Case:** Validates widget works with jQuery, one of the most popular JavaScript libraries still in use.

### 3. WordPress/WooCommerce Simulation (`wordpress-simulation.html`)
**Purpose:** Simulate WordPress/WooCommerce environment

**Features:**
- Authentic WooCommerce styling
- WordPress admin bar
- Product grid with ratings
- Breadcrumb navigation
- Sale badges and pricing
- WooCommerce-style UI components

**Use Case:** Validates widget integration in the most popular e-commerce platform (WooCommerce powers 30%+ of online stores).

## 🚀 Quick Start

### Prerequisites
1. Build the widget first:
```bash
cd widget
npm install
npm run build
```

### Running Tests

#### Option 1: Open Directly
Simply open any HTML file in your browser:
```bash
# From the widget/examples/test-sites directory
open vanilla-html.html
# or
open jquery-site.html
# or
open wordpress-simulation.html
```

#### Option 2: Use Local Server
For better testing (especially for API calls):
```bash
# From the widget directory
npm run serve
```
Then navigate to:
- http://localhost:8080/test-sites/vanilla-html.html
- http://localhost:8080/test-sites/jquery-site.html
- http://localhost:8080/test-sites/wordpress-simulation.html

#### Option 3: Use Test Index
Open the test index page:
```bash
open index.html
```
This provides a dashboard with links to all test sites and testing instructions.

## 🧪 Testing Checklist

### Functional Tests

#### Widget Loading
- [ ] Widget script loads without errors
- [ ] Widget initializes successfully
- [ ] Widget appears in correct position (bottom-right by default)
- [ ] Widget doesn't block page load
- [ ] No console errors during initialization

#### Widget Controls
- [ ] Open button works
- [ ] Close button works
- [ ] Widget can be toggled multiple times
- [ ] Send message function works
- [ ] Clear history function works
- [ ] Reset session function works
- [ ] Get session ID function works

#### Callbacks
- [ ] Add to cart callback fires correctly
- [ ] Checkout callback fires correctly
- [ ] Analytics callback fires for events
- [ ] Callback parameters are correct
- [ ] Multiple callbacks can be registered

#### Session Management
- [ ] Session persists across page reloads
- [ ] Session ID is consistent
- [ ] Message history is saved
- [ ] Clear history removes messages
- [ ] Reset session creates new session

#### Visual/UI Tests
- [ ] Widget button is visible
- [ ] Widget opens smoothly
- [ ] Widget closes smoothly
- [ ] Messages display correctly
- [ ] Product cards render properly
- [ ] Typing indicator shows
- [ ] Error states display correctly

### Cross-Browser Tests
Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Responsive Tests
Test on:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Mobile landscape

### Performance Tests
- [ ] Widget loads in < 2 seconds
- [ ] Page load time not significantly impacted
- [ ] No memory leaks after extended use
- [ ] Smooth animations (60fps)
- [ ] API calls complete in reasonable time

### Edge Cases
- [ ] Widget works with ad blockers
- [ ] Widget works with strict CSP
- [ ] Widget handles network errors gracefully
- [ ] Widget handles API errors gracefully
- [ ] Widget works with slow connections
- [ ] Widget works offline (graceful degradation)

## 📊 Test Results Template

Use this template to document test results:

```markdown
## Test Run: [Date]

### Environment
- Browser: [Chrome 120.0]
- OS: [macOS 14.0]
- Device: [MacBook Pro]
- Widget Version: [1.0.0]

### Test Site: [vanilla-html.html]

#### Functional Tests
- Widget Loading: ✅ PASS
- Widget Controls: ✅ PASS
- Callbacks: ✅ PASS
- Session Management: ✅ PASS
- Visual/UI: ✅ PASS

#### Issues Found
1. [Issue description]
   - Severity: [Low/Medium/High/Critical]
   - Steps to reproduce: [...]
   - Expected: [...]
   - Actual: [...]

#### Notes
[Any additional observations]
```

## 🐛 Common Issues and Solutions

### Issue: Widget doesn't load
**Solution:** 
- Check that widget.js is built: `npm run build`
- Check browser console for errors
- Verify script path is correct
- Check for CORS issues if using local server

### Issue: Callbacks not firing
**Solution:**
- Verify callback functions are defined
- Check console for JavaScript errors
- Ensure widget is initialized before calling methods
- Verify callback syntax is correct

### Issue: Widget appears but doesn't respond
**Solution:**
- Check API endpoint is accessible
- Verify API key is valid
- Check network tab for failed requests
- Ensure merchantId is correct

### Issue: Styling conflicts
**Solution:**
- Check for CSS conflicts with site styles
- Verify z-index is high enough
- Check for !important rules overriding widget styles
- Test with widget in isolation

## 📝 Adding New Test Sites

To add a new test site:

1. Create a new HTML file in this directory
2. Include the widget script:
```html
<script src="../../dist/widget.js"></script>
```

3. Initialize the widget:
```javascript
const assistant = new RAGAssistant({
  merchantId: 'test_[platform]_2024',
  apiKey: 'pk_test_[platform]_key',
  // ... configuration
});
```

4. Add test controls and logging
5. Update `index.html` to include the new test site
6. Update this README with test site details

## 🔍 Debugging Tips

### Enable Verbose Logging
```javascript
const assistant = new RAGAssistant({
  // ... config
  debug: true // Enable debug mode
});
```

### Monitor Network Requests
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "widget" or "api"
4. Check request/response details

### Check Console Output
All test sites include console logging. Check for:
- Initialization messages
- Event logs
- Error messages
- Callback executions

### Inspect Widget State
```javascript
// In browser console
console.log(window.assistantInstance);
console.log(window.assistantInstance.getSessionId());
```

## 📚 Additional Resources

- [Widget Documentation](../../README.md)
- [Integration Guide](../../EMBED_GUIDE.md)
- [API Reference](../../docs/api-reference.md)
- [Troubleshooting Guide](../../docs/troubleshooting.md)

## ✅ Test Completion

Once all tests pass:
1. Document results using the template above
2. Create a test report summarizing findings
3. File issues for any bugs found
4. Update widget version if fixes are needed
5. Re-test after fixes are applied

## 🎯 Success Criteria

Tests are considered successful when:
- ✅ All functional tests pass
- ✅ Widget works on all major browsers
- ✅ Widget is responsive on all device sizes
- ✅ No critical or high-severity bugs
- ✅ Performance meets requirements
- ✅ All callbacks work correctly
- ✅ No console errors in normal operation

---

**Last Updated:** 2024-11-02
**Test Sites Version:** 1.0.0
**Widget Version:** 1.0.0
