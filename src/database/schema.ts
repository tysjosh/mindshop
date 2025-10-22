import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
  pgEnum,
  inet,
  real,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Custom vector type (since drizzle doesn't have built-in vector support yet)
const vector = (name: string, _config?: { dimensions?: number }) =>
  text(name).$type<number[]>();

// Enums
export const documentTypeEnum = pgEnum("document_type", [
  "product",
  "faq",
  "policy",
  "review",
]);
export const outcomeEnum = pgEnum("outcome", ["success", "failure"]);

// Documents table
export const documents = pgTable(
  "documents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id").notNull(),
    sku: text("sku"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    embedding: vector("embedding", { dimensions: 1536 }),
    documentType: documentTypeEnum("document_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      merchantIdx: index("idx_documents_merchant").on(table.merchantId),
      skuIdx: index("idx_documents_sku").on(table.sku),
      typeIdx: index("idx_documents_type").on(table.documentType),
      createdIdx: index("idx_documents_created").on(table.createdAt),
      // Note: GIN index for metadata will be created manually in SQL migration
    };
  }
);

// User sessions table
export const userSessions = pgTable(
  "user_sessions",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    merchantId: text("merchant_id").notNull(),
    conversationHistory: jsonb("conversation_history").default(
      sql`'[]'::jsonb`
    ),
    context: jsonb("context").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastActivity: timestamp("last_activity", {
      withTimezone: true,
    }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`NOW() + INTERVAL '24 hours'`
    ),
  },
  (table) => {
    return {
      userIdx: index("idx_sessions_user").on(table.userId),
      merchantIdx: index("idx_sessions_merchant").on(table.merchantId),
      expiresIdx: index("idx_sessions_expires").on(table.expiresAt),
      activityIdx: index("idx_sessions_activity").on(table.lastActivity),
    };
  }
);

// Audit logs table
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    merchantId: text("merchant_id").notNull(),
    userId: text("user_id"),
    sessionId: uuid("session_id"),
    operation: text("operation").notNull(),
    requestPayloadHash: text("request_payload_hash").notNull(),
    responseReference: text("response_reference").notNull(),
    outcome: outcomeEnum("outcome").notNull(),
    reason: text("reason"),
    actor: text("actor").notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => {
    return {
      merchantIdx: index("idx_audit_merchant").on(table.merchantId),
      timestampIdx: index("idx_audit_timestamp").on(table.timestamp),
      operationIdx: index("idx_audit_operation").on(table.operation),
      outcomeIdx: index("idx_audit_outcome").on(table.outcome),
      userIdx: index("idx_audit_user").on(table.userId),
    };
  }
);

// Prediction results table (for caching MindsDB predictions)
export const predictionResults = pgTable(
  "prediction_results",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id").notNull(),
    sku: text("sku").notNull(),
    demandScore: real("demand_score").notNull(),
    purchaseProbability: real("purchase_probability").notNull(),
    explanation: text("explanation").notNull(),
    featureImportance: jsonb("feature_importance").notNull(),
    provenance: jsonb("provenance").notNull(),
    confidence: real("confidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`NOW() + INTERVAL '1 hour'`
    ),
  },
  (table) => {
    return {
      merchantSkuIdx: index("idx_predictions_merchant_sku").on(
        table.merchantId,
        table.sku
      ),
      expiresIdx: index("idx_predictions_expires").on(table.expiresAt),
    };
  }
);

// Cost tracking table
export const costTracking = pgTable(
  "cost_tracking",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id").notNull(),
    sessionId: uuid("session_id"),
    userId: text("user_id"),
    operation: text("operation").notNull(), // 'retrieval', 'prediction', 'generation', 'checkout'
    costUsd: real("cost_usd").notNull(),
    tokens: jsonb("tokens").default(sql`'{}'::jsonb`), // {input: 100, output: 50}
    computeMs: real("compute_ms"), // compute time in milliseconds
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  },
  (table) => {
    return {
      merchantIdx: index("idx_cost_merchant").on(table.merchantId),
      sessionIdx: index("idx_cost_session").on(table.sessionId),
      timestampIdx: index("idx_cost_timestamp").on(table.timestamp),
      operationIdx: index("idx_cost_operation").on(table.operation),
    };
  }
);

// Model artifacts table (for MindsDB model versioning)
export const modelArtifacts = pgTable(
  "model_artifacts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id").notNull(),
    modelName: text("model_name").notNull(),
    modelVersion: text("model_version").notNull(),
    modelType: text("model_type").notNull(), // 'semantic_retriever', 'product_signals'
    s3Location: text("s3_location").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    trainingMetrics: jsonb("training_metrics").default(sql`'{}'::jsonb`),
    status: text("status").notNull().default('training'), // 'training', 'ready', 'failed', 'deprecated'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
  },
  (table) => {
    return {
      merchantModelIdx: index("idx_artifacts_merchant_model").on(
        table.merchantId,
        table.modelName
      ),
      statusIdx: index("idx_artifacts_status").on(table.status),
      createdIdx: index("idx_artifacts_created").on(table.createdAt),
    };
  }
);

// Transactions table (for checkout tracking)
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    transactionId: text("transaction_id").notNull().unique(),
    merchantId: text("merchant_id").notNull(),
    userId: text("user_id").notNull(),
    sessionId: uuid("session_id"),
    items: jsonb("items").notNull(),
    totalAmount: real("total_amount").notNull(),
    currency: text("currency").notNull().default('USD'),
    paymentMethod: text("payment_method").notNull(),
    paymentGateway: text("payment_gateway").notNull(),
    status: text("status").notNull().default('pending'), // 'pending', 'completed', 'failed', 'cancelled'
    gatewayTransactionId: text("gateway_transaction_id"),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => {
    return {
      transactionIdIdx: index("idx_transactions_id").on(table.transactionId),
      merchantIdx: index("idx_transactions_merchant").on(table.merchantId),
      userIdx: index("idx_transactions_user").on(table.userId),
      statusIdx: index("idx_transactions_status").on(table.status),
      createdIdx: index("idx_transactions_created").on(table.createdAt),
    };
  }
);

// Export types
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type PredictionResult = typeof predictionResults.$inferSelect;
export type NewPredictionResult = typeof predictionResults.$inferInsert;
export type CostTracking = typeof costTracking.$inferSelect;
export type NewCostTracking = typeof costTracking.$inferInsert;
export type ModelArtifact = typeof modelArtifacts.$inferSelect;
export type NewModelArtifact = typeof modelArtifacts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
