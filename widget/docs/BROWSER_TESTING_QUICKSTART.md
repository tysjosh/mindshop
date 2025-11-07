# Browser Compatibility Testing - Quick Start

## 🚀 Quick Start (5 minutes)

### 1. Install & Setup

```bash
cd widget

# Install dependencies (includes Playwright)
npm install

# Install browser binaries
npx playwright install

# Build the widget
npm run build
```

### 2. Run Tests

```bash
# Run all browser tests
npm run test:browser

# Or use the convenience script
./run-browser-tests.sh
```

### 3. View Results

```bash
# Open HTML report
npm run test:browser:report
```

---

## 📊 What Gets Tested

### Browsers
- ✅ Chrome/Chromium
- ✅ Firefox  
- ✅ Safari/WebKit
- ✅ Edge
- ✅ Mobile Chrome (Android)
- ✅ Mobile Safari (iOS)

### Test Categories (32 total tests)
- **Basic Functionality** (7 tests) - Widget loads, opens, closes
- **Interactions** (6 tests) - Programmatic control, session management
- **Responsive Design** (6 tests) - Desktop, tablet, mobile layouts
- **Integration** (7 tests) - jQuery, WordPress/WooCommerce compatibility
- **Performance** (6 tests) - Load time, memory, animations

---

## 🎯 Common Commands

```bash
# Test specific browser
npm run test:browser:chromium   # Chrome only
npm run test:browser:firefox    # Firefox only
npm run test:browser:webkit     # Safari only
npm run test:browser:mobile     # Mobile browsers

# Interactive mode (recommended for debugging)
npm run test:browser:ui

# Show browser while testing
npx playwright test --headed

# Debug mode
npx playwright test --debug

# Run specific test file
npx playwright test widget-basic.spec.ts
```

---

## 📁 Files Created

```
widget/
├── playwright.config.ts                      # Test configuration
├── run-browser-tests.sh                      # Convenience script
├── BROWSER_COMPATIBILITY_TESTING.md          # Full guide
├── BROWSER_COMPATIBILITY_RESULTS.md          # Results template
├── BROWSER_TESTING_QUICKSTART.md            # This file
└── tests/browser-compat/
    ├── widget-basic.spec.ts                 # Basic functionality
    ├── widget-interaction.spec.ts           # Interactions
    ├── widget-responsive.spec.ts            # Responsive design
    ├── widget-integration.spec.ts           # Platform integration
    └── widget-performance.spec.ts           # Performance tests
```

---

## 🐛 Troubleshooting

### "Playwright browsers not installed"
```bash
npx playwright install
```

### "Widget not built"
```bash
npm run build
```

### "Port 8080 already in use"
```bash
lsof -ti:8080 | xargs kill -9
```

### Tests are flaky
- Run in headed mode to see what's happening: `npx playwright test --headed`
- Use debug mode: `npx playwright test --debug`
- Check the HTML report for screenshots/videos

---

## 📈 Success Criteria

✅ All tests pass across all browsers
✅ No console errors
✅ Load time < 2 seconds
✅ Smooth animations (> 30 FPS)
✅ No memory leaks
✅ Works on mobile devices

---

## 🔗 Resources

- **Full Guide:** `BROWSER_COMPATIBILITY_TESTING.md`
- **Results Template:** `BROWSER_COMPATIBILITY_RESULTS.md`
- **Playwright Docs:** https://playwright.dev/
- **Test Files:** `tests/browser-compat/`

---

## ✅ Next Steps

1. Run the tests: `npm run test:browser`
2. View the report: `npm run test:browser:report`
3. Fix any failures
4. Update `BROWSER_COMPATIBILITY_RESULTS.md` with results
5. Commit the passing tests

---

**Need Help?** Check `BROWSER_COMPATIBILITY_TESTING.md` for detailed documentation.
