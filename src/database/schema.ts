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
  unique,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

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
export const merchantStatusEnum = pgEnum("merchant_status", [
  "pending_verification",
  "active",
  "suspended",
  "deleted",
]);
export const merchantPlanEnum = pgEnum("merchant_plan", [
  "starter",
  "professional",
  "enterprise",
]);
export const apiKeyStatusEnum = pgEnum("api_key_status", [
  "active",
  "revoked",
  "expired",
]);
export const apiKeyEnvironmentEnum = pgEnum("api_key_environment", [
  "development",
  "production",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "active",
  "disabled",
  "failed",
]);
export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "success",
  "failed",
]);
export const billingStatusEnum = pgEnum("billing_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);
export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "card",
  "bank_account",
]);

// Merchants table
export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id").notNull().unique(),
    cognitoUserId: text("cognito_user_id").notNull().unique(),
    email: text("email").notNull().unique(),
    emailVerified: text("email_verified").$type<boolean>().default(sql`false`),
    companyName: text("company_name").notNull(),
    website: text("website"),
    industry: text("industry"),
    status: merchantStatusEnum("status").notNull().default("pending_verification"),
    plan: merchantPlanEnum("plan").notNull().default("starter"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      merchantIdIdx: index("idx_merchants_merchant_id").on(table.merchantId),
      emailIdx: index("idx_merchants_email").on(table.email),
      cognitoUserIdIdx: index("idx_merchants_cognito_user_id").on(table.cognitoUserId),
      statusIdx: index("idx_merchants_status").on(table.status),
    };
  }
);

// Merchant settings table
export const merchantSettings = pgTable(
  "merchant_settings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      merchantIdIdx: index("idx_merchant_settings_merchant_id").on(table.merchantId),
    };
  }
);

// API Keys table
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    keyId: text("key_id").notNull().unique(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    environment: apiKeyEnvironmentEnum("environment").notNull(),
    permissions: jsonb("permissions").notNull().default(sql`'[]'::jsonb`),
    status: apiKeyStatusEnum("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      keyIdIdx: index("idx_api_keys_key_id").on(table.keyId),
      merchantIdIdx: index("idx_api_keys_merchant_id").on(table.merchantId),
      keyHashIdx: index("idx_api_keys_key_hash").on(table.keyHash),
      statusIdx: index("idx_api_keys_status").on(table.status),
    };
  }
);

// API Key usage tracking table
export const apiKeyUsage = pgTable(
  "api_key_usage",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    keyId: text("key_id")
      .notNull()
      .references(() => apiKeys.keyId, { onDelete: "cascade" }),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    statusCode: real("status_code").notNull(),
    responseTimeMs: real("response_time_ms"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    date: timestamp("date", { mode: "date" }).default(sql`CURRENT_DATE`),
  },
  (table) => {
    return {
      keyIdIdx: index("idx_api_key_usage_key_id").on(table.keyId),
      dateIdx: index("idx_api_key_usage_date").on(table.date),
      merchantIdIdx: index("idx_api_key_usage_merchant_id").on(table.merchantId),
      timestampIdx: index("idx_api_key_usage_timestamp").on(table.timestamp),
    };
  }
);

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

// Merchant usage tracking table (aggregated daily)
export const merchantUsage = pgTable(
  "merchant_usage",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    date: timestamp("date", { mode: "date" }).notNull(),
    metricType: text("metric_type").notNull(), // 'queries', 'documents', 'api_calls', 'storage_gb'
    metricValue: real("metric_value").notNull().default(0),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      merchantDateMetricIdx: index("idx_merchant_usage_merchant_date_metric").on(
        table.merchantId,
        table.date,
        table.metricType
      ),
      dateIdx: index("idx_merchant_usage_date").on(table.date),
      merchantIdIdx: index("idx_merchant_usage_merchant_id").on(table.merchantId),
      // Unique constraint to prevent duplicate entries for same merchant, date, and metric type
      uniqueMerchantDateMetric: unique("unique_merchant_date_metric").on(
        table.merchantId,
        table.date,
        table.metricType
      ),
    };
  }
);

// Usage limits per plan table
export const usageLimits = pgTable(
  "usage_limits",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    plan: merchantPlanEnum("plan").notNull(),
    queriesPerMonth: real("queries_per_month").notNull(),
    documentsMax: real("documents_max").notNull(),
    apiCallsPerDay: real("api_calls_per_day").notNull(),
    storageGbMax: real("storage_gb_max").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      merchantIdIdx: index("idx_usage_limits_merchant_id").on(table.merchantId),
    };
  }
);

// Webhooks table
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    webhookId: text("webhook_id").notNull().unique(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    url: text("url").notNull(),
    events: jsonb("events").notNull(), // Array of event types
    secret: text("secret").notNull(), // For HMAC signature
    status: webhookStatusEnum("status").notNull().default("active"),
    failureCount: real("failure_count").notNull().default(0),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      webhookIdIdx: index("idx_webhooks_webhook_id").on(table.webhookId),
      merchantIdIdx: index("idx_webhooks_merchant_id").on(table.merchantId),
      statusIdx: index("idx_webhooks_status").on(table.status),
    };
  }
);

// Webhook deliveries table (for audit/retry)
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.webhookId, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: webhookDeliveryStatusEnum("status").notNull(),
    statusCode: real("status_code"),
    responseBody: text("response_body"),
    attemptCount: real("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      webhookIdIdx: index("idx_webhook_deliveries_webhook_id").on(table.webhookId),
      statusIdx: index("idx_webhook_deliveries_status").on(table.status),
      nextRetryIdx: index("idx_webhook_deliveries_next_retry").on(table.nextRetryAt),
      createdIdx: index("idx_webhook_deliveries_created").on(table.createdAt),
    };
  }
);

// Billing information table
export const billingInfo = pgTable(
  "billing_info",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: merchantPlanEnum("plan").notNull(),
    status: billingStatusEnum("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: real("cancel_at_period_end").notNull().default(0), // Using real as boolean (0 or 1)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      merchantIdIdx: index("idx_billing_info_merchant_id").on(table.merchantId),
      stripeCustomerIdIdx: index("idx_billing_info_stripe_customer_id").on(table.stripeCustomerId),
      statusIdx: index("idx_billing_info_status").on(table.status),
    };
  }
);

// Invoices table
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    amountDue: real("amount_due").notNull(), // in cents
    amountPaid: real("amount_paid").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: invoiceStatusEnum("status").notNull(),
    invoicePdf: text("invoice_pdf"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => {
    return {
      merchantIdIdx: index("idx_invoices_merchant_id").on(table.merchantId),
      stripeInvoiceIdIdx: index("idx_invoices_stripe_invoice_id").on(table.stripeInvoiceId),
      statusIdx: index("idx_invoices_status").on(table.status),
      createdIdx: index("idx_invoices_created").on(table.createdAt),
    };
  }
);

// Payment methods table
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
    type: paymentMethodTypeEnum("type").notNull(),
    last4: text("last4"),
    brand: text("brand"),
    expMonth: real("exp_month"),
    expYear: real("exp_year"),
    isDefault: real("is_default").notNull().default(0), // Using real as boolean (0 or 1)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return {
      merchantIdIdx: index("idx_payment_methods_merchant_id").on(table.merchantId),
      stripePaymentMethodIdIdx: index("idx_payment_methods_stripe_payment_method_id").on(table.stripePaymentMethodId),
      isDefaultIdx: index("idx_payment_methods_is_default").on(table.isDefault),
    };
  }
);

// Define table relations
export const merchantsRelations = relations(merchants, ({ one, many }) => ({
  settings: one(merchantSettings, {
    fields: [merchants.merchantId],
    references: [merchantSettings.merchantId],
  }),
  apiKeys: many(apiKeys),
  usage: many(merchantUsage),
  usageLimits: one(usageLimits, {
    fields: [merchants.merchantId],
    references: [usageLimits.merchantId],
  }),
  webhooks: many(webhooks),
  billingInfo: one(billingInfo, {
    fields: [merchants.merchantId],
    references: [billingInfo.merchantId],
  }),
  invoices: many(invoices),
  paymentMethods: many(paymentMethods),
  documents: many(documents),
  sessions: many(userSessions),
  auditLogs: many(auditLogs),
  transactions: many(transactions),
  costTracking: many(costTracking),
  modelArtifacts: many(modelArtifacts),
}));

export const merchantSettingsRelations = relations(merchantSettings, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantSettings.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [apiKeys.merchantId],
    references: [merchants.merchantId],
  }),
  usage: many(apiKeyUsage),
}));

export const apiKeyUsageRelations = relations(apiKeyUsage, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiKeyUsage.keyId],
    references: [apiKeys.keyId],
  }),
  merchant: one(merchants, {
    fields: [apiKeyUsage.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const merchantUsageRelations = relations(merchantUsage, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantUsage.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const usageLimitsRelations = relations(usageLimits, ({ one }) => ({
  merchant: one(merchants, {
    fields: [usageLimits.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [webhooks.merchantId],
    references: [merchants.merchantId],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.webhookId],
  }),
}));

export const billingInfoRelations = relations(billingInfo, ({ one }) => ({
  merchant: one(merchants, {
    fields: [billingInfo.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  merchant: one(merchants, {
    fields: [invoices.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  merchant: one(merchants, {
    fields: [paymentMethods.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  merchant: one(merchants, {
    fields: [documents.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [userSessions.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  merchant: one(merchants, {
    fields: [auditLogs.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [transactions.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const costTrackingRelations = relations(costTracking, ({ one }) => ({
  merchant: one(merchants, {
    fields: [costTracking.merchantId],
    references: [merchants.merchantId],
  }),
}));

export const modelArtifactsRelations = relations(modelArtifacts, ({ one }) => ({
  merchant: one(merchants, {
    fields: [modelArtifacts.merchantId],
    references: [merchants.merchantId],
  }),
}));

// Export types
export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type MerchantSettings = typeof merchantSettings.$inferSelect;
export type NewMerchantSettings = typeof merchantSettings.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;
export type NewApiKeyUsage = typeof apiKeyUsage.$inferInsert;
export type MerchantUsage = typeof merchantUsage.$inferSelect;
export type NewMerchantUsage = typeof merchantUsage.$inferInsert;
export type UsageLimit = typeof usageLimits.$inferSelect;
export type NewUsageLimit = typeof usageLimits.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type BillingInfo = typeof billingInfo.$inferSelect;
export type NewBillingInfo = typeof billingInfo.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
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
