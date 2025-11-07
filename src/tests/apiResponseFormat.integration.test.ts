/**
 * Integration tests for API Response Format Standardization
 * Verifies all API endpoints return consistent response format
 *
 * Requirements: FR5 - API Response Format Standardization
 * Task: 2.6 - Test API response formats
 * 
 * Standard Success Format:
 * {
 *   success: true,
 *   data: { ... },
 *   timestamp: "ISO 8601 string",
 *   requestId: "req_xxx"
 * }
 * 
 * Standard Error Format:
 * {
 *   success: false,
 *   error: "Error message",
 *   timestamp: "ISO 8601 string",
 *   requestId: "req_xxx"
 * }
 */

import {
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { Response } from "express";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendServerError,
} from "../api/utils/responseFormatter";

/**
 * Helper to create mock response object
 */
function createMockResponse(): { res: Partial<Response>; jsonSpy: any; statusSpy: any } {
  const jsonSpy = vi.fn();
  const statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
  
  const res: Partial<Response> = {
    status: statusSpy,
    json: jsonSpy,
  };
  
  return { res, jsonSpy, statusSpy };
}

describe("API Response Format Standardization Tests", () => {

  describe("Standard Success Response Format", () => {
    it("should return success response with all required fields", () => {
      const { res, jsonSpy, statusSpy } = createMockResponse();
      const data = { message: "Test successful", id: "123" };
      const requestId = "req_test_123";

      sendSuccess(res as Response, data, 200, requestId);

      expect(statusSpy).toHaveBeenCalledWith(200);
      const response = jsonSpy.mock.calls[0][0];
      
      // Verify all required fields are present
      expect(response).toHaveProperty("success", true);
      expect(response).toHaveProperty("data", data);
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("requestId", requestId);
    });

    it("should format timestamp as ISO 8601 string", () => {
      const { res, jsonSpy } = createMockResponse();
      
      sendSuccess(res as Response, { test: "data" });
      
      const response = jsonSpy.mock.calls[0][0];
      const timestamp = new Date(response.timestamp);
      
      // Verify timestamp is valid ISO 8601
      expect(timestamp.toISOString()).toBe(response.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it("should generate requestId if not provided", () => {
      const { res, jsonSpy } = createMockResponse();
      
      sendSuccess(res as Response, { test: "data" });
      
      const response = jsonSpy.mock.calls[0][0];
      expect(response.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it("should not include error field in success response", () => {
      const { res, jsonSpy } = createMockResponse();
      
      sendSuccess(res as Response, { test: "data" });
      
      const response = jsonSpy.mock.calls[0][0];
      expect(response).not.toHaveProperty("error");
    });
  });

  describe("Standard Error Response Format", () => {
    it("should return error response with all required fields", () => {
      const { res, jsonSpy, statusSpy } = createMockResponse();
      const error = "Test error message";
      const requestId = "req_test_123";

      sendError(res as Response, error, 400, requestId);

      expect(statusSpy).toHaveBeenCalledWith(400);
      const response = jsonSpy.mock.calls[0][0];
      
      // Verify all required fields are present
      expect(response).toHaveProperty("success", false);
      expect(response).toHaveProperty("error", error);
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("requestId", requestId);
    });

    it("should format timestamp as ISO 8601 string", () => {
      const { res, jsonSpy } = createMockResponse();
      
      sendError(res as Response, "Test error");
      
      const response = jsonSpy.mock.calls[0][0];
      const timestamp = new Date(response.timestamp);
      
      // Verify timestamp is valid ISO 8601
      expect(timestamp.toISOString()).toBe(response.timestamp);
    });

    it("should not include data field in error response", () => {
      const { res, jsonSpy } = createMockResponse();
      
      sendError(res as Response, "Test error");
      
      const response = jsonSpy.mock.calls[0][0];
      expect(response).not.toHaveProperty("data");
    });

    it("should handle Error objects", () => {
      const { res, jsonSpy } = createMockResponse();
      const error = new Error("Test error object");
      
      sendError(res as Response, error);
      
      const response = jsonSpy.mock.calls[0][0];
      expect(response.error).toBe("Test error object");
    });

    it("should include details field when provided", () => {
      const { res, jsonSpy } = createMockResponse();
      const details = { field: "email", message: "Invalid format" };
      
      sendError(res as Response, "Validation failed", 400, "req_123", details);
      
      const response = jsonSpy.mock.calls[0][0];
      expect(response).toHaveProperty("details", details);
    });
  });

  describe("Specific Error Response Helpers", () => {
    it("sendUnauthorized should return 401 with standard format", () => {
      const { res, jsonSpy, statusSpy } = createMockResponse();
      
      sendUnauthorized(res as Response, "Invalid credentials");
      
      expect(statusSpy).toHaveBeenCalledWith(401);
      const response = jsonSpy.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.error).toBe("Invalid credentials");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("requestId");
    });

    it("sendForbidden should return 403 with standard format", () => {
      const { res, jsonSpy, statusSpy } = createMockResponse();
      
      sendForbidden(res as Response, "Insufficient permissions");
      
      expect(statusSpy).toHaveBeenCalledWith(403);
      const response = jsonSpy.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.error).toBe("Insufficient permissions");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("requestId");
    });

    it("sendNotFound should return 404 with standard format", () => {
      const { res, jsonSpy, statusSpy } = createMockResponse();
      
      sendNotFound(res as Response, "Resource not found");
      
      expect(statusSpy).toHaveBeenCalledWith(404);
      const response = jsonSpy.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.error).toBe("Resource not found");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("requestId");
    });

    it("sendValidationError should return 422 with standard format and details", () => {
      const { res, jsonSpy, statusSpy } = createMockResponse();
      const errors = { email: "Invalid email", password: "Too short" };
      
      sendValidationError(res as Response, errors);
      
      expect(statusSpy).toHaveBeenCalledWith(422);
      const response = jsonSpy.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.error).toBe("Validation failed");
      expect(response).toHaveProperty("details", errors);
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("requestId");
    });

    it("sendServerError should return 500 with standard format", () => {
      const { res, jsonSpy, statusSpy } = createMockResponse();
      const error = new Error("Database connection failed");
      
      sendServerError(res as Response, error);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      const response = jsonSpy.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.error).toBe("Database connection failed");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("requestId");
    });
  });

  describe("Response Format Consistency", () => {
    it("all success responses should have identical structure", () => {
      const { res: res1, jsonSpy: jsonSpy1 } = createMockResponse();
      const { res: res2, jsonSpy: jsonSpy2 } = createMockResponse();
      
      sendSuccess(res1 as Response, { data1: "test" });
      sendSuccess(res2 as Response, { data2: "test" });
      
      const response1 = jsonSpy1.mock.calls[0][0];
      const response2 = jsonSpy2.mock.calls[0][0];
      
      // Both should have same keys
      expect(Object.keys(response1).sort()).toEqual(Object.keys(response2).sort());
      
      // Both should have success: true
      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
    });

    it("all error responses should have identical structure", () => {
      const { res: res1, jsonSpy: jsonSpy1 } = createMockResponse();
      const { res: res2, jsonSpy: jsonSpy2 } = createMockResponse();
      
      sendError(res1 as Response, "Error 1");
      sendError(res2 as Response, "Error 2");
      
      const response1 = jsonSpy1.mock.calls[0][0];
      const response2 = jsonSpy2.mock.calls[0][0];
      
      // Both should have same keys (excluding optional details)
      const keys1 = Object.keys(response1).filter(k => k !== "details").sort();
      const keys2 = Object.keys(response2).filter(k => k !== "details").sort();
      expect(keys1).toEqual(keys2);
      
      // Both should have success: false
      expect(response1.success).toBe(false);
      expect(response2.success).toBe(false);
    });

    it("success and error responses should never have overlapping data/error fields", () => {
      const { res: successRes, jsonSpy: successSpy } = createMockResponse();
      const { res: errorRes, jsonSpy: errorSpy } = createMockResponse();
      
      sendSuccess(successRes as Response, { test: "data" });
      sendError(errorRes as Response, "Test error");
      
      const successResponse = successSpy.mock.calls[0][0];
      const errorResponse = errorSpy.mock.calls[0][0];
      
      // Success should have data but not error
      expect(successResponse).toHaveProperty("data");
      expect(successResponse).not.toHaveProperty("error");
      
      // Error should have error but not data
      expect(errorResponse).toHaveProperty("error");
      expect(errorResponse).not.toHaveProperty("data");
    });
  });

  describe("Widget ApiClient Compatibility", () => {
    it("widget should be able to unwrap data from success response", () => {
      const { res, jsonSpy } = createMockResponse();
      const testData = { sessionId: "session_123", userId: "user_456" };
      
      sendSuccess(res as Response, testData);
      
      const response = jsonSpy.mock.calls[0][0];
      
      // Simulate widget ApiClient unwrapping logic
      const unwrappedData = response.success ? response.data : null;
      
      expect(unwrappedData).toEqual(testData);
      expect(unwrappedData).toHaveProperty("sessionId");
      expect(unwrappedData).toHaveProperty("userId");
    });

    it("widget should be able to detect errors reliably", () => {
      const { res, jsonSpy } = createMockResponse();
      
      sendError(res as Response, "Authentication failed");
      
      const response = jsonSpy.mock.calls[0][0];
      
      // Simulate widget ApiClient error detection
      const isError = !response.success;
      const errorMessage = response.error;
      
      expect(isError).toBe(true);
      expect(errorMessage).toBe("Authentication failed");
    });

    it("widget should handle both success and error responses consistently", () => {
      const { res: successRes, jsonSpy: successSpy } = createMockResponse();
      const { res: errorRes, jsonSpy: errorSpy } = createMockResponse();
      
      sendSuccess(successRes as Response, { result: "ok" });
      sendError(errorRes as Response, "Failed");
      
      const successResponse = successSpy.mock.calls[0][0];
      const errorResponse = errorSpy.mock.calls[0][0];
      
      // Both should have success field for reliable checking
      expect(successResponse).toHaveProperty("success");
      expect(errorResponse).toHaveProperty("success");
      
      // Widget can use simple boolean check
      expect(successResponse.success).toBe(true);
      expect(errorResponse.success).toBe(false);
    });
  });

  describe("Request ID Handling", () => {
    it("should use provided requestId", () => {
      const { res, jsonSpy } = createMockResponse();
      const customRequestId = "custom_req_abc123";
      
      sendSuccess(res as Response, { test: "data" }, 200, customRequestId);
      
      const response = jsonSpy.mock.calls[0][0];
      expect(response.requestId).toBe(customRequestId);
    });

    it("should generate requestId with correct format", () => {
      const { res, jsonSpy } = createMockResponse();
      
      sendSuccess(res as Response, { test: "data" });
      
      const response = jsonSpy.mock.calls[0][0];
      expect(response.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it("should generate unique requestIds", () => {
      const { res: res1, jsonSpy: jsonSpy1 } = createMockResponse();
      const { res: res2, jsonSpy: jsonSpy2 } = createMockResponse();
      
      sendSuccess(res1 as Response, { test: "data1" });
      sendSuccess(res2 as Response, { test: "data2" });
      
      const response1 = jsonSpy1.mock.calls[0][0];
      const response2 = jsonSpy2.mock.calls[0][0];
      
      expect(response1.requestId).not.toBe(response2.requestId);
    });
  });
});
