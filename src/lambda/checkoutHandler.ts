import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createDatabaseConnection } from '../database/connection';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { CheckoutService, CheckoutRequest } from '../services/CheckoutService';
import { PIIRedactorService } from '../services/PIIRedactor';

// Initialize services
let auditLogRepository: AuditLogRepository;
let checkoutService: CheckoutService;
let piiRedactor: PIIRedactorService;

async function initializeServices() {
  if (!auditLogRepository) {
    const db = await createDatabaseConnection();
    auditLogRepository = new AuditLogRepository();
    piiRedactor = new PIIRedactorService();
    checkoutService = new CheckoutService(auditLogRepository, piiRedactor);
  }
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Checkout Handler - Event:', JSON.stringify(event, null, 2));

  try {
    await initializeServices();

    // Parse the request
    const body = JSON.parse(event.body || '{}');
    const { apiPath, httpMethod, requestBody } = body;

    // Route to appropriate checkout function
    let result: any;

    switch (apiPath) {
      case '/checkout':
        result = await handleCheckout(requestBody);
        break;
      case '/checkout/status':
        result = await handleCheckoutStatus(requestBody);
        break;
      case '/checkout/cancel':
        result = await handleCheckoutCancel(requestBody);
        break;
      default:
        throw new Error(`Unknown API path: ${apiPath}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Error in Checkout Handler:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Checkout processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Handle checkout processing using CheckoutService
 */
async function handleCheckout(requestBody: any): Promise<any> {
  // Validate required fields
  const { merchant_id, user_id, session_id, items, payment_method = 'default' } = requestBody;

  if (!merchant_id || !user_id || !session_id || !items || items.length === 0) {
    throw new Error('Missing required parameters: merchant_id, user_id, session_id, items');
  }

  // Validate user consent
  if (!requestBody.user_consent || !requestBody.user_consent.terms_accepted) {
    throw new Error('User consent is required for checkout');
  }

  // Validate addresses
  if (!requestBody.shipping_address) {
    throw new Error('Shipping address is required');
  }

  console.log(`Processing checkout for merchant ${merchant_id}, user ${user_id}`);

  // Convert to CheckoutRequest format
  const checkoutRequest: CheckoutRequest = {
    merchant_id,
    user_id,
    session_id,
    items: items.map((item: any) => ({
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      name: item.name || item.sku,
      description: item.description,
    })),
    payment_method: payment_method as 'stripe' | 'adyen' | 'default',
    shipping_address: requestBody.shipping_address,
    billing_address: requestBody.billing_address,
    user_consent: {
      terms_accepted: requestBody.user_consent.terms_accepted,
      privacy_accepted: requestBody.user_consent.privacy_accepted || true,
      marketing_consent: requestBody.user_consent.marketing_consent,
      consent_timestamp: requestBody.user_consent.consent_timestamp || new Date().toISOString(),
    },
  };

  // Process checkout using CheckoutService
  return await checkoutService.processCheckout(checkoutRequest);
}

/**
 * Handle checkout status inquiry
 */
async function handleCheckoutStatus(requestBody: any) {
  const { transaction_id, merchant_id } = requestBody;

  if (!transaction_id || !merchant_id) {
    throw new Error('Missing required parameters: transaction_id, merchant_id');
  }

  return await checkoutService.getTransactionStatus(transaction_id, merchant_id);
}

/**
 * Handle checkout cancellation
 */
async function handleCheckoutCancel(requestBody: any) {
  const { transaction_id, merchant_id, reason } = requestBody;

  if (!transaction_id || !merchant_id) {
    throw new Error('Missing required parameters: transaction_id, merchant_id');
  }

  return await checkoutService.cancelTransaction(
    transaction_id,
    merchant_id,
    reason || 'User requested cancellation'
  );
}

/**
 * Health check endpoint
 */
export const healthHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    await initializeServices();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          payment_processor: 'available',
          checkout_service: 'initialized',
        },
      }),
    };

  } catch (error) {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};