"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResponseGroundingService = exports.ResponseGroundingService = void 0;
class ResponseGroundingService {
    constructor(config) {
        // Patterns for identifying factual claims
        this.factualClaimPatterns = [
            // Product features and specifications
            /(?:has|features?|includes?|contains?|offers?)\s+([^.!?]+)/gi,
            // Pricing information
            /(?:costs?|priced?\s+at|sells?\s+for|\$[\d,]+(?:\.\d{2})?)/gi,
            // Availability and stock
            /(?:available|in\s+stock|out\s+of\s+stock|discontinued)/gi,
            // Specifications and measurements
            /(?:\d+(?:\.\d+)?\s*(?:inches?|feet|cm|mm|kg|lbs?|oz|gb|mb|tb))/gi,
            // Ratings and reviews
            /(?:rated|reviewed|scored)\s+[\d.]+(?:\s*(?:out\s+of|\/)\s*[\d.]+)?/gi,
        ];
        // Patterns that might indicate hallucination
        this.hallucinationIndicators = [
            /(?:I\s+think|I\s+believe|probably|might\s+be|could\s+be)/gi,
            /(?:based\s+on\s+my\s+knowledge|from\s+what\s+I\s+know)/gi,
            /(?:typically|usually|generally|often)/gi,
            /(?:it\s+seems|appears\s+to\s+be|looks\s+like)/gi,
        ];
        this.config = {
            minGroundingScore: 0.85,
            minCitationRelevance: 0.7,
            maxClaimsPerResponse: 10,
            enableHallucinationDetection: true,
            strictFactChecking: true,
            fallbackThreshold: 0.6,
            ...config,
        };
    }
    async validateResponseGrounding(response, retrievedDocuments, originalQuery) {
        // Extract factual claims from the response
        const factualClaims = this.extractFactualClaims(response);
        // Validate each claim against retrieved documents
        const groundingValidation = await this.validateClaims(factualClaims, retrievedDocuments);
        // Generate document citations
        const citations = this.generateCitations(response, retrievedDocuments, groundingValidation);
        // Calculate quality score
        const qualityScore = this.calculateQualityScore(response, groundingValidation, retrievedDocuments, originalQuery);
        // Determine if fallback is recommended
        const fallbackRecommended = this.shouldRecommendFallback(groundingValidation, qualityScore);
        // Generate improvement suggestions
        const improvementSuggestions = this.generateImprovementSuggestions(groundingValidation, qualityScore);
        return {
            response,
            groundingValidation,
            qualityScore,
            citations,
            fallbackRecommended,
            improvementSuggestions,
        };
    }
    extractFactualClaims(response) {
        const claims = [];
        const sentences = this.splitIntoSentences(response);
        sentences.forEach(sentence => {
            // Skip sentences that are clearly subjective or conversational
            if (this.isSubjectiveSentence(sentence)) {
                return;
            }
            // Extract claims using patterns
            this.factualClaimPatterns.forEach(pattern => {
                const matches = sentence.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        const claim = this.cleanClaim(match);
                        if (claim.length > 10 && claim.length < 200) { // Reasonable claim length
                            claims.push({
                                claim,
                                claimType: this.classifyClaimType(claim),
                                confidence: this.estimateClaimConfidence(claim, sentence),
                                supportingEvidence: [],
                                isValidated: false,
                                validationScore: 0,
                            });
                        }
                    });
                }
            });
            // Also consider the entire sentence as a potential claim if it contains specific information
            if (this.containsSpecificInformation(sentence)) {
                claims.push({
                    claim: sentence.trim(),
                    claimType: this.classifyClaimType(sentence),
                    confidence: this.estimateClaimConfidence(sentence, sentence),
                    supportingEvidence: [],
                    isValidated: false,
                    validationScore: 0,
                });
            }
        });
        // Remove duplicates and limit to max claims
        const uniqueClaims = this.deduplicateClaims(claims);
        return uniqueClaims.slice(0, this.config.maxClaimsPerResponse);
    }
    async validateClaims(claims, documents) {
        const validationDetails = [];
        let validatedClaims = 0;
        for (const claim of claims) {
            const evidence = this.findSupportingEvidence(claim.claim, documents);
            claim.supportingEvidence = evidence;
            if (evidence.length > 0) {
                const validationScore = this.calculateClaimValidationScore(claim.claim, evidence);
                claim.validationScore = validationScore;
                claim.isValidated = validationScore >= this.config.minCitationRelevance;
                if (claim.isValidated) {
                    validatedClaims++;
                }
                validationDetails.push({
                    claim: claim.claim,
                    status: claim.isValidated ? 'validated' : 'unvalidated',
                    evidence,
                    reasoning: this.generateValidationReasoning(claim, evidence),
                });
            }
            else {
                validationDetails.push({
                    claim: claim.claim,
                    status: 'unvalidated',
                    evidence: [],
                    reasoning: 'No supporting evidence found in retrieved documents',
                });
            }
        }
        const totalClaims = claims.length;
        const groundingAccuracy = totalClaims > 0 ? (validatedClaims / totalClaims) * 100 : 0;
        const groundingScore = groundingAccuracy / 100;
        const isGrounded = groundingScore >= this.config.minGroundingScore;
        // Generate citations for validated claims
        const sourceCitations = this.generateSourceCitations(claims, documents);
        return {
            isGrounded,
            groundingScore,
            sourceCitations,
            factualClaims: claims,
            validatedClaims,
            totalClaims,
            groundingAccuracy,
            confidence: this.calculateGroundingConfidence(claims, validatedClaims),
            validationDetails,
        };
    }
    findSupportingEvidence(claim, documents) {
        const evidence = [];
        const claimTokens = this.tokenize(claim.toLowerCase());
        documents.forEach(doc => {
            const docTokens = this.tokenize(doc.snippet.toLowerCase());
            // Check for exact matches
            const exactMatch = this.hasExactMatch(claim, doc.snippet);
            // Check for semantic similarity
            const semanticScore = this.calculateSemanticSimilarity(claimTokens, docTokens);
            if (exactMatch || semanticScore > 0.6) {
                evidence.push({
                    documentId: doc.id,
                    snippet: doc.snippet,
                    relevanceScore: exactMatch ? 1.0 : semanticScore,
                    exactMatch,
                    semanticMatch: semanticScore > 0.6,
                });
            }
        });
        // Sort by relevance score
        return evidence.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    calculateClaimValidationScore(claim, evidence) {
        if (evidence.length === 0) {
            return 0;
        }
        // Weight exact matches higher
        const exactMatches = evidence.filter(e => e.exactMatch);
        const semanticMatches = evidence.filter(e => e.semanticMatch && !e.exactMatch);
        let score = 0;
        if (exactMatches.length > 0) {
            score += 0.8; // High score for exact matches
            score += Math.min(exactMatches.length * 0.1, 0.2); // Bonus for multiple exact matches
        }
        if (semanticMatches.length > 0) {
            const avgSemanticScore = semanticMatches.reduce((sum, e) => sum + e.relevanceScore, 0) / semanticMatches.length;
            score += avgSemanticScore * 0.6; // Lower weight for semantic matches
        }
        return Math.min(score, 1.0);
    }
    generateCitations(response, documents, groundingValidation) {
        const citations = [];
        const citedDocuments = new Set();
        // Generate citations for validated claims
        groundingValidation.factualClaims.forEach(claim => {
            if (claim.isValidated && claim.supportingEvidence.length > 0) {
                claim.supportingEvidence.forEach(evidence => {
                    if (!citedDocuments.has(evidence.documentId)) {
                        const doc = documents.find(d => d.id === evidence.documentId);
                        if (doc) {
                            citations.push({
                                documentId: doc.id,
                                documentTitle: doc.metadata.sku || `Document ${doc.id}`,
                                snippet: evidence.snippet,
                                relevanceScore: evidence.relevanceScore,
                                citationText: `[Source: ${doc.id}]`,
                                sourceUri: doc.metadata.sourceUri,
                                groundingPass: evidence.relevanceScore >= this.config.minCitationRelevance,
                            });
                            citedDocuments.add(evidence.documentId);
                        }
                    }
                });
            }
        });
        return citations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    calculateQualityScore(response, groundingValidation, documents, originalQuery) {
        // Calculate individual dimensions
        const factualAccuracy = groundingValidation.groundingScore;
        const relevance = this.calculateRelevanceScore(response, originalQuery);
        const completeness = this.calculateCompletenessScore(response, documents);
        const clarity = this.calculateClarityScore(response);
        const groundedness = groundingValidation.groundingScore;
        // Detect hallucination
        const hallucination = this.detectHallucination(response, groundingValidation);
        // Calculate overall score
        const overall = (factualAccuracy * 0.3 + relevance * 0.2 + completeness * 0.2 + clarity * 0.1 + groundedness * 0.2);
        // Apply hallucination penalty
        const finalScore = hallucination.detected ? overall * 0.7 : overall;
        // Generate recommendations
        const recommendations = this.generateQualityRecommendations({
            factualAccuracy,
            relevance,
            completeness,
            clarity,
            groundedness,
        }, hallucination);
        return {
            overall: finalScore,
            dimensions: {
                factualAccuracy,
                relevance,
                completeness,
                clarity,
                groundedness,
            },
            hallucination,
            recommendations,
        };
    }
    detectHallucination(response, groundingValidation) {
        if (!this.config.enableHallucinationDetection) {
            return { detected: false, confidence: 0, indicators: [] };
        }
        const indicators = [];
        let hallucinationScore = 0;
        // Check for hallucination indicator phrases
        this.hallucinationIndicators.forEach(pattern => {
            const matches = response.match(pattern);
            if (matches) {
                indicators.push(...matches);
                hallucinationScore += matches.length * 0.2;
            }
        });
        // Check for ungrounded claims
        const ungroundedClaims = groundingValidation.factualClaims.filter(c => !c.isValidated);
        if (ungroundedClaims.length > 0) {
            hallucinationScore += (ungroundedClaims.length / groundingValidation.totalClaims) * 0.5;
            indicators.push(`${ungroundedClaims.length} ungrounded claims detected`);
        }
        // Check for specific information without citations
        if (this.containsSpecificInformation(response) && groundingValidation.sourceCitations.length === 0) {
            hallucinationScore += 0.3;
            indicators.push('Specific information provided without citations');
        }
        const detected = hallucinationScore > 0.4;
        const confidence = Math.min(hallucinationScore, 1.0);
        return { detected, confidence, indicators };
    }
    shouldRecommendFallback(groundingValidation, qualityScore) {
        return (groundingValidation.groundingScore < this.config.fallbackThreshold ||
            qualityScore.overall < this.config.fallbackThreshold ||
            qualityScore.hallucination.detected);
    }
    generateFallbackResponse(originalQuery, documents) {
        if (documents.length === 0) {
            return "I don't have enough information to answer your question accurately. Could you please provide more details or try rephrasing your question?";
        }
        // Generate a simple, template-based response
        const topDocument = documents[0];
        return `Based on the available information, I found some relevant details about ${topDocument.metadata.sku || 'your query'}. However, I want to ensure accuracy, so I recommend reviewing the source material directly. [Source: ${topDocument.id}]`;
    }
    // Helper methods
    splitIntoSentences(text) {
        return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    }
    isSubjectiveSentence(sentence) {
        const subjectiveIndicators = [
            /I\s+think/i, /I\s+believe/i, /in\s+my\s+opinion/i,
            /personally/i, /I\s+feel/i, /I\s+would\s+say/i
        ];
        return subjectiveIndicators.some(pattern => pattern.test(sentence));
    }
    containsSpecificInformation(text) {
        const specificPatterns = [
            /\$[\d,]+(?:\.\d{2})?/, // Prices
            /\d+(?:\.\d+)?\s*(?:inches?|feet|cm|mm|kg|lbs?|oz|gb|mb|tb)/i, // Measurements
            /model\s+\w+/i, // Model numbers
            /version\s+[\d.]+/i, // Version numbers
        ];
        return specificPatterns.some(pattern => pattern.test(text));
    }
    classifyClaimType(claim) {
        if (/\$[\d,]+(?:\.\d{2})?|price|cost|expensive|cheap/i.test(claim)) {
            return 'price';
        }
        if (/available|stock|inventory|discontinued/i.test(claim)) {
            return 'availability';
        }
        if (/\d+(?:\.\d+)?\s*(?:inches?|feet|cm|mm|kg|lbs?|oz|gb|mb|tb)/i.test(claim)) {
            return 'specification';
        }
        if (/features?|includes?|has|contains?|offers?/i.test(claim)) {
            return 'product_feature';
        }
        return 'general_fact';
    }
    estimateClaimConfidence(claim, context) {
        let confidence = 0.5; // Base confidence
        // Higher confidence for specific information
        if (this.containsSpecificInformation(claim)) {
            confidence += 0.3;
        }
        // Lower confidence for vague language
        if (/maybe|perhaps|possibly|might|could/i.test(claim)) {
            confidence -= 0.2;
        }
        // Higher confidence for definitive statements
        if (/is|are|has|have|contains?|includes?/i.test(claim)) {
            confidence += 0.2;
        }
        return Math.max(0.1, Math.min(1.0, confidence));
    }
    cleanClaim(claim) {
        return claim.trim().replace(/^[^\w]+|[^\w]+$/g, '');
    }
    deduplicateClaims(claims) {
        const seen = new Set();
        return claims.filter(claim => {
            const normalized = claim.claim.toLowerCase().trim();
            if (seen.has(normalized)) {
                return false;
            }
            seen.add(normalized);
            return true;
        });
    }
    generateSourceCitations(claims, documents) {
        const citations = [];
        const citedDocs = new Set();
        claims.forEach(claim => {
            if (claim.isValidated) {
                claim.supportingEvidence.forEach(evidence => {
                    if (!citedDocs.has(evidence.documentId)) {
                        const doc = documents.find(d => d.id === evidence.documentId);
                        if (doc) {
                            citations.push({
                                documentId: doc.id,
                                documentTitle: doc.metadata.sku || `Document ${doc.id}`,
                                snippet: evidence.snippet,
                                relevanceScore: evidence.relevanceScore,
                                citationText: `[Source: ${doc.id}]`,
                                sourceUri: doc.metadata.sourceUri,
                                groundingPass: evidence.relevanceScore >= this.config.minCitationRelevance,
                            });
                            citedDocs.add(evidence.documentId);
                        }
                    }
                });
            }
        });
        return citations;
    }
    generateValidationReasoning(claim, evidence) {
        if (evidence.length === 0) {
            return 'No supporting evidence found in the retrieved documents.';
        }
        const exactMatches = evidence.filter(e => e.exactMatch).length;
        const semanticMatches = evidence.filter(e => e.semanticMatch && !e.exactMatch).length;
        if (exactMatches > 0) {
            return `Found ${exactMatches} exact match(es) in the source documents.`;
        }
        else if (semanticMatches > 0) {
            return `Found ${semanticMatches} semantically similar reference(s) in the source documents.`;
        }
        else {
            return 'Found some related content but with low confidence match.';
        }
    }
    calculateGroundingConfidence(claims, validatedClaims) {
        if (claims.length === 0)
            return 1.0;
        const avgValidationScore = claims.reduce((sum, c) => sum + c.validationScore, 0) / claims.length;
        const validationRatio = validatedClaims / claims.length;
        return (avgValidationScore * 0.6) + (validationRatio * 0.4);
    }
    tokenize(text) {
        return text.toLowerCase().split(/\W+/).filter(token => token.length > 2);
    }
    hasExactMatch(claim, document) {
        const claimNormalized = claim.toLowerCase().trim();
        const docNormalized = document.toLowerCase();
        // Check for exact substring match
        if (docNormalized.includes(claimNormalized)) {
            return true;
        }
        // Check for key phrase matches
        const keyPhrases = claimNormalized.split(/\s+/).filter(word => word.length > 3);
        const matchedPhrases = keyPhrases.filter(phrase => docNormalized.includes(phrase));
        return matchedPhrases.length >= Math.ceil(keyPhrases.length * 0.7);
    }
    calculateSemanticSimilarity(tokens1, tokens2) {
        if (tokens1.length === 0 || tokens2.length === 0)
            return 0;
        const set1 = new Set(tokens1);
        const set2 = new Set(tokens2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size; // Jaccard similarity
    }
    calculateRelevanceScore(response, query) {
        const responseTokens = this.tokenize(response);
        const queryTokens = this.tokenize(query);
        return this.calculateSemanticSimilarity(responseTokens, queryTokens);
    }
    calculateCompletenessScore(response, documents) {
        // Simple heuristic: longer responses that reference more documents are more complete
        const responseLength = response.length;
        const documentReferences = documents.filter(doc => response.includes(doc.id) || response.includes(doc.metadata.sku || '')).length;
        const lengthScore = Math.min(responseLength / 500, 1.0); // Normalize to 500 chars
        const referenceScore = Math.min(documentReferences / 3, 1.0); // Normalize to 3 docs
        return (lengthScore * 0.4) + (referenceScore * 0.6);
    }
    calculateClarityScore(response) {
        // Simple heuristics for clarity
        const sentences = this.splitIntoSentences(response);
        const avgSentenceLength = response.length / sentences.length;
        // Penalize very long or very short sentences
        const lengthScore = avgSentenceLength > 20 && avgSentenceLength < 100 ? 1.0 : 0.7;
        // Check for clear structure (presence of connectors, etc.)
        const hasStructure = /first|second|third|also|additionally|furthermore|however|therefore/i.test(response);
        const structureScore = hasStructure ? 1.0 : 0.8;
        return (lengthScore * 0.6) + (structureScore * 0.4);
    }
    generateQualityRecommendations(dimensions, hallucination) {
        const recommendations = [];
        if (dimensions.factualAccuracy < 0.8) {
            recommendations.push('Improve factual accuracy by better grounding claims in source documents');
        }
        if (dimensions.relevance < 0.7) {
            recommendations.push('Ensure response directly addresses the user query');
        }
        if (dimensions.completeness < 0.6) {
            recommendations.push('Provide more comprehensive information from available sources');
        }
        if (dimensions.clarity < 0.7) {
            recommendations.push('Improve response clarity and structure');
        }
        if (hallucination.detected) {
            recommendations.push('Remove speculative language and ensure all claims are supported by evidence');
        }
        return recommendations;
    }
    generateImprovementSuggestions(groundingValidation, qualityScore) {
        const suggestions = [];
        if (groundingValidation.groundingScore < this.config.minGroundingScore) {
            suggestions.push(`Grounding score (${(groundingValidation.groundingScore * 100).toFixed(1)}%) is below target (${(this.config.minGroundingScore * 100)}%)`);
        }
        if (qualityScore.hallucination.detected) {
            suggestions.push('Potential hallucination detected - review response for unsupported claims');
        }
        if (groundingValidation.sourceCitations.length === 0) {
            suggestions.push('Add source citations to support factual claims');
        }
        return suggestions;
    }
    async createFallbackResponse(originalQuery, documents, reason) {
        if (documents.length === 0) {
            return `I apologize, but I don't have enough information to provide a reliable answer to your question about "${originalQuery}". Could you please provide more details or try rephrasing your question?`;
        }
        const topDocuments = documents.slice(0, 2);
        const citations = topDocuments.map(doc => `[Source: ${doc.id}]`).join(' ');
        return `I found some relevant information about your query "${originalQuery}", but to ensure accuracy, I recommend reviewing the source materials directly. ${citations}. ${reason}`;
    }
}
exports.ResponseGroundingService = ResponseGroundingService;
// Export factory function
const createResponseGroundingService = (config) => {
    return new ResponseGroundingService(config);
};
exports.createResponseGroundingService = createResponseGroundingService;
//# sourceMappingURL=ResponseGroundingService.js.map