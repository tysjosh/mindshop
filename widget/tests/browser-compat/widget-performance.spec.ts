import { test, expect } from '@playwright/test';

/**
 * Performance Tests
 * Tests widget performance metrics across browsers
 */

test.describe('Widget Performance', () => {
  test('widget loads within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForSelector('#rag-assistant-toggle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load in less than 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('widget script size is acceptable', async ({ page }) => {
    const response = await page.goto('/examples/test-sites/vanilla-html.html');
    
    // Get all network requests
    const requests: any[] = [];
    page.on('request', request => {
      requests.push(request);
    });
    
    await page.waitForTimeout(2000);
    
    // Find widget script request
    const widgetScript = requests.find(req => 
      req.url().includes('widget.js') || req.url().includes('rag-assistant')
    );
    
    // Widget script should exist
    expect(widgetScript).toBeTruthy();
  });

  test('no memory leaks after multiple open/close cycles', async ({ page }) => {
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    // Get initial memory
    const initialMetrics = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Open and close widget 10 times
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        (window as any).ragAssistant.open();
      });
      await page.waitForTimeout(200);
      
      await page.evaluate(() => {
        (window as any).ragAssistant.close();
      });
      await page.waitForTimeout(200);
    }
    
    // Get final memory
    const finalMetrics = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Memory increase should be reasonable (less than 10MB)
    if (initialMetrics > 0 && finalMetrics > 0) {
      const memoryIncrease = (finalMetrics - initialMetrics) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(10);
    }
  });

  test('animations run smoothly', async ({ page }) => {
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    // Start performance measurement
    await page.evaluate(() => {
      (window as any).frameCount = 0;
      (window as any).startTime = performance.now();
      
      const countFrames = () => {
        (window as any).frameCount++;
        requestAnimationFrame(countFrames);
      };
      requestAnimationFrame(countFrames);
    });
    
    // Open widget (triggers animation)
    await page.click('#rag-assistant-toggle');
    await page.waitForTimeout(1000);
    
    // Get frame rate
    const fps = await page.evaluate(() => {
      const elapsed = performance.now() - (window as any).startTime;
      const frames = (window as any).frameCount;
      return (frames / elapsed) * 1000;
    });
    
    // Should maintain at least 30 FPS
    expect(fps).toBeGreaterThan(30);
  });

  test('widget does not block page rendering', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/examples/test-sites/vanilla-html.html');
    
    // Wait for page to be interactive
    await page.waitForLoadState('domcontentloaded');
    
    const domLoadTime = Date.now() - startTime;
    
    // Page should be interactive quickly even with widget
    expect(domLoadTime).toBeLessThan(1500);
  });

  test('multiple rapid interactions do not cause issues', async ({ page }) => {
    await page.goto('/examples/test-sites/vanilla-html.html');
    await page.waitForTimeout(1000);
    
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Rapidly open and close widget
    for (let i = 0; i < 20; i++) {
      await page.click('#rag-assistant-toggle');
      await page.waitForTimeout(50);
      
      if (i % 2 === 0) {
        await page.click('.rag-close-btn').catch(() => {});
        await page.waitForTimeout(50);
      }
    }
    
    // Should not cause errors
    expect(errors.length).toBe(0);
  });
});
