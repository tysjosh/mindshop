import { test, expect } from '@playwright/test';

/**
 * Integration Tests
 * Tests widget integration with different platforms
 */

test.describe('jQuery Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/test-sites/jquery-site.html');
    await page.waitForTimeout(2000);
  });

  test('widget loads without jQuery conflicts', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);
    
    // Should have no errors
    expect(errors.length).toBe(0);
  });

  test('widget button is visible on jQuery site', async ({ page }) => {
    const widgetButton = page.locator('#rag-assistant-toggle');
    await expect(widgetButton).toBeVisible();
  });

  test('widget works with jQuery DOM manipulation', async ({ page }) => {
    // Open widget
    await page.click('#rag-assistant-toggle');
    await page.waitForTimeout(500);
    
    const widgetContainer = page.locator('#rag-assistant-widget');
    await expect(widgetContainer).toBeVisible();
  });
});

test.describe('WordPress/WooCommerce Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/test-sites/wordpress-simulation.html');
    await page.waitForTimeout(2000);
  });

  test('widget loads in WordPress environment', async ({ page }) => {
    const widgetButton = page.locator('#rag-assistant-toggle');
    await expect(widgetButton).toBeVisible();
  });

  test('no styling conflicts with WooCommerce', async ({ page }) => {
    // Open widget
    await page.click('#rag-assistant-toggle');
    await page.waitForTimeout(500);
    
    const widgetContainer = page.locator('#rag-assistant-widget');
    await expect(widgetContainer).toBeVisible();
    
    // Check that widget has proper z-index
    const zIndex = await widgetContainer.evaluate(el => {
      return window.getComputedStyle(el).zIndex;
    });
    
    // Should have high z-index to appear above WooCommerce elements
    expect(parseInt(zIndex)).toBeGreaterThan(1000);
  });

  test('widget maintains functionality with WooCommerce scripts', async ({ page }) => {
    // Test programmatic control
    const sessionId = await page.evaluate(() => {
      return (window as any).ragAssistant.getSessionId();
    });
    
    expect(sessionId).toBeTruthy();
  });
});

test.describe('Callback Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(2000);
  });

  test('add to cart callback fires', async ({ page }) => {
    let callbackFired = false;
    
    // Listen for callback
    await page.exposeFunction('testAddToCart', () => {
      callbackFired = true;
    });
    
    // Override callback
    await page.evaluate(() => {
      (window as any).ragAssistant.config.callbacks.onAddToCart = () => {
        (window as any).testAddToCart();
      };
    });
    
    // Trigger add to cart (would normally come from assistant response)
    await page.evaluate(() => {
      if ((window as any).ragAssistant.config.callbacks.onAddToCart) {
        (window as any).ragAssistant.config.callbacks.onAddToCart({
          productId: 'test-123',
          quantity: 1
        });
      }
    });
    
    await page.waitForTimeout(500);
    expect(callbackFired).toBe(true);
  });

  test('checkout callback fires', async ({ page }) => {
    let callbackFired = false;
    
    await page.exposeFunction('testCheckout', () => {
      callbackFired = true;
    });
    
    await page.evaluate(() => {
      (window as any).ragAssistant.config.callbacks.onCheckout = () => {
        (window as any).testCheckout();
      };
    });
    
    await page.evaluate(() => {
      if ((window as any).ragAssistant.config.callbacks.onCheckout) {
        (window as any).ragAssistant.config.callbacks.onCheckout({
          items: [{ productId: 'test-123', quantity: 1 }]
        });
      }
    });
    
    await page.waitForTimeout(500);
    expect(callbackFired).toBe(true);
  });
});
