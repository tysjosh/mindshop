"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationService = void 0;
const aws_sdk_1 = require("aws-sdk");
class CompensationService {
    constructor(transactionRepository, auditLogRepository, config = {
        max_retries: 3,
        retry_delay_ms: 5000,
        timeout_ms: 30000,
    }) {
        this.sns = new aws_sdk_1.SNS({ region: process.env.AWS_REGION || 'us-east-1' });
        this.sqs = new aws_sdk_1.SQS({ region: process.env.AWS_REGION || 'us-east-1' });
        this.transactionRepository = transactionRepository;
        this.auditLogRepository = auditLogRepository;
        this.config = config;
    }
    /**
     * Execute compensation workflow for failed transaction
     */
    async executeCompensation(transactionId, merchantId, failureReason) {
        console.log(`Starting compensation workflow for transaction ${transactionId}: ${failureReason}`);
        const actionsExecuted = [];
        const errors = [];
        try {
            // Get transaction details
            const transaction = await this.transactionRepository.getTransaction(transactionId, merchantId);
            if (!transaction) {
                throw new Error(`Transaction ${transactionId} not found`);
            }
            // Update transaction status to compensating
            await this.transactionRepository.updateTransaction(transactionId, merchantId, {
                status: 'compensating',
                metadata: {
                    ...transaction.metadata,
                    compensation_started_at: new Date().toISOString(),
                    failure_reason: failureReason,
                },
            });
            // Log compensation start
            await this.auditLogRepository.create({
                merchantId,
                userId: transaction.user_id,
                sessionId: transaction.session_id,
                operation: 'compensation_start',
                requestPayloadHash: this.hashPayload({ transactionId, failureReason }),
                responseReference: `compensation:${transactionId}`,
                outcome: 'success',
                actor: 'system',
            });
            // Execute compensation actions in order
            const compensationActions = [
                { type: 'inventory_release', priority: 1 },
                { type: 'payment_refund', priority: 2 },
                { type: 'order_cancel', priority: 3 },
                { type: 'notification_send', priority: 4 },
            ];
            for (const actionConfig of compensationActions) {
                try {
                    const actionResult = await this.executeCompensationAction(transaction, actionConfig.type, failureReason);
                    if (actionResult.success) {
                        actionsExecuted.push(actionConfig.type);
                    }
                    else {
                        errors.push(`${actionConfig.type}: ${actionResult.error}`);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`${actionConfig.type}: ${errorMessage}`);
                    console.error(`Compensation action ${actionConfig.type} failed:`, error);
                }
            }
            // Update final transaction status
            const finalStatus = errors.length === 0 ? 'cancelled' : 'failed';
            await this.transactionRepository.updateTransaction(transactionId, merchantId, {
                status: finalStatus,
                metadata: {
                    ...transaction.metadata,
                    compensation_completed_at: new Date().toISOString(),
                    compensation_success: errors.length === 0,
                    actions_executed: actionsExecuted,
                    compensation_errors: errors,
                },
            });
            // Log compensation completion
            await this.auditLogRepository.create({
                merchantId,
                userId: transaction.user_id,
                sessionId: transaction.session_id,
                operation: 'compensation_complete',
                requestPayloadHash: this.hashPayload({ transactionId, actionsExecuted, errors }),
                responseReference: `compensation:${transactionId}:complete`,
                outcome: errors.length === 0 ? 'success' : 'failure',
                reason: errors.length > 0 ? errors.join('; ') : undefined,
                actor: 'system',
            });
            return {
                success: errors.length === 0,
                actions_executed: actionsExecuted,
                errors,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Compensation workflow failed for transaction ${transactionId}:`, error);
            // Log compensation failure
            await this.auditLogRepository.create({
                merchantId,
                userId: 'system',
                sessionId: transactionId,
                operation: 'compensation_failure',
                requestPayloadHash: this.hashPayload({ transactionId, failureReason }),
                responseReference: `compensation:${transactionId}:error`,
                outcome: 'failure',
                reason: errorMessage,
                actor: 'system',
            });
            return {
                success: false,
                actions_executed: actionsExecuted,
                errors: [...errors, errorMessage],
            };
        }
    }
    /**
     * Execute individual compensation action
     */
    async executeCompensationAction(transaction, actionType, reason) {
        console.log(`Executing compensation action ${actionType} for transaction ${transaction.transaction_id}`);
        // Add compensation action record
        const action = await this.transactionRepository.addCompensationAction(transaction.transaction_id, transaction.merchant_id, {
            action_type: actionType,
            status: 'pending',
            retry_count: 0,
            max_retries: this.config.max_retries,
            metadata: { reason, started_at: new Date().toISOString() },
        });
        try {
            let result;
            switch (actionType) {
                case 'inventory_release':
                    result = await this.releaseInventory(transaction);
                    break;
                case 'payment_refund':
                    result = await this.processRefund(transaction, reason);
                    break;
                case 'order_cancel':
                    result = await this.cancelOrder(transaction, reason);
                    break;
                case 'notification_send':
                    result = await this.sendNotifications(transaction, reason);
                    break;
                default:
                    result = { success: false, error: `Unknown action type: ${actionType}` };
            }
            // Update action status
            await this.transactionRepository.updateCompensationAction(transaction.transaction_id, transaction.merchant_id, action.action_id, {
                status: result.success ? 'completed' : 'failed',
                error_message: result.error,
                executed_at: new Date(),
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Update action status as failed
            await this.transactionRepository.updateCompensationAction(transaction.transaction_id, transaction.merchant_id, action.action_id, {
                status: 'failed',
                error_message: errorMessage,
                executed_at: new Date(),
            });
            return { success: false, error: errorMessage };
        }
    }
    /**
     * Release inventory reservations
     */
    async releaseInventory(transaction) {
        if (!transaction.inventory_reserved || !transaction.inventory_reservation_id) {
            return { success: true }; // Nothing to release
        }
        try {
            // Send message to inventory service to release reservation
            const message = {
                action: 'release_reservation',
                reservation_id: transaction.inventory_reservation_id,
                transaction_id: transaction.transaction_id,
                merchant_id: transaction.merchant_id,
                reason: 'transaction_compensation',
            };
            await this.sqs.sendMessage({
                QueueUrl: process.env.INVENTORY_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123456789012/inventory-management',
                MessageBody: JSON.stringify(message),
                MessageAttributes: {
                    merchant_id: {
                        DataType: 'String',
                        StringValue: transaction.merchant_id,
                    },
                    action: {
                        DataType: 'String',
                        StringValue: 'release_reservation',
                    },
                },
            }).promise();
            console.log(`Inventory release queued for reservation ${transaction.inventory_reservation_id}`);
            return { success: true };
        }
        catch (error) {
            console.error('Failed to release inventory:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Inventory release failed'
            };
        }
    }
    /**
     * Process payment refund
     */
    async processRefund(transaction, reason) {
        if (!transaction.payment_intent_id || transaction.status === 'pending') {
            return { success: true }; // No payment to refund
        }
        try {
            // In a real implementation, this would call the payment gateway API
            // For now, simulate refund processing
            const refundId = `refund_${transaction.transaction_id}_${Date.now()}`;
            // Send refund request to payment processor
            const refundMessage = {
                action: 'process_refund',
                refund_id: refundId,
                transaction_id: transaction.transaction_id,
                payment_intent_id: transaction.payment_intent_id,
                amount: transaction.total_amount,
                currency: transaction.currency,
                reason: reason,
                merchant_id: transaction.merchant_id,
            };
            await this.sns.publish({
                TopicArn: process.env.PAYMENT_PROCESSING_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:payment-processing',
                Message: JSON.stringify(refundMessage),
                Subject: `Refund Request: ${refundId}`,
                MessageAttributes: {
                    merchant_id: {
                        DataType: 'String',
                        StringValue: transaction.merchant_id,
                    },
                    action: {
                        DataType: 'String',
                        StringValue: 'process_refund',
                    },
                },
            }).promise();
            console.log(`Refund ${refundId} queued for transaction ${transaction.transaction_id}`);
            return { success: true };
        }
        catch (error) {
            console.error('Failed to process refund:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Refund processing failed'
            };
        }
    }
    /**
     * Cancel order and update order management system
     */
    async cancelOrder(transaction, reason) {
        try {
            // Send order cancellation to order management system
            const cancellationMessage = {
                action: 'cancel_order',
                transaction_id: transaction.transaction_id,
                order_reference: transaction.order_reference,
                merchant_id: transaction.merchant_id,
                reason: reason,
                cancelled_at: new Date().toISOString(),
            };
            await this.sns.publish({
                TopicArn: process.env.ORDER_PROCESSING_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:order-processing',
                Message: JSON.stringify(cancellationMessage),
                Subject: `Order Cancelled: ${transaction.order_reference}`,
                MessageAttributes: {
                    merchant_id: {
                        DataType: 'String',
                        StringValue: transaction.merchant_id,
                    },
                    event_type: {
                        DataType: 'String',
                        StringValue: 'order_cancelled',
                    },
                },
            }).promise();
            console.log(`Order cancellation queued for ${transaction.order_reference}`);
            return { success: true };
        }
        catch (error) {
            console.error('Failed to cancel order:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Order cancellation failed'
            };
        }
    }
    /**
     * Send notifications to customer and merchant
     */
    async sendNotifications(transaction, reason) {
        try {
            // Send customer notification
            const customerNotification = {
                type: 'transaction_failed',
                recipient: transaction.user_id,
                merchant_id: transaction.merchant_id,
                transaction_id: transaction.transaction_id,
                order_reference: transaction.order_reference,
                reason: reason,
                message: `Your order ${transaction.order_reference} has been cancelled due to a payment issue. Any charges will be refunded within 3-5 business days.`,
                timestamp: new Date().toISOString(),
            };
            await this.sns.publish({
                TopicArn: process.env.NOTIFICATION_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:notifications',
                Message: JSON.stringify(customerNotification),
                Subject: `Order Cancelled: ${transaction.order_reference}`,
                MessageAttributes: {
                    notification_type: {
                        DataType: 'String',
                        StringValue: 'transaction_failed',
                    },
                    merchant_id: {
                        DataType: 'String',
                        StringValue: transaction.merchant_id,
                    },
                },
            }).promise();
            // Send merchant notification
            const merchantNotification = {
                type: 'transaction_compensation',
                recipient: `merchant:${transaction.merchant_id}`,
                transaction_id: transaction.transaction_id,
                order_reference: transaction.order_reference,
                reason: reason,
                amount: transaction.total_amount,
                currency: transaction.currency,
                message: `Transaction ${transaction.transaction_id} failed and compensation actions have been executed.`,
                timestamp: new Date().toISOString(),
            };
            await this.sns.publish({
                TopicArn: process.env.MERCHANT_NOTIFICATION_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:merchant-notifications',
                Message: JSON.stringify(merchantNotification),
                Subject: `Transaction Compensation: ${transaction.transaction_id}`,
                MessageAttributes: {
                    notification_type: {
                        DataType: 'String',
                        StringValue: 'transaction_compensation',
                    },
                    merchant_id: {
                        DataType: 'String',
                        StringValue: transaction.merchant_id,
                    },
                },
            }).promise();
            console.log(`Notifications sent for transaction ${transaction.transaction_id}`);
            return { success: true };
        }
        catch (error) {
            console.error('Failed to send notifications:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Notification sending failed'
            };
        }
    }
    /**
     * Retry failed compensation actions
     */
    async retryFailedCompensations(merchantId) {
        console.log(`Retrying failed compensation actions for merchant: ${merchantId || 'all'}`);
        const pendingActions = await this.transactionRepository.getPendingCompensationActions(merchantId);
        let retried = 0;
        let succeeded = 0;
        let failed = 0;
        for (const action of pendingActions) {
            if (action.retry_count >= action.max_retries) {
                continue; // Skip actions that have exceeded max retries
            }
            try {
                retried++;
                // Get transaction for context
                const transaction = await this.transactionRepository.getTransaction(action.metadata.transaction_id, merchantId || action.metadata.merchant_id);
                if (!transaction) {
                    failed++;
                    continue;
                }
                // Retry the action
                const result = await this.executeCompensationAction(transaction, action.action_type, action.metadata.reason || 'retry');
                if (result.success) {
                    succeeded++;
                }
                else {
                    failed++;
                }
            }
            catch (error) {
                console.error(`Failed to retry compensation action ${action.action_id}:`, error);
                failed++;
            }
        }
        return { retried, succeeded, failed };
    }
    /**
     * Hash payload for audit logging
     */
    hashPayload(payload) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
}
exports.CompensationService = CompensationService;
//# sourceMappingURL=CompensationService.js.map