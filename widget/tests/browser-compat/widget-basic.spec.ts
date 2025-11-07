import { test, expect } from '@playwright/test';

/**
 * Basic Widget Functionality Tests
 * Tests core widget features across all browsers
 */

test.describe('Widget Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to basic test site with mocked API
    await page.goto('/test-sites/test-basic.html');
    
    // Wait for widget to be fully initialized (check for widget container)
    await page.waitForSelector('#rag-widget-toggle', { timeout: 10000 });
    await page.waitForTimeout(500); // Additional wait for any animations
  });

  test('widget script loads without errors', async ({ page }) => {
    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for any errors to appear
    await page.waitForTimeout(1000);

    // Should have no errors
    expect(errors.length).toBe(0);
  });

  test('widget button is visible', async ({ page }) => {
    // Check if widget button exists and is visible
    const widgetButton = page.locator('#rag-widget-toggle');
    await expect(widgetButton).toBeVisible();
  });

  test('widget opens when button is clicked', async ({ page }) => {
    // Click the widget button
    await page.click('#rag-widget-toggle');
    
    // Wait for widget to open
    await page.waitForTimeout(500);
    
    // Check if widget window is visible
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).toBeVisible();
  });

  test('widget closes when close button is clicked', async ({ page }) => {
    // Open widget
    await page.click('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Click close button
    await page.click('#rag-widget-close');
    await page.waitForTimeout(500);
    
    // Widget window should be hidden
    const widgetWindow = page.locator('#rag-widget-window');
    await expect(widgetWindow).not.toBeVisible();
  });

  test('message input is functional', async ({ page }) => {
    // Open widget
    await page.click('#rag-widget-toggle');
    await page.waitForTimeout(500);
    
    // Find input field
    const input = page.locator('.rag-input-textarea');
    await expect(input).toBeVisible();
    
    // Type a message
    await input.fill('Test message');
    
    // Verify text was entered
    await expect(input).toHaveValue('Test message');
  });

  test('widget maintains position on scroll', async ({ page }) => {
    // Get initial position
    const widgetButton = page.locator('#rag-widget-toggle');
    const initialBox = await widgetButton.boundingBox();
    
    // Scroll page
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    
    // Get position after scroll
    const afterScrollBox = await widgetButton.boundingBox();
    
    // Position should be fixed (same viewport position)
    expect(initialBox?.x).toBe(afterScrollBox?.x);
    expect(initialBox?.y).toBe(afterScrollBox?.y);
  });

  test('widget loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to page
    await page.goto('/test-sites/test-basic.html');
    
    // Wait for widget to be ready
    await page.waitForSelector('#rag-widget-toggle', { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    
    // Should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});
