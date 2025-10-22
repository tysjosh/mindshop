/**
 * Basic Setup Test
 * Verifies that the test environment is properly configured
 */

import { describe, it, expect, vi } from 'vitest';

describe('Basic Test Setup', () => {
  it('should run basic test', () => {
    expect(true).toBe(true);
  });

  it('should have vitest mocking capabilities', () => {
    const mockFn = vi.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should have environment variables', () => {
    process.env.TEST_VAR = 'test-value';
    expect(process.env.TEST_VAR).toBe('test-value');
  });
});