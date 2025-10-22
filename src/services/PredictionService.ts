import { MindsDBService } from "./MindsDBService";
import { getCacheService } from "./CacheService";

export interface QueryAnalysisPrediction {
  intent: string;
  complexity: "low" | "medium" | "high";
  estimatedResponseTime: number;
  optimalDocumentCount: number;
  confidence: number;
}

export interface DocumentRelevancePrediction {
  documentId: string;
  relevanceScore: number;
  shouldInclude: boolean;
  confidence: number;
  reasons: string[];
}

export interface ResponseQualityPrediction {
  qualityScore: number;
  needsRevision: boolean;
  improvementSuggestions: string[];
  confidence: number;
}

export interface UserSatisfactionPrediction {
  satisfactionScore: number;
  riskFactors: string[];
  improvementActions: string[];
  nextQuestionProbability: Record<string, number>;
}

export interface DocumentClassificationPrediction {
  category: string;
  priority: "low" | "medium" | "high";
  routingDepartment: string;
  confidence: number;
}

/**
 * Prediction Service for RAG Intelligence
 * Uses MindsDB's ML capabilities to enhance RAG performance
 */
export class PredictionService {
  private mindsdbService: MindsDBService;
  private cacheService = getCacheService();

  constructor(mindsdbService?: MindsDBService) {
    this.mindsdbService = mindsdbService || new MindsDBService();
  }

  /**
   * Deploy prediction models for a merchant
   */
  async deployPredictionModels(
    merchantId: string,
    openaiApiKey?: string
  ): Promise<void> {
    console.log(`Deploying prediction models for merchant: ${merchantId}`);

    try {
      // 1. Query Analysis Model - predicts query complexity and intent
      await this.createQueryAnalysisModel(merchantId);

      // 2. Document Relevance Model - predicts document relevance scores
      await this.createDocumentRelevanceModel(merchantId);

      // 3. Response Quality Model - predicts response quality
      await this.createResponseQualityModel(merchantId);

      // 4. User Satisfaction Model - predicts user satisfaction
      await this.createUserSatisfactionModel(merchantId);

      // 5. Document Classification Model - auto-classifies documents
      await this.createDocumentClassificationModel(merchantId);

      console.log(
        `✅ All prediction models deployed for merchant: ${merchantId}`
      );
    } catch (error) {
      console.error(
        `Failed to deploy prediction models for merchant ${merchantId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Predict query analysis (intent, complexity, optimal parameters)
   */
  async predictQueryAnalysis(
    merchantId: string,
    query: string,
    userContext?: any
  ): Promise<QueryAnalysisPrediction> {
    const cacheKey = `query_analysis:${merchantId}:${Buffer.from(query).toString("base64")}`;

    // Check cache first
    const cached =
      await this.cacheService.get<QueryAnalysisPrediction>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const sql = `
        SELECT intent, complexity, estimated_response_time, optimal_document_count, confidence
        FROM query_analysis_${merchantId}
        WHERE query = '${query.replace(/'/g, "''")}'
        ${userContext ? `AND user_context = '${JSON.stringify(userContext).replace(/'/g, "''")}'` : ""}
        LIMIT 1
      `;

      const result = await this.mindsdbService.query(sql);

      if (result.data && result.data.length > 0) {
        const prediction = result.data[0];
        const analysisResult: QueryAnalysisPrediction = {
          intent: prediction.intent || "general",
          complexity: prediction.complexity || "medium",
          estimatedResponseTime: prediction.estimated_response_time || 2000,
          optimalDocumentCount: prediction.optimal_document_count || 5,
          confidence: prediction.confidence || 0.8,
        };

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, analysisResult, 600);
        return analysisResult;
      }

      // Fallback to rule-based analysis
      return this.fallbackQueryAnalysis(query);
    } catch (error) {
      console.warn("Query analysis prediction failed, using fallback:", error);
      return this.fallbackQueryAnalysis(query);
    }
  }

  /**
   * Predict document relevance for a query
   */
  async predictDocumentRelevance(
    merchantId: string,
    query: string,
    documentIds: string[]
  ): Promise<DocumentRelevancePrediction[]> {
    try {
      const predictions: DocumentRelevancePrediction[] = [];

      for (const docId of documentIds) {
        const sql = `
          SELECT relevance_score, should_include, confidence, reasons
          FROM document_relevance_${merchantId}
          WHERE query = '${query.replace(/'/g, "''")}'
          AND document_id = '${docId}'
          LIMIT 1
        `;

        const result = await this.mindsdbService.query(sql);

        if (result.data && result.data.length > 0) {
          const pred = result.data[0];
          predictions.push({
            documentId: docId,
            relevanceScore: pred.relevance_score || 0.5,
            shouldInclude: pred.should_include || pred.relevance_score > 0.7,
            confidence: pred.confidence || 0.8,
            reasons: pred.reasons
              ? JSON.parse(pred.reasons)
              : ["Predicted relevant"],
          });
        } else {
          // Fallback prediction
          predictions.push({
            documentId: docId,
            relevanceScore: 0.5,
            shouldInclude: false,
            confidence: 0.5,
            reasons: ["No prediction available"],
          });
        }
      }

      return predictions;
    } catch (error) {
      console.warn("Document relevance prediction failed:", error);
      return documentIds.map((docId) => ({
        documentId: docId,
        relevanceScore: 0.5,
        shouldInclude: true,
        confidence: 0.5,
        reasons: ["Fallback prediction"],
      }));
    }
  }

  /**
   * Predict response quality before sending to user
   */
  async predictResponseQuality(
    merchantId: string,
    query: string,
    response: string,
    context?: any
  ): Promise<ResponseQualityPrediction> {
    try {
      const sql = `
        SELECT quality_score, needs_revision, improvement_suggestions, confidence
        FROM response_quality_${merchantId}
        WHERE query = '${query.replace(/'/g, "''")}'
        AND response = '${response.replace(/'/g, "''")}'
        LIMIT 1
      `;

      const result = await this.mindsdbService.query(sql);

      if (result.data && result.data.length > 0) {
        const pred = result.data[0];
        return {
          qualityScore: pred.quality_score || 0.8,
          needsRevision: pred.needs_revision || pred.quality_score < 0.7,
          improvementSuggestions: pred.improvement_suggestions
            ? JSON.parse(pred.improvement_suggestions)
            : [],
          confidence: pred.confidence || 0.8,
        };
      }

      // Fallback quality assessment
      return this.fallbackQualityAssessment(response);
    } catch (error) {
      console.warn("Response quality prediction failed:", error);
      return this.fallbackQualityAssessment(response);
    }
  }

  /**
   * Predict user satisfaction and next actions
   */
  async predictUserSatisfaction(
    merchantId: string,
    sessionId: string,
    interactionHistory: any[]
  ): Promise<UserSatisfactionPrediction> {
    try {
      const sql = `
        SELECT satisfaction_score, risk_factors, improvement_actions, next_questions
        FROM user_satisfaction_${merchantId}
        WHERE session_id = '${sessionId}'
        AND interaction_count = ${interactionHistory.length}
        LIMIT 1
      `;

      const result = await this.mindsdbService.query(sql);

      if (result.data && result.data.length > 0) {
        const pred = result.data[0];
        return {
          satisfactionScore: pred.satisfaction_score || 0.8,
          riskFactors: pred.risk_factors ? JSON.parse(pred.risk_factors) : [],
          improvementActions: pred.improvement_actions
            ? JSON.parse(pred.improvement_actions)
            : [],
          nextQuestionProbability: pred.next_questions
            ? JSON.parse(pred.next_questions)
            : {},
        };
      }

      // Fallback satisfaction prediction
      return {
        satisfactionScore: 0.8,
        riskFactors: [],
        improvementActions: [],
        nextQuestionProbability: {},
      };
    } catch (error) {
      console.warn("User satisfaction prediction failed:", error);
      return {
        satisfactionScore: 0.8,
        riskFactors: [],
        improvementActions: [],
        nextQuestionProbability: {},
      };
    }
  }

  /**
   * Classify documents automatically
   */
  async classifyDocument(
    merchantId: string,
    content: string,
    title?: string
  ): Promise<DocumentClassificationPrediction> {
    try {
      const sql = `
        SELECT category, priority, routing_department, confidence
        FROM document_classifier_${merchantId}
        WHERE content = '${content.replace(/'/g, "''")}'
        ${title ? `AND title = '${title.replace(/'/g, "''")}'` : ""}
        LIMIT 1
      `;

      const result = await this.mindsdbService.query(sql);

      if (result.data && result.data.length > 0) {
        const pred = result.data[0];
        return {
          category: pred.category || "general",
          priority: pred.priority || "medium",
          routingDepartment: pred.routing_department || "support",
          confidence: pred.confidence || 0.8,
        };
      }

      // Fallback classification
      return this.fallbackDocumentClassification(content, title);
    } catch (error) {
      console.warn("Document classification failed:", error);
      return this.fallbackDocumentClassification(content, title);
    }
  }

  /**
   * Create query analysis model
   */
  private async createQueryAnalysisModel(merchantId: string): Promise<void> {
    const modelName = `query_analysis_${merchantId}`;

    const sql = `
      CREATE MODEL ${modelName}
      FROM (
        SELECT 
          query,
          intent,
          complexity,
          response_time as estimated_response_time,
          document_count as optimal_document_count,
          user_context
        FROM query_history_${merchantId}
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      )
      PREDICT intent, complexity, estimated_response_time, optimal_document_count
      USING engine = 'lightwood';
    `;

    try {
      await this.mindsdbService.query(sql);
      console.log(`✅ Query analysis model created: ${modelName}`);
    } catch (error) {
      console.warn(
        `Query analysis model creation failed for ${merchantId}:`,
        error
      );
    }
  }

  /**
   * Create document relevance model
   */
  private async createDocumentRelevanceModel(
    merchantId: string
  ): Promise<void> {
    const modelName = `document_relevance_${merchantId}`;

    const sql = `
      CREATE MODEL ${modelName}
      FROM (
        SELECT 
          query,
          document_id,
          relevance_score,
          user_clicked as should_include,
          document_type,
          document_length
        FROM document_interactions_${merchantId}
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      )
      PREDICT relevance_score, should_include
      USING engine = 'lightwood';
    `;

    try {
      await this.mindsdbService.query(sql);
      console.log(`✅ Document relevance model created: ${modelName}`);
    } catch (error) {
      console.warn(
        `Document relevance model creation failed for ${merchantId}:`,
        error
      );
    }
  }

  /**
   * Create response quality model
   */
  private async createResponseQualityModel(merchantId: string): Promise<void> {
    const modelName = `response_quality_${merchantId}`;

    const sql = `
      CREATE MODEL ${modelName}
      FROM (
        SELECT 
          query,
          response,
          quality_score,
          user_rating > 3 as needs_revision,
          response_length,
          context_relevance
        FROM response_feedback_${merchantId}
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      )
      PREDICT quality_score, needs_revision
      USING engine = 'lightwood';
    `;

    try {
      await this.mindsdbService.query(sql);
      console.log(`✅ Response quality model created: ${modelName}`);
    } catch (error) {
      console.warn(
        `Response quality model creation failed for ${merchantId}:`,
        error
      );
    }
  }

  /**
   * Create user satisfaction model
   */
  private async createUserSatisfactionModel(merchantId: string): Promise<void> {
    const modelName = `user_satisfaction_${merchantId}`;

    const sql = `
      CREATE MODEL ${modelName}
      FROM (
        SELECT 
          session_id,
          interaction_count,
          satisfaction_score,
          session_duration,
          query_complexity_avg,
          resolution_rate
        FROM session_analytics_${merchantId}
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      )
      PREDICT satisfaction_score
      USING engine = 'lightwood';
    `;

    try {
      await this.mindsdbService.query(sql);
      console.log(`✅ User satisfaction model created: ${modelName}`);
    } catch (error) {
      console.warn(
        `User satisfaction model creation failed for ${merchantId}:`,
        error
      );
    }
  }

  /**
   * Create document classification model
   */
  private async createDocumentClassificationModel(
    merchantId: string
  ): Promise<void> {
    const modelName = `document_classifier_${merchantId}`;

    const sql = `
      CREATE MODEL ${modelName}
      FROM (
        SELECT 
          content,
          title,
          category,
          priority,
          routing_department,
          document_type,
          word_count,
          has_technical_terms
        FROM classified_documents_${merchantId}
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      )
      PREDICT category, priority, routing_department
      USING 
        engine = 'lightwood',
        encoders.content.module = 'TextEncoder',
        encoders.title.module = 'TextEncoder';
    `;

    try {
      await this.mindsdbService.query(sql);
      console.log(`✅ Document classification model created: ${modelName}`);
    } catch (error) {
      console.warn(
        `Document classification model creation failed for ${merchantId}:`,
        error
      );
    }
  }

  /**
   * Batch predict document relevance for multiple documents
   */
  async batchPredictDocumentRelevance(
    merchantId: string,
    query: string,
    documents: Array<{ id: string; content: string; title?: string }>
  ): Promise<DocumentRelevancePrediction[]> {
    try {
      // Create temporary table with documents
      const tempTableName = `temp_docs_${merchantId}_${Date.now()}`;

      // Insert documents into temporary table (simplified approach)
      const predictions: DocumentRelevancePrediction[] = [];

      for (const doc of documents) {
        const sql = `
          SELECT relevance_score, should_include, confidence
          FROM document_relevance_${merchantId}
          WHERE query = '${query.replace(/'/g, "''")}'
          AND content = '${doc.content.substring(0, 500).replace(/'/g, "''")}'
          LIMIT 1
        `;

        const result = await this.mindsdbService.query(sql);

        if (result.data && result.data.length > 0) {
          const pred = result.data[0];
          predictions.push({
            documentId: doc.id,
            relevanceScore: pred.relevance_score || 0.5,
            shouldInclude: pred.should_include || pred.relevance_score > 0.7,
            confidence: pred.confidence || 0.8,
            reasons: ["ML prediction"],
          });
        } else {
          predictions.push({
            documentId: doc.id,
            relevanceScore: 0.5,
            shouldInclude: true,
            confidence: 0.5,
            reasons: ["Fallback prediction"],
          });
        }
      }

      return predictions;
    } catch (error) {
      console.warn("Batch document relevance prediction failed:", error);
      return documents.map((doc) => ({
        documentId: doc.id,
        relevanceScore: 0.5,
        shouldInclude: true,
        confidence: 0.5,
        reasons: ["Error fallback"],
      }));
    }
  }

  /**
   * Predict optimal RAG parameters for a query
   */
  async predictOptimalRAGParameters(
    merchantId: string,
    query: string,
    userProfile?: any
  ): Promise<{
    maxDocuments: number;
    relevanceThreshold: number;
    useHybridSearch: boolean;
    responseLength: "short" | "medium" | "long";
    temperature: number;
  }> {
    try {
      const sql = `
        SELECT max_documents, relevance_threshold, use_hybrid_search, response_length, temperature
        FROM rag_optimizer_${merchantId}
        WHERE query = '${query.replace(/'/g, "''")}'
        ${userProfile ? `AND user_profile = '${JSON.stringify(userProfile).replace(/'/g, "''")}'` : ""}
        LIMIT 1
      `;

      const result = await this.mindsdbService.query(sql);

      if (result.data && result.data.length > 0) {
        const pred = result.data[0];
        return {
          maxDocuments: pred.max_documents || 5,
          relevanceThreshold: pred.relevance_threshold || 0.7,
          useHybridSearch: pred.use_hybrid_search || true,
          responseLength: pred.response_length || "medium",
          temperature: pred.temperature || 0.7,
        };
      }

      // Fallback parameters
      return {
        maxDocuments: 5,
        relevanceThreshold: 0.7,
        useHybridSearch: true,
        responseLength: "medium",
        temperature: 0.7,
      };
    } catch (error) {
      console.warn("RAG parameter optimization failed:", error);
      return {
        maxDocuments: 5,
        relevanceThreshold: 0.7,
        useHybridSearch: true,
        responseLength: "medium",
        temperature: 0.7,
      };
    }
  }

  /**
   * Fallback query analysis using rule-based approach
   */
  private fallbackQueryAnalysis(query: string): QueryAnalysisPrediction {
    const queryLower = query.toLowerCase();

    // Simple intent detection
    let intent = "general";
    if (
      queryLower.includes("buy") ||
      queryLower.includes("purchase") ||
      queryLower.includes("order")
    ) {
      intent = "purchase";
    } else if (
      queryLower.includes("return") ||
      queryLower.includes("refund") ||
      queryLower.includes("cancel")
    ) {
      intent = "support";
    } else if (
      queryLower.includes("how") ||
      queryLower.includes("what") ||
      queryLower.includes("why")
    ) {
      intent = "information";
    }

    // Simple complexity detection
    let complexity: "low" | "medium" | "high" = "medium";
    if (query.length < 20) {
      complexity = "low";
    } else if (query.length > 100 || query.split(" ").length > 20) {
      complexity = "high";
    }

    return {
      intent,
      complexity,
      estimatedResponseTime:
        complexity === "high" ? 3000 : complexity === "medium" ? 2000 : 1000,
      optimalDocumentCount:
        complexity === "high" ? 8 : complexity === "medium" ? 5 : 3,
      confidence: 0.6, // Lower confidence for rule-based
    };
  }

  /**
   * Fallback response quality assessment
   */
  private fallbackQualityAssessment(
    response: string
  ): ResponseQualityPrediction {
    const wordCount = response.split(" ").length;
    const hasSpecificInfo =
      response.includes("specific") ||
      response.includes("exactly") ||
      response.includes("precisely");
    const hasHedging =
      response.includes("might") ||
      response.includes("possibly") ||
      response.includes("perhaps");

    let qualityScore = 0.7;

    // Adjust based on response characteristics
    if (wordCount < 10) qualityScore -= 0.2; // Too short
    if (wordCount > 500) qualityScore -= 0.1; // Too long
    if (hasSpecificInfo) qualityScore += 0.1;
    if (hasHedging) qualityScore -= 0.05;

    qualityScore = Math.max(0, Math.min(1, qualityScore));

    return {
      qualityScore,
      needsRevision: qualityScore < 0.7,
      improvementSuggestions:
        qualityScore < 0.7 ? ["Consider adding more specific information"] : [],
      confidence: 0.6,
    };
  }

  /**
   * Fallback document classification
   */
  private fallbackDocumentClassification(
    content: string,
    title?: string
  ): DocumentClassificationPrediction {
    const contentLower = content.toLowerCase();
    const titleLower = title?.toLowerCase() || "";

    let category = "general";
    let priority: "low" | "medium" | "high" = "medium";
    let routingDepartment = "support";

    // Simple rule-based classification
    if (
      contentLower.includes("product") ||
      contentLower.includes("specification")
    ) {
      category = "product_info";
      routingDepartment = "product";
    } else if (
      contentLower.includes("policy") ||
      contentLower.includes("terms")
    ) {
      category = "policy";
      routingDepartment = "legal";
    } else if (
      contentLower.includes("support") ||
      contentLower.includes("help")
    ) {
      category = "support";
      routingDepartment = "support";
    }

    // Priority based on urgency keywords
    if (contentLower.includes("urgent") || contentLower.includes("critical")) {
      priority = "high";
    } else if (
      contentLower.includes("minor") ||
      contentLower.includes("optional")
    ) {
      priority = "low";
    }

    return {
      category,
      priority,
      routingDepartment,
      confidence: 0.6,
    };
  }

  /**
   * Get prediction model status for a merchant
   */
  async getPredictionModelStatus(merchantId: string): Promise<{
    models: Array<{
      name: string;
      status: string;
      accuracy?: number;
      lastTrained?: string;
    }>;
    overallHealth: "healthy" | "degraded" | "unhealthy";
  }> {
    try {
      const modelNames = [
        `query_analysis_${merchantId}`,
        `document_relevance_${merchantId}`,
        `response_quality_${merchantId}`,
        `user_satisfaction_${merchantId}`,
        `document_classifier_${merchantId}`,
      ];

      const models = [];
      let healthyCount = 0;

      for (const modelName of modelNames) {
        try {
          const result = await this.mindsdbService.query(
            `DESCRIBE ${modelName}`
          );
          if (result.data && result.data.length > 0) {
            const status = result.data[0];
            models.push({
              name: modelName,
              status: status.status || "unknown",
              accuracy: status.accuracy,
              lastTrained: status.updated_at || status.created_at,
            });
            if (status.status === "complete") healthyCount++;
          }
        } catch (error) {
          models.push({
            name: modelName,
            status: "not_found",
          });
        }
      }

      const overallHealth =
        healthyCount === modelNames.length
          ? "healthy"
          : healthyCount > modelNames.length / 2
            ? "degraded"
            : "unhealthy";

      return { models, overallHealth };
    } catch (error) {
      console.error("Failed to get prediction model status:", error);
      return {
        models: [],
        overallHealth: "unhealthy",
      };
    }
  }
}

export const predictionService = new PredictionService();
