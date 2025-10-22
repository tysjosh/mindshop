"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactions = exports.modelArtifacts = exports.costTracking = exports.predictionResults = exports.auditLogs = exports.userSessions = exports.documents = exports.outcomeEnum = exports.documentTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// Custom vector type (since drizzle doesn't have built-in vector support yet)
const vector = (name, _config) => (0, pg_core_1.text)(name).$type();
// Enums
exports.documentTypeEnum = (0, pg_core_1.pgEnum)("document_type", [
    "product",
    "faq",
    "policy",
    "review",
]);
exports.outcomeEnum = (0, pg_core_1.pgEnum)("outcome", ["success", "failure"]);
// Documents table
exports.documents = (0, pg_core_1.pgTable)("documents", {
    id: (0, pg_core_1.uuid)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    merchantId: (0, pg_core_1.text)("merchant_id").notNull(),
    sku: (0, pg_core_1.text)("sku"),
    title: (0, pg_core_1.text)("title").notNull(),
    body: (0, pg_core_1.text)("body").notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata").default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    embedding: vector("embedding", { dimensions: 1536 }),
    documentType: (0, exports.documentTypeEnum)("document_type").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => {
    return {
        merchantIdx: (0, pg_core_1.index)("idx_documents_merchant").on(table.merchantId),
        skuIdx: (0, pg_core_1.index)("idx_documents_sku").on(table.sku),
        typeIdx: (0, pg_core_1.index)("idx_documents_type").on(table.documentType),
        createdIdx: (0, pg_core_1.index)("idx_documents_created").on(table.createdAt),
        // Note: GIN index for metadata will be created manually in SQL migration
    };
});
// User sessions table
exports.userSessions = (0, pg_core_1.pgTable)("user_sessions", {
    sessionId: (0, pg_core_1.uuid)("session_id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    merchantId: (0, pg_core_1.text)("merchant_id").notNull(),
    conversationHistory: (0, pg_core_1.jsonb)("conversation_history").default((0, drizzle_orm_1.sql) `'[]'::jsonb`),
    context: (0, pg_core_1.jsonb)("context").default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    lastActivity: (0, pg_core_1.timestamp)("last_activity", {
        withTimezone: true,
    }).defaultNow(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }).default((0, drizzle_orm_1.sql) `NOW() + INTERVAL '24 hours'`),
}, (table) => {
    return {
        userIdx: (0, pg_core_1.index)("idx_sessions_user").on(table.userId),
        merchantIdx: (0, pg_core_1.index)("idx_sessions_merchant").on(table.merchantId),
        expiresIdx: (0, pg_core_1.index)("idx_sessions_expires").on(table.expiresAt),
        activityIdx: (0, pg_core_1.index)("idx_sessions_activity").on(table.lastActivity),
    };
});
// Audit logs table
exports.auditLogs = (0, pg_core_1.pgTable)("audit_logs", {
    id: (0, pg_core_1.uuid)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    timestamp: (0, pg_core_1.timestamp)("timestamp", { withTimezone: true }).defaultNow(),
    merchantId: (0, pg_core_1.text)("merchant_id").notNull(),
    userId: (0, pg_core_1.text)("user_id"),
    sessionId: (0, pg_core_1.uuid)("session_id"),
    operation: (0, pg_core_1.text)("operation").notNull(),
    requestPayloadHash: (0, pg_core_1.text)("request_payload_hash").notNull(),
    responseReference: (0, pg_core_1.text)("response_reference").notNull(),
    outcome: (0, exports.outcomeEnum)("outcome").notNull(),
    reason: (0, pg_core_1.text)("reason"),
    actor: (0, pg_core_1.text)("actor").notNull(),
    ipAddress: (0, pg_core_1.inet)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
}, (table) => {
    return {
        merchantIdx: (0, pg_core_1.index)("idx_audit_merchant").on(table.merchantId),
        timestampIdx: (0, pg_core_1.index)("idx_audit_timestamp").on(table.timestamp),
        operationIdx: (0, pg_core_1.index)("idx_audit_operation").on(table.operation),
        outcomeIdx: (0, pg_core_1.index)("idx_audit_outcome").on(table.outcome),
        userIdx: (0, pg_core_1.index)("idx_audit_user").on(table.userId),
    };
});
// Prediction results table (for caching MindsDB predictions)
exports.predictionResults = (0, pg_core_1.pgTable)("prediction_results", {
    id: (0, pg_core_1.uuid)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    merchantId: (0, pg_core_1.text)("merchant_id").notNull(),
    sku: (0, pg_core_1.text)("sku").notNull(),
    demandScore: (0, pg_core_1.real)("demand_score").notNull(),
    purchaseProbability: (0, pg_core_1.real)("purchase_probability").notNull(),
    explanation: (0, pg_core_1.text)("explanation").notNull(),
    featureImportance: (0, pg_core_1.jsonb)("feature_importance").notNull(),
    provenance: (0, pg_core_1.jsonb)("provenance").notNull(),
    confidence: (0, pg_core_1.real)("confidence").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }).default((0, drizzle_orm_1.sql) `NOW() + INTERVAL '1 hour'`),
}, (table) => {
    return {
        merchantSkuIdx: (0, pg_core_1.index)("idx_predictions_merchant_sku").on(table.merchantId, table.sku),
        expiresIdx: (0, pg_core_1.index)("idx_predictions_expires").on(table.expiresAt),
    };
});
// Cost tracking table
exports.costTracking = (0, pg_core_1.pgTable)("cost_tracking", {
    id: (0, pg_core_1.uuid)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    merchantId: (0, pg_core_1.text)("merchant_id").notNull(),
    sessionId: (0, pg_core_1.uuid)("session_id"),
    userId: (0, pg_core_1.text)("user_id"),
    operation: (0, pg_core_1.text)("operation").notNull(), // 'retrieval', 'prediction', 'generation', 'checkout'
    costUsd: (0, pg_core_1.real)("cost_usd").notNull(),
    tokens: (0, pg_core_1.jsonb)("tokens").default((0, drizzle_orm_1.sql) `'{}'::jsonb`), // {input: 100, output: 50}
    computeMs: (0, pg_core_1.real)("compute_ms"), // compute time in milliseconds
    timestamp: (0, pg_core_1.timestamp)("timestamp", { withTimezone: true }).defaultNow(),
    metadata: (0, pg_core_1.jsonb)("metadata").default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
}, (table) => {
    return {
        merchantIdx: (0, pg_core_1.index)("idx_cost_merchant").on(table.merchantId),
        sessionIdx: (0, pg_core_1.index)("idx_cost_session").on(table.sessionId),
        timestampIdx: (0, pg_core_1.index)("idx_cost_timestamp").on(table.timestamp),
        operationIdx: (0, pg_core_1.index)("idx_cost_operation").on(table.operation),
    };
});
// Model artifacts table (for MindsDB model versioning)
exports.modelArtifacts = (0, pg_core_1.pgTable)("model_artifacts", {
    id: (0, pg_core_1.uuid)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    merchantId: (0, pg_core_1.text)("merchant_id").notNull(),
    modelName: (0, pg_core_1.text)("model_name").notNull(),
    modelVersion: (0, pg_core_1.text)("model_version").notNull(),
    modelType: (0, pg_core_1.text)("model_type").notNull(), // 'semantic_retriever', 'product_signals'
    s3Location: (0, pg_core_1.text)("s3_location").notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata").default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    trainingMetrics: (0, pg_core_1.jsonb)("training_metrics").default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    status: (0, pg_core_1.text)("status").notNull().default('training'), // 'training', 'ready', 'failed', 'deprecated'
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    deployedAt: (0, pg_core_1.timestamp)("deployed_at", { withTimezone: true }),
}, (table) => {
    return {
        merchantModelIdx: (0, pg_core_1.index)("idx_artifacts_merchant_model").on(table.merchantId, table.modelName),
        statusIdx: (0, pg_core_1.index)("idx_artifacts_status").on(table.status),
        createdIdx: (0, pg_core_1.index)("idx_artifacts_created").on(table.createdAt),
    };
});
// Transactions table (for checkout tracking)
exports.transactions = (0, pg_core_1.pgTable)("transactions", {
    id: (0, pg_core_1.uuid)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    transactionId: (0, pg_core_1.text)("transaction_id").notNull().unique(),
    merchantId: (0, pg_core_1.text)("merchant_id").notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    sessionId: (0, pg_core_1.uuid)("session_id"),
    items: (0, pg_core_1.jsonb)("items").notNull(),
    totalAmount: (0, pg_core_1.real)("total_amount").notNull(),
    currency: (0, pg_core_1.text)("currency").notNull().default('USD'),
    paymentMethod: (0, pg_core_1.text)("payment_method").notNull(),
    paymentGateway: (0, pg_core_1.text)("payment_gateway").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // 'pending', 'completed', 'failed', 'cancelled'
    gatewayTransactionId: (0, pg_core_1.text)("gateway_transaction_id"),
    failureReason: (0, pg_core_1.text)("failure_reason"),
    metadata: (0, pg_core_1.jsonb)("metadata").default((0, drizzle_orm_1.sql) `'{}'::jsonb`),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at", { withTimezone: true }),
}, (table) => {
    return {
        transactionIdIdx: (0, pg_core_1.index)("idx_transactions_id").on(table.transactionId),
        merchantIdx: (0, pg_core_1.index)("idx_transactions_merchant").on(table.merchantId),
        userIdx: (0, pg_core_1.index)("idx_transactions_user").on(table.userId),
        statusIdx: (0, pg_core_1.index)("idx_transactions_status").on(table.status),
        createdIdx: (0, pg_core_1.index)("idx_transactions_created").on(table.createdAt),
    };
});
//# sourceMappingURL=schema.js.map