import { Request, Response, NextFunction } from 'express';
import { getCostTrackingService } from '../../services/CostTrackingService';
import { getLoggingService } from '../../services/LoggingService';

interface CostTrackingRequest extends Request {
  costTracking?: {
    startTime: number;
    operation: string;
    merchantId?: string;
    sessionId?: string;
    userId?: string;
  };
}

/**
 * Middleware to automatically track costs for API operations
 */
export function costTrackingMiddleware(operation: string) {
  return (req: CostTrackingRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Extract identifiers from request
    const merchantId = req.headers['x-merchant-id'] as string || 
                      req.body?.merchant_id || 
                      req.query?.merchant_id as string;
    const sessionId = req.headers['x-session-id'] as string || 
                     req.body?.session_id || 
                     req.query?.session_id as string;
    const userId = req.headers['x-user-id'] as string || 
                  req.body?.user_id || 
                  req.query?.user_id as string;

    // Store tracking info in request
    req.costTracking = {
      startTime,
      operation,
      merchantId,
      sessionId,
      userId,
    };

    // Override res.json to capture response and calculate costs
    const originalJson = res.json;
    res.json = function(body: any) {
      // Calculate operation cost after response
      setImmediate(async () => {
        try {
          await trackOperationCost(req as CostTrackingRequest, res, body);
        } catch (error) {
          await getLoggingService().logError(error as Error, {
            merchantId: merchantId || '',
            sessionId: '',
            userId: '',
            requestId: `cost-track-${Date.now()}`,
            operation: 'cost_tracking_middleware',
          });
        }
      });

      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Calculate and track the cost of an API operation
 */
async function trackOperationCost(
  req: CostTrackingRequest,
  res: Response,
  responseBody: any
): Promise<void> {
  if (!req.costTracking || !req.costTracking.merchantId) {
    return; // Skip if no merchant ID available
  }

  const costTrackingService = getCostTrackingService();
  const duration = Date.now() - req.costTracking.startTime;
  
  let estimatedCost = 0;
  let tokens: { input: number; output: number } | undefined;
  const metadata: Record<string, any> = {
    httpMethod: req.method,
    statusCode: res.statusCode,
    duration,
    userAgent: req.headers['user-agent'],
  };

  // Estimate cost based on operation type
  switch (req.costTracking.operation) {
    case 'chat':
      estimatedCost = estimateChatCost(req, responseBody);
      tokens = extractTokenUsage(responseBody);
      break;
    
    case 'semantic_retrieval':
      estimatedCost = estimateRetrievalCost(req, responseBody);
      break;
    
    case 'prediction':
      estimatedCost = estimatePredictionCost(req, responseBody);
      break;
    
    case 'checkout':
      estimatedCost = estimateCheckoutCost(req, responseBody);
      break;
    
    case 'document_upload':
      estimatedCost = estimateDocumentUploadCost(req, responseBody);
      break;
    
    default:
      estimatedCost = estimateBasicOperationCost(duration);
  }

  // Add infrastructure costs
  estimatedCost += estimateInfrastructureCost(duration);

  await costTrackingService.trackOperationCost({
    merchantId: req.costTracking.merchantId,
    sessionId: req.costTracking.sessionId,
    userId: req.costTracking.userId,
    operation: req.costTracking.operation,
    costUsd: estimatedCost,
    tokens,
    computeMs: duration,
    metadata,
  });
}

/**
 * Estimate cost for chat operations
 */
function estimateChatCost(req: CostTrackingRequest, responseBody: any): number {
  let cost = 0;
  
  // Base API Gateway cost
  cost += 0.0000035; // $3.50 per million requests
  
  // Estimate based on query complexity
  const query = req.body?.query || '';
  const queryLength = query.length;
  
  if (queryLength > 500) {
    cost += 0.002; // Complex query processing
  } else if (queryLength > 100) {
    cost += 0.001; // Medium query processing
  } else {
    cost += 0.0005; // Simple query processing
  }
  
  // Add cost based on response size
  if (responseBody?.sources?.length > 5) {
    cost += 0.001; // Multiple sources retrieved
  }
  
  if (responseBody?.predictions?.length > 0) {
    cost += 0.002 * responseBody.predictions.length; // Prediction costs
  }
  
  return cost;
}

/**
 * Estimate cost for semantic retrieval operations
 */
function estimateRetrievalCost(req: CostTrackingRequest, responseBody: any): number {
  let cost = 0.001; // Base retrieval cost
  
  const limit = req.body?.limit || req.query?.limit || 5;
  const resultsReturned = responseBody?.results?.length || 0;
  
  // Cost scales with number of results
  cost += resultsReturned * 0.0002;
  
  // Higher cost for large limit requests
  if (limit > 10) {
    cost *= 1.5;
  }
  
  return cost;
}

/**
 * Estimate cost for prediction operations
 */
function estimatePredictionCost(req: CostTrackingRequest, responseBody: any): number {
  let cost = 0.002; // Base prediction cost
  
  // Add cost for feature importance calculation
  if (responseBody?.feature_importance) {
    cost += 0.001;
  }
  
  // Add cost for explanation generation
  if (responseBody?.explanation) {
    cost += 0.0005;
  }
  
  return cost;
}

/**
 * Estimate cost for checkout operations
 */
function estimateCheckoutCost(req: CostTrackingRequest, responseBody: any): number {
  let cost = 0.005; // Base checkout processing cost
  
  const items = req.body?.items || [];
  cost += items.length * 0.001; // Cost per item
  
  // Payment gateway fees (estimated)
  const totalAmount = req.body?.total_amount || 0;
  cost += totalAmount * 0.029; // ~2.9% payment processing fee
  
  return cost;
}

/**
 * Estimate cost for document upload operations
 */
function estimateDocumentUploadCost(req: CostTrackingRequest, responseBody: any): number {
  let cost = 0.001; // Base upload cost
  
  // Estimate based on content length
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    const sizeKB = parseInt(contentLength) / 1024;
    cost += sizeKB * 0.00001; // Cost per KB
  }
  
  // Add embedding generation cost
  cost += 0.002; // Estimated embedding cost
  
  return cost;
}

/**
 * Estimate basic operation cost based on duration
 */
function estimateBasicOperationCost(durationMs: number): number {
  // Base API Gateway cost + compute time
  return 0.0000035 + (durationMs * 0.000000001);
}

/**
 * Estimate infrastructure costs (ECS, Aurora, Redis)
 */
function estimateInfrastructureCost(durationMs: number): number {
  let cost = 0;
  
  // ECS compute cost (amortized)
  cost += durationMs * 0.000000001;
  
  // Aurora read cost (estimated 1 read per operation)
  cost += 0.0000002;
  
  // Redis cache operation
  cost += 0.0000001;
  
  return cost;
}

/**
 * Extract token usage from response body
 */
function extractTokenUsage(responseBody: any): { input: number; output: number } | undefined {
  if (responseBody?.metadata?.tokens) {
    return {
      input: responseBody.metadata.tokens.input || 0,
      output: responseBody.metadata.tokens.output || 0,
    };
  }
  
  // Estimate tokens based on content length
  const responseText = JSON.stringify(responseBody);
  const estimatedOutputTokens = Math.ceil(responseText.length / 4); // ~4 chars per token
  
  return {
    input: 0, // Can't estimate input tokens from response
    output: estimatedOutputTokens,
  };
}

/**
 * Middleware to check session cost targets
 */
export function sessionCostCheckMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.headers['x-session-id'] as string || 
                     req.body?.session_id || 
                     req.query?.session_id as string;
    
    if (!sessionId) {
      return next();
    }

    try {
      const costTrackingService = getCostTrackingService();
      const costCheck = await costTrackingService.checkSessionCostTarget(sessionId);
      
      // Add cost info to response headers
      res.setHeader('X-Session-Cost', costCheck.currentCost.toFixed(4));
      res.setHeader('X-Cost-Target', costCheck.targetCost.toFixed(2));
      res.setHeader('X-Cost-Percentage', costCheck.percentageOfTarget.toFixed(1));
      
      if (costCheck.exceedsTarget) {
        res.setHeader('X-Cost-Alert', 'TARGET_EXCEEDED');
        await getLoggingService().logWarning('Session cost target exceeded', {
          merchantId: '',
          sessionId,
          userId: '',
          requestId: `cost-check-${Date.now()}`,
          operation: 'session_cost_check',
        }, {
          currentCost: costCheck.currentCost,
          targetCost: costCheck.targetCost,
        });
      }
      
      next();
    } catch (error) {
      await getLoggingService().logError(error as Error, {
        merchantId: '',
        sessionId,
        userId: '',
        requestId: `cost-check-error-${Date.now()}`,
        operation: 'session_cost_check',
      });
      next(); // Continue even if cost check fails
    }
  };
}