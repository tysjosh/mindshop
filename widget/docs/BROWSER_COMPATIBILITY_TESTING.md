# Browser Compatibility Testing Guide

## Overview

This guide covers comprehensive browser compatibility testing for the RAG Assistant widget using Playwright, a modern cross-browser testing framework.

## Test Coverage

### Browsers Tested
- ✅ **Chromium** (Chrome, Edge, Opera)
- ✅ **Firefox**
- ✅ **WebKit** (Safari)
- ✅ **Mobile Chrome** (Android)
- ✅ **Mobile Safari** (iOS)

### Screen Sizes Tested
- Desktop: 1920x1080
- Laptop: 1366x768
- Tablet: 768x1024, 1024x768
- Mobile: 375x667

### Test Categories
1. **Basic Functionality** - Core widget features
2. **Interactions** - User interactions and programmatic control
3. **Responsive Design** - Behavior across screen sizes
4. **Integration** - Compatibility with jQuery, WordPress/WooCommerce
5. **Performance** - Load times, memory usage, frame rates

## Prerequisites

### 1. Install Dependencies

```bash
cd widget
npm install
```

This will install Playwright and all required dependencies.

### 2. Install Playwright Browsers

```bash
npx playwright install
```

This downloads the browser binaries for Chromium, Firefox, and WebKit.

### 3. Build the Widget

```bash
npm run build
```

The tests require the built widget files.

## Running Tests

### Run All Browser Tests

```bash
npm run test:browser
```

This runs all tests across all configured browsers and devices.

### Run Tests for Specific Browser

```bash
# Chromium only
npm run test:browser:chromium

# Firefox only
npm run test:browser:firefox

# WebKit (Safari) only
npm run test:browser:webkit

# Mobile browsers only
npm run test:browser:mobile
```

### Run Tests in UI Mode (Interactive)

```bash
npm run test:browser:ui
```

This opens Playwright's interactive UI where you can:
- See tests running in real-time
- Debug failing tests
- Inspect DOM and network requests
- Step through test execution

### Run Specific Test File

```bash
npx playwright test widget-basic.spec.ts
```

### Run Tests in Headed Mode (See Browser)

```bash
npx playwright test --headed
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug
```

## Test Results

### View HTML Report

After running tests, view the detailed HTML report:

```bash
npm run test:browser:report
```

This opens an interactive report showing:
- Test results by browser
- Screenshots of failures
- Videos of test execution
- Detailed error messages
- Performance metrics

### Test Artifacts

Test artifacts are saved in `test-results/browser-compat/`:
- `results.json` - Machine-readable test results
- `index.html` - HTML report
- Screenshots of failures
- Videos of failed tests
- Traces for debugging

## Test Structure

### Test Files

```
widget/tests/browser-compat/
├── widget-basic.spec.ts          # Basic functionality tests
├── widget-interaction.spec.ts    # Interaction tests
├── widget-responsive.spec.ts     # Responsive design tests
├── widget-integration.spec.ts    # Platform integration tests
└── widget-performance.spec.ts    # Performance tests
```

### Configuration

`playwright.config.ts` defines:
- Browser configurations
- Viewport sizes
- Test timeouts
- Reporter settings
- Web server configuration

## Test Scenarios

### 1. Basic Functionality Tests

- ✅ Widget script loads without errors
- ✅ Widget button is visible
- ✅ Widget opens when button is clicked
- ✅ Widget closes when close button is clicked
- ✅ Message input is functional
- ✅ Widget maintains position on scroll
- ✅ Widget loads within acceptable time

### 2. Interaction Tests

- ✅ Programmatic open works
- ✅ Programmatic close works
- ✅ Send message programmatically
- ✅ Get session ID works
- ✅ Clear history works
- ✅ Reset session creates new session

### 3. Responsive Design Tests

- ✅ Widget displays correctly on desktop (1920x1080)
- ✅ Widget displays correctly on laptop (1366x768)
- ✅ Widget displays correctly on tablet (768x1024)
- ✅ Widget displays correctly on mobile (375x667)
- ✅ Widget adapts to orientation change
- ✅ Widget text is readable on small screens

### 4. Integration Tests

**jQuery Integration:**
- ✅ Widget loads without jQuery conflicts
- ✅ Widget works with jQuery DOM manipulation

**WordPress/WooCommerce Integration:**
- ✅ Widget loads in WordPress environment
- ✅ No styling conflicts with WooCommerce
- ✅ Widget maintains functionality with WooCommerce scripts

**Callback Integration:**
- ✅ Add to cart callback fires
- ✅ Checkout callback fires

### 5. Performance Tests

- ✅ Widget loads within performance budget (< 2s)
- ✅ Widget script size is acceptable
- ✅ No memory leaks after multiple open/close cycles
- ✅ Animations run smoothly (> 30 FPS)
- ✅ Widget does not block page rendering
- ✅ Multiple rapid interactions do not cause issues

## Browser-Specific Considerations

### Chromium (Chrome, Edge)
- Full ES2020 support
- Best performance
- DevTools integration

### Firefox
- Excellent standards compliance
- Good performance
- May have slight CSS rendering differences

### WebKit (Safari)
- iOS Safari is the primary target
- May require vendor prefixes for some CSS
- Stricter security policies

### Mobile Browsers
- Touch events instead of mouse events
- Smaller viewports
- Performance considerations
- Network conditions may vary

## Troubleshooting

### Tests Fail to Start

**Issue:** Playwright browsers not installed
```bash
npx playwright install
```

**Issue:** Widget not built
```bash
npm run build
```

**Issue:** Port 8080 already in use
```bash
# Kill process using port 8080
lsof -ti:8080 | xargs kill -9
```

### Tests Timeout

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60 * 1000, // 60 seconds
```

### Flaky Tests

- Add explicit waits: `await page.waitForTimeout(1000)`
- Use `waitForSelector` instead of fixed timeouts
- Check for race conditions
- Ensure proper test isolation

### Screenshots/Videos Not Captured

Check configuration in `playwright.config.ts`:
```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Browser Compatibility Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd widget
          npm ci
      
      - name: Install Playwright browsers
        run: |
          cd widget
          npx playwright install --with-deps
      
      - name: Build widget
        run: |
          cd widget
          npm run build
      
      - name: Run browser tests
        run: |
          cd widget
          npm run test:browser
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: widget/test-results/browser-compat/
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` to set up clean state
- Don't rely on test execution order

### 2. Explicit Waits
- Use `waitForSelector` instead of fixed timeouts
- Wait for network requests to complete
- Wait for animations to finish

### 3. Selectors
- Use data attributes for test selectors
- Avoid brittle CSS selectors
- Use accessible selectors when possible

### 4. Assertions
- Use meaningful assertion messages
- Test both positive and negative cases
- Verify visual appearance, not just functionality

### 5. Performance
- Run tests in parallel when possible
- Use `fullyParallel: true` in config
- Optimize test setup/teardown

## Continuous Monitoring

### Regular Testing Schedule
- Run full browser suite before releases
- Run smoke tests on every commit
- Run full suite nightly in CI/CD

### Browser Version Updates
- Update Playwright regularly: `npm update @playwright/test`
- Install new browser versions: `npx playwright install`
- Test with beta browsers for early issue detection

### Metrics to Track
- Test pass rate by browser
- Test execution time
- Flaky test rate
- Coverage by feature

## Reporting Issues

When reporting browser compatibility issues, include:
1. Browser name and version
2. Operating system
3. Screen size/viewport
4. Steps to reproduce
5. Expected vs actual behavior
6. Screenshots/videos
7. Console errors
8. Network requests

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Browser Compatibility Data](https://caniuse.com/)
- [Web Platform Tests](https://wpt.fyi/)
- [MDN Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API)

## Summary

This comprehensive browser compatibility testing setup ensures the RAG Assistant widget works reliably across:
- ✅ All major desktop browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Different screen sizes and orientations
- ✅ Various integration scenarios (jQuery, WordPress/WooCommerce)
- ✅ Performance requirements

Run `npm run test:browser` to execute all tests and verify compatibility.
