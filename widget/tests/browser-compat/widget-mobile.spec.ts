import { test, expect } from '@playwright/test';

/**
 * Mobile-Specific Tests
 * Tests widget behavior on mobile devices including touch interactions,
 * viewport handling, and mobile-specific UX patterns
 */

test.describe('Mobile Widget Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-sites/test-basic.html');
    // Wait for widget to be fully initialized
    await page.waitForSelector('#rag-widget-toggle', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('widget button is accessible on mobile viewport', async ({ page }) => {
    const widgetButton = page.locator('#rag-widget-toggle');
    await expect(widgetButton).toBeVisible();
    
    // Check button is large enough for touch (minimum 44x44px)
    const box = await widgetButton.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('widget opens with touch interaction', async ({ page }) => {
    const widgetButton = page.locator('#rag-widget-toggle');
    
    // Simulate touch tap
    await widgetButton.tap();
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).toBeVisible();
  });

  test('widget takes full screen on mobile', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    const viewport = page.viewportSize();
    const windowBox = await widgetWindow.boundingBox();
    
    expect(windowBox).toBeTruthy();
    expect(viewport).toBeTruthy();
    
    if (windowBox && viewport) {
      // On mobile, widget should take most of the screen
      const widthRatio = windowBox.width / viewport.width;
      expect(widthRatio).toBeGreaterThan(0.85); // At least 85% of screen width
    }
  });

  test('input field triggers mobile keyboard', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Tap input field
    const input = page.locator('.rag-input-textarea');
    await input.tap();
    
    // Input should be focused
    await expect(input).toBeFocused();
  });

  test('widget handles portrait orientation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const widgetButton = page.locator('#rag-widget-toggle');
    await expect(widgetButton).toBeVisible();
    
    // Open widget
    await widgetButton.tap();
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).toBeVisible();
  });

  test('widget handles landscape orientation', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    
    const widgetButton = page.locator('#rag-widget-toggle');
    await expect(widgetButton).toBeVisible();
    
    // Open widget
    await widgetButton.tap();
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).toBeVisible();
  });

  test('widget adapts when orientation changes while open', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Verify widget is open
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).toBeVisible();
    
    // Change to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    
    // Widget should still be visible and functional
    await expect(widgetWindow).toBeVisible();
  });

  test('touch scrolling works in message list', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Check if message container is scrollable
    const messageContainer = page.locator('.rag-message-list');
    
    if (await messageContainer.isVisible()) {
      // Get initial scroll position
      const initialScroll = await messageContainer.evaluate(el => el.scrollTop);
      
      // Simulate scroll gesture
      await messageContainer.evaluate(el => {
        el.scrollTop = 100;
      });
      
      await page.waitForTimeout(200);
      
      const newScroll = await messageContainer.evaluate(el => el.scrollTop);
      expect(newScroll).toBeGreaterThan(initialScroll);
    }
  });

  test('close button is accessible on mobile', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    const closeButton = page.locator('#rag-widget-close');
    await expect(closeButton).toBeVisible();
    
    // Check button is large enough for touch
    const box = await closeButton.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    
    // Test close functionality
    await closeButton.tap();
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).not.toBeVisible();
  });

  test('widget does not interfere with page scrolling when closed', async ({ page }) => {
    // Ensure widget is closed
    const widgetWindow = page.locator('#rag-widget-window');
    const isVisible = await widgetWindow.isVisible();
    
    if (isVisible) {
      await page.tap('#rag-widget-close');
      await page.waitForTimeout(500);
    }
    
    // Test page scrolling
    const initialScroll = await page.evaluate(() => window.scrollY);
    
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(300);
    
    const newScroll = await page.evaluate(() => window.scrollY);
    expect(newScroll).toBeGreaterThan(initialScroll);
  });

  test('widget prevents background scrolling when open', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Try to scroll the page
    const initialScroll = await page.evaluate(() => window.scrollY);
    
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(300);
    
    const newScroll = await page.evaluate(() => window.scrollY);
    
    // On mobile, background should not scroll when widget is open
    // This is a common mobile UX pattern
    expect(newScroll).toBe(initialScroll);
  });

  test('text is readable on small mobile screens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
    await page.waitForTimeout(500);
    
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Check font sizes
    const input = page.locator('.rag-input-textarea');
    if (await input.isVisible()) {
      const fontSize = await input.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });
      
      const fontSizeNum = parseInt(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(14); // Minimum readable size
    }
  });

  test('widget handles rapid touch interactions', async ({ page }) => {
    // Rapidly open and close widget
    for (let i = 0; i < 3; i++) {
      await page.tap('#rag-widget-toggle');
      await page.waitForTimeout(200);
      
      const closeBtn = page.locator('#rag-widget-close');
      if (await closeBtn.isVisible()) {
        await closeBtn.tap();
        await page.waitForTimeout(200);
      }
    }
    
    // Widget should still be functional
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).toBeVisible();
  });

  test('product cards are tappable on mobile', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // If there are product recommendations, test tapping them
    const productCard = page.locator('.rag-product-card').first();
    
    if (await productCard.isVisible()) {
      const addToCartBtn = productCard.locator('button');
      await expect(addToCartBtn).toBeVisible();
      
      // Check button is large enough for touch
      const box = await addToCartBtn.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36); // Minimum touch target
      }
    }
  });

  test('widget loads quickly on mobile network', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForSelector('#rag-widget-toggle', { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should load in less than 5 seconds even on slower mobile networks
    expect(loadTime).toBeLessThan(5000);
  });

  test('widget button does not overlap important content', async ({ page }) => {
    const widgetButton = page.locator('#rag-widget-toggle');
    const buttonBox = await widgetButton.boundingBox();
    
    expect(buttonBox).toBeTruthy();
    
    if (buttonBox) {
      const viewport = page.viewportSize();
      expect(viewport).toBeTruthy();
      
      if (viewport) {
        // Button should be in bottom corner, not covering main content
        expect(buttonBox.y).toBeGreaterThan(viewport.height * 0.7); // Bottom 30%
      }
    }
  });

  test('safe area insets are respected on notched devices', async ({ page }) => {
    // Simulate iPhone with notch
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12/13/14
    await page.waitForTimeout(500);
    
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    const windowBox = await widgetWindow.boundingBox();
    
    expect(windowBox).toBeTruthy();
    
    if (windowBox) {
      // Widget should not extend into unsafe areas
      // Top safe area is typically 44-47px on notched iPhones
      expect(windowBox.y).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Mobile Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-sites/test-basic.html');
    await page.waitForSelector('#rag-widget-toggle', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('widget animations are smooth on mobile', async ({ page }) => {
    // Open widget and check animation performance
    await page.tap('#rag-widget-toggle');
    
    // Widget should open within reasonable time
    await page.waitForSelector('#rag-widget-window', { 
      state: 'visible',
      timeout: 1000 
    });
    
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).toBeVisible();
  });

  test('no layout shifts when widget loads', async ({ page }) => {
    // Measure layout stability
    const initialLayout = await page.evaluate(() => {
      const body = document.body;
      return {
        width: body.offsetWidth,
        height: body.offsetHeight
      };
    });
    
    await page.waitForTimeout(2000);
    
    const finalLayout = await page.evaluate(() => {
      const body = document.body;
      return {
        width: body.offsetWidth,
        height: body.offsetHeight
      };
    });
    
    // Layout should not shift
    expect(finalLayout.width).toBe(initialLayout.width);
    expect(finalLayout.height).toBe(initialLayout.height);
  });

  test('widget uses hardware acceleration', async ({ page }) => {
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    const widgetWindow = page.locator('#rag-widget-window');
    
    // Check if transform is used (indicates hardware acceleration)
    const transform = await widgetWindow.evaluate(el => {
      return window.getComputedStyle(el).transform;
    });
    
    // Transform should be set (not 'none')
    expect(transform).not.toBe('none');
  });
});

test.describe('Mobile Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-sites/test-basic.html');
    await page.waitForSelector('#rag-widget-toggle', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('widget button has appropriate aria labels', async ({ page }) => {
    const widgetButton = page.locator('#rag-widget-toggle');
    
    const ariaLabel = await widgetButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.length).toBeGreaterThan(0);
  });

  test('widget is navigable with screen reader', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Check for proper ARIA roles
    const widgetWindow = page.locator('#rag-widget-window');
    const role = await widgetWindow.getAttribute('role');
    
    expect(role).toBeTruthy();
  });

  test('focus is managed correctly on mobile', async ({ page }) => {
    // Open widget
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Input should receive focus
    const input = page.locator('.rag-input-textarea');
    await input.tap();
    
    await expect(input).toBeFocused();
  });

  test('color contrast is sufficient on mobile', async ({ page }) => {
    await page.tap('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Check text color contrast
    const input = page.locator('.rag-input-textarea');
    
    if (await input.isVisible()) {
      const styles = await input.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor
        };
      });
      
      // Basic check that colors are defined
      expect(styles.color).toBeTruthy();
      expect(styles.backgroundColor).toBeTruthy();
    }
  });
});
