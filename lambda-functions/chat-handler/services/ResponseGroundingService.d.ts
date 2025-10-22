import { RetrievalResult } from '../types';
export interface GroundingValidationResult {
    isGrounded: boolean;
    groundingScore: number;
    sourceCitations: DocumentCitation[];
    factualClaims: FactualClaim[];
    validatedClaims: number;
    totalClaims: number;
    groundingAccuracy: number;
    confidence: number;
    validationDetails: ValidationDetail[];
}
export interface DocumentCitation {
    documentId: string;
    documentTitle?: string;
    snippet: string;
    relevanceScore: number;
    citationText: string;
    sourceUri?: string;
    groundingPass: boolean;
}
export interface FactualClaim {
    claim: string;
    claimType: 'product_feature' | 'price' | 'availability' | 'specification' | 'general_fact';
    confidence: number;
    supportingEvidence: Evidence[];
    isValidated: boolean;
    validationScore: number;
}
export interface Evidence {
    documentId: string;
    snippet: string;
    relevanceScore: number;
    exactMatch: boolean;
    semanticMatch: boolean;
}
export interface ValidationDetail {
    claim: string;
    status: 'validated' | 'unvalidated' | 'contradicted';
    evidence: Evidence[];
    reasoning: string;
}
export interface QualityScore {
    overall: number;
    dimensions: {
        factualAccuracy: number;
        relevance: number;
        completeness: number;
        clarity: number;
        groundedness: number;
    };
    hallucination: {
        detected: boolean;
        confidence: number;
        indicators: string[];
    };
    recommendations: string[];
}
export interface ResponseQualityAssessment {
    response: string;
    groundingValidation: GroundingValidationResult;
    qualityScore: QualityScore;
    citations: DocumentCitation[];
    fallbackRecommended: boolean;
    improvementSuggestions: string[];
}
export interface GroundingConfig {
    minGroundingScore: number;
    minCitationRelevance: number;
    maxClaimsPerResponse: number;
    enableHallucinationDetection: boolean;
    strictFactChecking: boolean;
    fallbackThreshold: number;
}
export declare class ResponseGroundingService {
    private readonly config;
    private readonly factualClaimPatterns;
    private readonly hallucinationIndicators;
    constructor(config?: Partial<GroundingConfig>);
    validateResponseGrounding(response: string, retrievedDocuments: RetrievalResult[], originalQuery: string): Promise<ResponseQualityAssessment>;
    private extractFactualClaims;
    private validateClaims;
    private findSupportingEvidence;
    private calculateClaimValidationScore;
    private generateCitations;
    private calculateQualityScore;
    private detectHallucination;
    private shouldRecommendFallback;
    private generateFallbackResponse;
    private splitIntoSentences;
    private isSubjectiveSentence;
    private containsSpecificInformation;
    private classifyClaimType;
    private estimateClaimConfidence;
    private cleanClaim;
    private deduplicateClaims;
    private generateSourceCitations;
    private generateValidationReasoning;
    private calculateGroundingConfidence;
    private tokenize;
    private hasExactMatch;
    private calculateSemanticSimilarity;
    private calculateRelevanceScore;
    private calculateCompletenessScore;
    private calculateClarityScore;
    private generateQualityRecommendations;
    private generateImprovementSuggestions;
    createFallbackResponse(originalQuery: string, documents: RetrievalResult[], reason: string): Promise<string>;
}
export declare const createResponseGroundingService: (config?: Partial<GroundingConfig>) => ResponseGroundingService;
//# sourceMappingURL=ResponseGroundingService.d.ts.map