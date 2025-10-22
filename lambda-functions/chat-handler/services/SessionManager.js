"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
exports.createSessionManager = createSessionManager;
// Use stub types for development
let DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand;
let marshall, unmarshall;
try {
    const dynamodb = require('@aws-sdk/client-dynamodb');
    const util = require('@aws-sdk/util-dynamodb');
    DynamoDBClient = dynamodb.DynamoDBClient;
    GetItemCommand = dynamodb.GetItemCommand;
    PutItemCommand = dynamodb.PutItemCommand;
    UpdateItemCommand = dynamodb.UpdateItemCommand;
    DeleteItemCommand = dynamodb.DeleteItemCommand;
    QueryCommand = dynamodb.QueryCommand;
    marshall = util.marshall;
    unmarshall = util.unmarshall;
}
catch {
    DynamoDBClient = class {
        async send() { return {}; }
    };
    GetItemCommand = class {
        constructor() { }
    };
    PutItemCommand = class {
        constructor() { }
    };
    UpdateItemCommand = class {
        constructor() { }
    };
    DeleteItemCommand = class {
        constructor() { }
    };
    QueryCommand = class {
        constructor() { }
    };
    marshall = (obj) => obj;
    unmarshall = (obj) => obj;
}
const uuid_1 = require("uuid");
const config_1 = require("../config");
class SessionManager {
    constructor(config) {
        this.dynamoClient = new DynamoDBClient({ region: config.region });
        this.tableName = config.tableName;
        this.ttlHours = config.ttlHours || 24; // Default 24 hours
    }
    /**
     * Create a new session for a user
     */
    async createSession(request) {
        const sessionId = (0, uuid_1.v4)();
        const now = new Date();
        const ttl = Math.floor((now.getTime() + (this.ttlHours * 60 * 60 * 1000)) / 1000);
        const session = {
            sessionId,
            userId: request.userId,
            merchantId: request.merchantId,
            conversationHistory: [],
            context: request.context || {
                preferences: {},
                purchaseHistory: [],
                currentCart: [],
                demographics: {},
            },
            createdAt: now,
            lastActivity: now,
        };
        const item = {
            ...session,
            ttl,
            created_at: now.toISOString(),
            last_activity: now.toISOString(),
        };
        const command = new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(item),
            ConditionExpression: 'attribute_not_exists(session_id)',
        });
        try {
            await this.dynamoClient.send(command);
            return session;
        }
        catch (error) {
            throw new Error(`Failed to create session: ${error}`);
        }
    }
    /**
     * Retrieve a session by session ID and merchant ID
     */
    async getSession(sessionId, merchantId) {
        const command = new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({
                merchant_id: merchantId,
                session_id: sessionId,
            }),
        });
        try {
            const result = await this.dynamoClient.send(command);
            if (!result.Item) {
                return null;
            }
            const item = unmarshall(result.Item);
            return {
                sessionId: item.session_id,
                userId: item.user_id,
                merchantId: item.merchant_id,
                conversationHistory: item.conversation_history || [],
                context: item.context || {
                    preferences: {},
                    purchaseHistory: [],
                    currentCart: [],
                    demographics: {},
                },
                createdAt: new Date(item.created_at),
                lastActivity: new Date(item.last_activity),
            };
        }
        catch (error) {
            throw new Error(`Failed to get session: ${error}`);
        }
    }
    /**
     * Update session with new message or context
     */
    async updateSession(request) {
        const now = new Date();
        const ttl = Math.floor((now.getTime() + (this.ttlHours * 60 * 60 * 1000)) / 1000);
        let updateExpression = 'SET last_activity = :lastActivity, #ttl = :ttl';
        let expressionAttributeNames = {
            '#ttl': 'ttl',
        };
        let expressionAttributeValues = {
            ':lastActivity': now.toISOString(),
            ':ttl': ttl,
        };
        // Add message to conversation history
        if (request.message) {
            updateExpression += ', conversation_history = list_append(if_not_exists(conversation_history, :emptyList), :message)';
            expressionAttributeValues[':message'] = [request.message];
            expressionAttributeValues[':emptyList'] = [];
        }
        // Update context if provided
        if (request.context) {
            updateExpression += ', #context = if_not_exists(#context, :emptyContext)';
            expressionAttributeNames['#context'] = 'context';
            expressionAttributeValues[':emptyContext'] = {
                preferences: {},
                purchaseHistory: [],
                currentCart: [],
                demographics: {},
            };
            // Update specific context fields
            Object.entries(request.context).forEach(([key, value], index) => {
                const attrName = `#ctx${index}`;
                const attrValue = `:ctx${index}`;
                updateExpression += `, #context.${attrName} = ${attrValue}`;
                expressionAttributeNames[attrName] = key;
                expressionAttributeValues[attrValue] = value;
            });
        }
        const command = new UpdateItemCommand({
            TableName: this.tableName,
            Key: marshall({
                merchant_id: request.merchantId,
                session_id: request.sessionId,
            }),
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: marshall(expressionAttributeValues),
            ConditionExpression: 'attribute_exists(session_id)',
        });
        try {
            await this.dynamoClient.send(command);
        }
        catch (error) {
            throw new Error(`Failed to update session: ${error}`);
        }
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionId, merchantId) {
        const command = new DeleteItemCommand({
            TableName: this.tableName,
            Key: marshall({
                merchant_id: merchantId,
                session_id: sessionId,
            }),
        });
        try {
            await this.dynamoClient.send(command);
        }
        catch (error) {
            throw new Error(`Failed to delete session: ${error}`);
        }
    }
    /**
     * Get all sessions for a user
     */
    async getUserSessions(userId, limit = 10) {
        const command = new QueryCommand({
            TableName: this.tableName,
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'user_id = :userId',
            ExpressionAttributeValues: marshall({
                ':userId': userId,
            }),
            ScanIndexForward: false, // Most recent first
            Limit: limit,
        });
        try {
            const result = await this.dynamoClient.send(command);
            if (!result.Items) {
                return [];
            }
            return result.Items.map((item) => {
                const unmarshalled = unmarshall(item);
                return {
                    sessionId: unmarshalled.session_id,
                    userId: unmarshalled.user_id,
                    merchantId: unmarshalled.merchant_id,
                    conversationHistory: unmarshalled.conversation_history || [],
                    context: unmarshalled.context || {
                        preferences: {},
                        purchaseHistory: [],
                        currentCart: [],
                        demographics: {},
                    },
                    createdAt: new Date(unmarshalled.created_at),
                    lastActivity: new Date(unmarshalled.last_activity),
                };
            });
        }
        catch (error) {
            throw new Error(`Failed to get user sessions: ${error}`);
        }
    }
    /**
     * Clean up expired sessions (for maintenance)
     */
    async cleanupExpiredSessions(merchantId) {
        // DynamoDB TTL will automatically handle cleanup, but this method
        // can be used for manual cleanup if needed
        const now = Math.floor(Date.now() / 1000);
        // Query sessions for the merchant
        const queryCommand = new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'merchant_id = :merchantId',
            FilterExpression: '#ttl < :now',
            ExpressionAttributeNames: {
                '#ttl': 'ttl',
            },
            ExpressionAttributeValues: marshall({
                ':merchantId': merchantId,
                ':now': now,
            }),
        });
        try {
            const result = await this.dynamoClient.send(queryCommand);
            if (!result.Items || result.Items.length === 0) {
                return 0;
            }
            // Delete expired sessions
            const deletePromises = result.Items.map((item) => {
                const unmarshalled = unmarshall(item);
                return this.deleteSession(unmarshalled.session_id, merchantId);
            });
            await Promise.all(deletePromises);
            return result.Items.length;
        }
        catch (error) {
            throw new Error(`Failed to cleanup expired sessions: ${error}`);
        }
    }
    /**
     * Get session statistics for a merchant
     */
    async getSessionStats(merchantId) {
        const command = new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'merchant_id = :merchantId',
            ExpressionAttributeValues: marshall({
                ':merchantId': merchantId,
            }),
            Select: 'ALL_ATTRIBUTES',
        });
        try {
            const result = await this.dynamoClient.send(command);
            if (!result.Items) {
                return {
                    totalSessions: 0,
                    activeSessions: 0,
                    avgSessionDuration: 0,
                };
            }
            const now = Date.now();
            const sessions = result.Items.map((item) => unmarshall(item));
            const activeSessions = sessions.filter((session) => {
                const ttl = session.ttl * 1000; // Convert to milliseconds
                return ttl > now;
            });
            const totalDuration = sessions.reduce((sum, session) => {
                const created = new Date(session.created_at).getTime();
                const lastActivity = new Date(session.last_activity).getTime();
                return sum + (lastActivity - created);
            }, 0);
            const avgSessionDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;
            return {
                totalSessions: sessions.length,
                activeSessions: activeSessions.length,
                avgSessionDuration: Math.round(avgSessionDuration / 1000 / 60), // Convert to minutes
            };
        }
        catch (error) {
            throw new Error(`Failed to get session stats: ${error}`);
        }
    }
}
exports.SessionManager = SessionManager;
// Factory function to create SessionManager with default config
function createSessionManager() {
    return new SessionManager({
        tableName: process.env.SESSION_TABLE_NAME || 'mindsdb-rag-sessions-dev',
        region: config_1.config.aws.region,
        ttlHours: parseInt(process.env.SESSION_TTL_HOURS || '24', 10),
    });
}
//# sourceMappingURL=SessionManager.js.map