import { test, expect } from '@playwright/test';

/**
 * Responsive Design Tests
 * Tests widget behavior across different screen sizes
 */

test.describe('Widget Responsive Behavior', () => {
  test('widget displays correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    const widgetButton = page.locator('#rag-assistant-toggle');
    await expect(widgetButton).toBeVisible();
    
    // Check button position (should be bottom-right)
    const box = await widgetButton.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.x).toBeGreaterThan(1700); // Right side
      expect(box.y).toBeGreaterThan(900);  // Bottom
    }
  });

  test('widget displays correctly on laptop', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    const widgetButton = page.locator('#rag-assistant-toggle');
    await expect(widgetButton).toBeVisible();
  });

  test('widget displays correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    const widgetButton = page.locator('#rag-assistant-toggle');
    await expect(widgetButton).toBeVisible();
    
    // Open widget
    await widgetButton.click();
    await page.waitForTimeout(500);
    
    // Widget should be visible and properly sized
    const widgetContainer = page.locator('#rag-assistant-widget');
    await expect(widgetContainer).toBeVisible();
    
    const containerBox = await widgetContainer.boundingBox();
    expect(containerBox).toBeTruthy();
    if (containerBox) {
      // Widget should not exceed viewport width
      expect(containerBox.width).toBeLessThanOrEqual(768);
    }
  });

  test('widget displays correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    const widgetButton = page.locator('#rag-assistant-toggle');
    await expect(widgetButton).toBeVisible();
    
    // Open widget
    await widgetButton.click();
    await page.waitForTimeout(500);
    
    // Widget should be visible
    const widgetContainer = page.locator('#rag-assistant-widget');
    await expect(widgetContainer).toBeVisible();
    
    const containerBox = await widgetContainer.boundingBox();
    expect(containerBox).toBeTruthy();
    if (containerBox) {
      // Widget should not exceed viewport width
      expect(containerBox.width).toBeLessThanOrEqual(375);
    }
  });

  test('widget adapts to orientation change', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    const widgetButton = page.locator('#rag-assistant-toggle');
    await expect(widgetButton).toBeVisible();
    
    // Change to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    
    // Widget should still be visible
    await expect(widgetButton).toBeVisible();
  });

  test('widget text is readable on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    // Open widget
    await page.click('#rag-assistant-toggle');
    await page.waitForTimeout(500);
    
    // Check if text elements have appropriate font size
    const input = page.locator('.rag-input');
    const fontSize = await input.evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    });
    
    // Font size should be at least 14px for readability
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(14);
  });
});
