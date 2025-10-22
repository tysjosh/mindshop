interface MindsDBConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
}
interface QueryResult {
    data: any[];
    columns: string[];
}
interface DocumentMetadata {
    document_id: string;
    document_type: string;
    source: string;
    created_at?: string;
    title?: string;
}
interface KnowledgeBaseConfig {
    name: string;
    embedding_model: {
        provider: string;
        model_name: string;
        api_key: string;
    };
    reranking_model?: {
        provider: string;
        model_name: string;
        api_key: string;
    };
    metadata_columns: string[];
    content_columns: string[];
    id_column: string;
}
interface AgentConfig {
    name: string;
    model: {
        provider: string;
        model_name: string;
        api_key: string;
    };
    knowledge_bases: string[];
    prompt_template: string;
    timeout?: number;
}
interface JobConfig {
    name: string;
    sql: string;
    schedule: string;
    condition?: string;
}
export declare class MindsDBService {
    private config;
    private baseUrl;
    private circuitBreaker;
    private cacheService;
    constructor(config?: MindsDBConfig);
    query(sql: string): Promise<QueryResult>;
    testConnection(): Promise<boolean>;
    createKnowledgeBase(config: KnowledgeBaseConfig): Promise<void>;
    insertDocumentToKB(kbName: string, document: {
        id: string;
        content: string;
        metadata: DocumentMetadata;
    }): Promise<void>;
    batchInsertDocumentsToKB(kbName: string, documents: Array<{
        id: string;
        content: string;
        metadata: DocumentMetadata;
    }>): Promise<void>;
    searchKnowledgeBase(kbName: string, query: string, filters?: Record<string, any>, limit?: number, relevanceThreshold?: number): Promise<any[]>;
    createAgent(config: AgentConfig): Promise<void>;
    queryAgent(agentName: string, question: string): Promise<string>;
    createJob(config: JobConfig): Promise<void>;
    createDocumentIngestionJob(jobName: string, kbName: string, dataSource: string, schedule?: string): Promise<void>;
    createDatabase(name: string, engine: string, parameters: Record<string, any>): Promise<void>;
    listKnowledgeBases(): Promise<any[]>;
    listAgents(): Promise<any[]>;
    listJobs(): Promise<any[]>;
    listDatabases(): Promise<any[]>;
    dropKnowledgeBase(name: string): Promise<void>;
    dropAgent(name: string): Promise<void>;
    dropJob(name: string): Promise<void>;
    dropDatabase(name: string): Promise<void>;
    extractDocumentContent(filePath: string): Promise<string>;
    hybridSearch(kbName: string, query: string, alpha?: number, filters?: Record<string, any>, limit?: number): Promise<any[]>;
    setupRAGSystem(merchantId: string, openaiApiKey: string): Promise<void>;
    ingestDocument(merchantId: string, document: {
        id: string;
        content: string;
        title?: string;
        source: string;
        document_type: string;
    }): Promise<void>;
    askQuestion(merchantId: string, question: string): Promise<string>;
    searchDocuments(merchantId: string, query: string, filters?: Record<string, any>, useHybridSearch?: boolean): Promise<any[]>;
    healthCheck(): Promise<{
        status: string;
        timestamp: string;
        details?: any;
    }>;
    /**
     * Generate embedding for text (compatibility method)
     */
    generateEmbedding(params: {
        text: string;
        merchantId: string;
    }): Promise<number[]>;
    /**
     * Generate batch embeddings (compatibility method)
     */
    generateBatchEmbeddings(params: {
        documents: Array<{
            id: string;
            text: string;
        }>;
    }): Promise<Array<{
        id: string;
        embedding: number[];
    }>>;
    /**
     * Execute SQL query (compatibility method)
     */
    executeSQLQuery(sql: string): Promise<any>;
    /**
     * Predict product signals (compatibility method)
     */
    predictProductSignals(params: {
        sku: string;
        merchantId: string;
        userContext: any;
    }): Promise<any>;
    /**
     * Retrieve documents (compatibility method for examples)
     */
    retrieveDocuments(params: {
        query: string;
        merchantId: string;
        limit?: number;
    }): Promise<any[]>;
    /**
     * List predictors (compatibility method for examples)
     */
    listPredictors(merchantId: string): Promise<any[]>;
    /**
     * Get circuit breaker stats (compatibility method for examples)
     */
    getCircuitBreakerStats(): any;
    /**
     * Get connection info (compatibility method for examples)
     */
    getConnectionInfo(): any;
    /**
     * Create Bedrock ML Engine in MindsDB
     */
    createBedrockEngine(engineName: string, awsCredentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        region: string;
    }): Promise<void>;
    /**
     * Create Bedrock RAG Model in MindsDB
     */
    createBedrockRAGModel(merchantId: string, modelName: string, engineName: string, config?: {
        modelId?: string;
        mode?: "default" | "conversational";
        maxTokens?: number;
        temperature?: number;
        promptTemplate?: string;
    }): Promise<void>;
    /**
     * Ask question using Bedrock model with MindsDB RAG context
     */
    askQuestionWithBedrock(merchantId: string, question: string, bedrockModelName?: string, options?: {
        includeContext?: boolean;
        maxDocuments?: number;
        contextTemplate?: string;
    }): Promise<{
        answer: string;
        confidence: number;
        sources: any[];
        reasoning: string[];
    }>;
    /**
     * Hybrid RAG query combining MindsDB knowledge base with Bedrock LLM
     */
    hybridRAGQuery(merchantId: string, query: string, options?: {
        bedrockModelName?: string;
        useHybridSearch?: boolean;
        maxDocuments?: number;
        relevanceThreshold?: number;
        includeMetadata?: boolean;
    }): Promise<{
        answer: string;
        documents: any[];
        predictions: any[];
        confidence: number;
        reasoning: string[];
        executionTime: number;
        source: string;
    }>;
    /**
     * Setup complete Bedrock integration for a merchant
     */
    setupBedrockIntegration(merchantId: string, awsCredentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        region: string;
    }, bedrockConfig?: {
        modelId?: string;
        mode?: "default" | "conversational";
        maxTokens?: number;
        temperature?: number;
    }): Promise<void>;
    /**
     * List available Bedrock models
     */
    listBedrockModels(): Promise<any[]>;
    /**
     * Get Bedrock model status
     */
    getBedrockModelStatus(modelName: string): Promise<any>;
}
export {};
//# sourceMappingURL=MindsDBService.d.ts.map