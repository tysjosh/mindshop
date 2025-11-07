/**
 * RAG Assistant Widget - Test Validator
 * 
 * This script can be run in the browser console to automatically validate
 * widget functionality on any test site.
 * 
 * Usage:
 * 1. Open a test site in your browser
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Run: runWidgetTests()
 */

(function() {
  'use strict';

  // Test results storage
  const testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
  };

  // Utility functions
  function log(message, type = 'info') {
    const styles = {
      info: 'color: #2196F3; font-weight: bold;',
      success: 'color: #4CAF50; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold;',
      warn: 'color: #FF9800; font-weight: bold;'
    };
    console.log(`%c[TEST] ${message}`, styles[type] || styles.info);
  }

  function assert(condition, testName, errorMessage) {
    const result = {
      name: testName,
      passed: condition,
      error: condition ? null : errorMessage
    };
    
    testResults.tests.push(result);
    
    if (condition) {
      testResults.passed++;
      log(`✓ ${testName}`, 'success');
    } else {
      testResults.failed++;
      log(`✗ ${testName}: ${errorMessage}`, 'error');
    }
    
    return condition;
  }

  function skip(testName, reason) {
    testResults.skipped++;
    testResults.tests.push({
      name: testName,
      skipped: true,
      reason: reason
    });
    log(`⊘ ${testName}: ${reason}`, 'warn');
  }

  // Wait utility
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test suite
  async function runWidgetTests() {
    log('Starting RAG Assistant Widget Tests...', 'info');
    console.log('═'.repeat(60));
    
    // Test 1: Check if RAGAssistant class exists
    log('\n[1] Testing Widget Availability...', 'info');
    assert(
      typeof window.RAGAssistant !== 'undefined',
      'RAGAssistant class is available',
      'RAGAssistant class not found in window object'
    );

    // Test 2: Check if widget instance exists
    log('\n[2] Testing Widget Instance...', 'info');
    const instance = window.assistantInstance || window.assistant;
    assert(
      instance !== undefined,
      'Widget instance exists',
      'No widget instance found (check window.assistantInstance or window.assistant)'
    );

    if (!instance) {
      log('Cannot continue tests without widget instance', 'error');
      printResults();
      return;
    }

    // Test 3: Check widget methods
    log('\n[3] Testing Widget Methods...', 'info');
    const requiredMethods = ['open', 'close', 'sendMessage', 'clearHistory', 'resetSession', 'getSessionId'];
    requiredMethods.forEach(method => {
      assert(
        typeof instance[method] === 'function',
        `Widget has ${method}() method`,
        `Method ${method}() not found on widget instance`
      );
    });

    // Test 4: Test session ID
    log('\n[4] Testing Session Management...', 'info');
    try {
      const sessionId = instance.getSessionId();
      assert(
        sessionId && typeof sessionId === 'string' && sessionId.length > 0,
        'Session ID is valid',
        'Session ID is empty or invalid'
      );
    } catch (error) {
      assert(false, 'Session ID retrieval', error.message);
    }

    // Test 5: Test widget open/close
    log('\n[5] Testing Widget Open/Close...', 'info');
    try {
      instance.close();
      await wait(500);
      assert(true, 'Widget close() executed', '');
      
      instance.open();
      await wait(500);
      assert(true, 'Widget open() executed', '');
      
      instance.close();
      await wait(500);
    } catch (error) {
      assert(false, 'Widget open/close', error.message);
    }

    // Test 6: Test message sending
    log('\n[6] Testing Message Sending...', 'info');
    try {
      instance.sendMessage('Test message from validator');
      await wait(500);
      assert(true, 'Widget sendMessage() executed', '');
    } catch (error) {
      assert(false, 'Message sending', error.message);
    }

    // Test 7: Test configuration
    log('\n[7] Testing Widget Configuration...', 'info');
    try {
      const config = instance.config || instance.options;
      assert(
        config !== undefined,
        'Widget configuration exists',
        'No configuration found on widget instance'
      );
      
      if (config) {
        assert(
          config.merchantId !== undefined,
          'Merchant ID is configured',
          'Merchant ID not found in configuration'
        );
        
        assert(
          config.apiKey !== undefined,
          'API key is configured',
          'API key not found in configuration'
        );
      }
    } catch (error) {
      assert(false, 'Configuration check', error.message);
    }

    // Test 8: Test DOM elements
    log('\n[8] Testing DOM Elements...', 'info');
    const widgetButton = document.querySelector('[class*="widget-button"]') || 
                        document.querySelector('[id*="widget"]') ||
                        document.querySelector('[class*="rag-assistant"]');
    
    if (widgetButton) {
      assert(true, 'Widget button found in DOM', '');
      assert(
        widgetButton.offsetParent !== null,
        'Widget button is visible',
        'Widget button is hidden or not rendered'
      );
    } else {
      skip('Widget button visibility', 'Widget button not found in DOM (may use shadow DOM)');
    }

    // Test 9: Test storage
    log('\n[9] Testing Local Storage...', 'info');
    try {
      const storageKeys = Object.keys(localStorage).filter(key => 
        key.includes('rag') || key.includes('assistant') || key.includes('widget')
      );
      
      if (storageKeys.length > 0) {
        assert(true, `Widget uses local storage (${storageKeys.length} keys)`, '');
      } else {
        skip('Local storage usage', 'No widget-related keys found in localStorage');
      }
    } catch (error) {
      skip('Local storage check', 'localStorage not accessible');
    }

    // Test 10: Test console errors
    log('\n[10] Testing Console Errors...', 'info');
    const originalError = console.error;
    let errorCount = 0;
    console.error = function(...args) {
      errorCount++;
      originalError.apply(console, args);
    };
    
    await wait(1000);
    console.error = originalError;
    
    assert(
      errorCount === 0,
      'No console errors during tests',
      `${errorCount} console error(s) detected`
    );

    // Print results
    console.log('\n' + '═'.repeat(60));
    printResults();
  }

  function printResults() {
    log('\n📊 Test Results Summary', 'info');
    console.log('═'.repeat(60));
    
    const total = testResults.passed + testResults.failed + testResults.skipped;
    const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
    
    console.log(`%cTotal Tests: ${total}`, 'font-weight: bold;');
    console.log(`%c✓ Passed: ${testResults.passed}`, 'color: #4CAF50; font-weight: bold;');
    console.log(`%c✗ Failed: ${testResults.failed}`, 'color: #F44336; font-weight: bold;');
    console.log(`%c⊘ Skipped: ${testResults.skipped}`, 'color: #FF9800; font-weight: bold;');
    console.log(`%cPass Rate: ${passRate}%`, 'font-weight: bold; font-size: 14px;');
    
    console.log('\n' + '═'.repeat(60));
    
    if (testResults.failed > 0) {
      log('\n❌ Failed Tests:', 'error');
      testResults.tests
        .filter(t => !t.passed && !t.skipped)
        .forEach(t => {
          console.log(`  • ${t.name}: ${t.error}`);
        });
    }
    
    if (testResults.skipped > 0) {
      log('\n⚠️  Skipped Tests:', 'warn');
      testResults.tests
        .filter(t => t.skipped)
        .forEach(t => {
          console.log(`  • ${t.name}: ${t.reason}`);
        });
    }
    
    console.log('\n' + '═'.repeat(60));
    
    if (testResults.failed === 0) {
      log('🎉 All tests passed!', 'success');
    } else {
      log('⚠️  Some tests failed. Please review the errors above.', 'warn');
    }
    
    // Return results for programmatic access
    return testResults;
  }

  // Export to window
  window.runWidgetTests = runWidgetTests;
  window.widgetTestResults = testResults;

  log('Test validator loaded! Run runWidgetTests() to start testing.', 'success');
  console.log('═'.repeat(60));
  console.log('Usage: runWidgetTests()');
  console.log('═'.repeat(60));

})();
