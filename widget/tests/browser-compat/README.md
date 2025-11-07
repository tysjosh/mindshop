# Browser Compatibility Tests

This directory contains automated cross-browser tests for the RAG Assistant widget using Playwright.

## Test Files

### `widget-basic.spec.ts`
Tests core widget functionality:
- Script loading without errors
- Widget button visibility
- Open/close functionality
- Message input
- Position on scroll
- Load time performance

### `widget-interaction.spec.ts`
Tests user interactions and programmatic control:
- Programmatic open/close
- Send message programmatically
- Get session ID
- Clear history
- Reset session

### `widget-responsive.spec.ts`
Tests responsive design across screen sizes:
- Desktop (1920x1080)
- Laptop (1366x768)
- Tablet (768x1024)
- Mobile (375x667)
- Orientation changes
- Text readability

### `widget-integration.spec.ts`
Tests platform integration:
- jQuery compatibility
- WordPress/WooCommerce integration
- Callback functionality (add to cart, checkout)
- No conflicts with other libraries

### `widget-performance.spec.ts`
Tests performance metrics:
- Load time < 2 seconds
- Script size
- Memory leaks
- Animation frame rate
- Render blocking
- Rapid interaction handling

## Running Tests

```bash
# From widget directory

# All tests, all browsers
npm run test:browser

# Specific browser
npm run test:browser:chromium
npm run test:browser:firefox
npm run test:browser:webkit

# Mobile browsers
npm run test:browser:mobile

# Interactive UI
npm run test:browser:ui

# View report
npm run test:browser:report
```

## Test Structure

Each test file follows this pattern:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Test Category', () => {
  test.beforeEach(async ({ page }) => {
    // Setup - navigate to test page
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(2000);
  });

  test('specific functionality', async ({ page }) => {
    // Test implementation
    // Assertions
  });
});
```

## Browser Configuration

Tests run on these browsers (configured in `playwright.config.ts`):
- **chromium** - Chrome, Edge, Opera
- **firefox** - Firefox
- **webkit** - Safari
- **mobile-chrome** - Android Chrome (Pixel 5)
- **mobile-safari** - iOS Safari (iPhone 13)
- **tablet-safari** - iPad Pro
- **laptop** - 1366x768 viewport
- **tablet-landscape** - 1024x768 viewport

## Test Artifacts

After running tests, artifacts are saved in `test-results/browser-compat/`:
- HTML report with test results
- Screenshots of failures
- Videos of failed tests
- JSON results for CI/CD integration

## Writing New Tests

1. Create a new `.spec.ts` file in this directory
2. Import Playwright test utilities
3. Use `test.describe()` to group related tests
4. Use `test.beforeEach()` for setup
5. Write tests with clear descriptions
6. Use meaningful assertions

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('New Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/test-sites/vanilla-html.html');
  });

  test('feature works correctly', async ({ page }) => {
    // Test implementation
    const element = page.locator('#my-element');
    await expect(element).toBeVisible();
  });
});
```

## Best Practices

1. **Use explicit waits** - `waitForSelector()` instead of fixed timeouts
2. **Test isolation** - Each test should be independent
3. **Meaningful selectors** - Use data attributes or IDs
4. **Clear assertions** - Test both positive and negative cases
5. **Handle async** - Always await async operations
6. **Clean up** - Tests should not leave side effects

## Debugging

```bash
# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode (step through tests)
npx playwright test --debug

# Run specific test
npx playwright test widget-basic.spec.ts

# Run specific test by name
npx playwright test -g "widget opens"
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:
- Headless by default
- Retry on failure (in CI)
- Generate JSON results
- Capture screenshots/videos on failure

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Test API Reference](https://playwright.dev/docs/api/class-test)
- [Assertions](https://playwright.dev/docs/test-assertions)
- [Selectors](https://playwright.dev/docs/selectors)
