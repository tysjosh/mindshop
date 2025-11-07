import { test, expect } from '@playwright/test';

/**
 * Widget Interaction Tests
 * Tests user interactions and callbacks across browsers
 */

test.describe('Widget Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(2000);
  });

  test('programmatic open works', async ({ page }) => {
    // Call programmatic open
    await page.evaluate(() => {
      (window as any).ragAssistant.open();
    });
    
    await page.waitForTimeout(500);
    
    // Widget should be visible
    const widgetContainer = page.locator('#rag-assistant-widget');
    await expect(widgetContainer).toBeVisible();
  });

  test('programmatic close works', async ({ page }) => {
    // Open widget first
    await page.evaluate(() => {
      (window as any).ragAssistant.open();
    });
    await page.waitForTimeout(500);
    
    // Close programmatically
    await page.evaluate(() => {
      (window as any).ragAssistant.close();
    });
    await page.waitForTimeout(500);
    
    // Widget should be hidden
    const widgetContainer = page.locator('#rag-assistant-widget');
    await expect(widgetContainer).not.toBeVisible();
  });

  test('send message programmatically', async ({ page }) => {
    // Open widget
    await page.evaluate(() => {
      (window as any).ragAssistant.open();
    });
    await page.waitForTimeout(500);
    
    // Send message
    await page.evaluate(() => {
      (window as any).ragAssistant.sendMessage('Hello from test');
    });
    
    await page.waitForTimeout(1000);
    
    // Check if message appears in chat
    const messages = page.locator('.rag-message');
    await expect(messages).toHaveCount(1);
  });

  test('get session ID works', async ({ page }) => {
    const sessionId = await page.evaluate(() => {
      return (window as any).ragAssistant.getSessionId();
    });
    
    // Session ID should be a non-empty string
    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe('string');
  });

  test('clear history works', async ({ page }) => {
    // Open widget and send a message
    await page.evaluate(() => {
      (window as any).ragAssistant.open();
      (window as any).ragAssistant.sendMessage('Test message');
    });
    await page.waitForTimeout(1000);
    
    // Clear history
    await page.evaluate(() => {
      (window as any).ragAssistant.clearHistory();
    });
    await page.waitForTimeout(500);
    
    // Messages should be cleared
    const messages = page.locator('.rag-message');
    await expect(messages).toHaveCount(0);
  });

  test('reset session creates new session', async ({ page }) => {
    // Get initial session ID
    const initialSessionId = await page.evaluate(() => {
      return (window as any).ragAssistant.getSessionId();
    });
    
    // Reset session
    await page.evaluate(() => {
      (window as any).ragAssistant.resetSession();
    });
    await page.waitForTimeout(500);
    
    // Get new session ID
    const newSessionId = await page.evaluate(() => {
      return (window as any).ragAssistant.getSessionId();
    });
    
    // Session IDs should be different
    expect(newSessionId).not.toBe(initialSessionId);
  });
});
