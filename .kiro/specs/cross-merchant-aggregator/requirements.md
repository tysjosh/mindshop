# Requirements Document: Cross-Merchant Aggregator for MindShop

## Introduction

This document outlines the requirements for adding a consumer-facing cross-merchant aggregator capability to MindShop. This feature enables consumers to search across multiple merchants simultaneously and receive ranked results based on product relevance, price, delivery distance, and merchant ratings. Unlike the existing B2B model where merchants integrate MindShop into their sites, this is a B2C model where consumers visit MindShop directly to discover and compare products across all participating merchants.

## Glossary

- **MindShop Platform**: The AI-powered shopping assistant system
- **Aggregator Mode**: A consumer-facing search capability that queries across multiple merchants simultaneously
- **Cross-Merchant Search**: A search operation that retrieves and ranks products from multiple merchants in a single query
- **Merchant Opt-In**: A merchant's explicit consent to have their products included in cross-merchant search results
- **Multi-Factor Ranking**: A scoring algorithm that combines semantic similarity, price, distance, delivery time, and merchant ratings
- **Semantic Similarity Score**: A measure (0-1) of how closely a product matches the user's query based on embedding distance
- **Distance Score**: A measure of proximity between the user's location and the merchant's location
- **Price Score**: A normalized score based on product price relative to other results
- **Merchant Rating**: An aggregate rating (0-5) based on customer reviews and transaction history
- **Delivery Radius**: The maximum distance a merchant can deliver products to customers
- **User Location**: Geographic coordinates (latitude, longitude) of the consumer making the search
- **Referral Commission**: A percentage fee charged to merchants for sales originating from aggregator search
- **Product Availability**: Real-time inventory status indicating whether a product is in stock

## Requirements

### Requirement 1: Merchant Opt-In for Aggregator Search

**User Story:** As a merchant, I want to opt-in to cross-merchant search, so that my products can be discovered by consumers on the MindShop aggregator platform.

#### Acceptance Criteria

1. WHEN a merchant account is created or updated, THE MindShop Platform SHALL provide an option to enable aggregator search participation
2. THE MindShop Platform SHALL store the merchant's aggregator opt-in status in the merchant settings
3. WHEN a merchant opts in, THE MindShop Platform SHALL require the merchant to provide location information including address, latitude, longitude, and delivery radius
4. THE MindShop Platform SHALL allow merchants to set commission rates for aggregator-sourced sales
5. WHEN a merchant opts out, THE MindShop Platform SHALL exclude their products from all cross-merchant search results
6. THE MindShop Platform SHALL allow merchants to update their aggregator settings at any time

### Requirement 2: Merchant Location Management

**User Story:** As a merchant, I want to specify my store locations and delivery areas, so that consumers within my delivery radius can discover my products.

#### Acceptance Criteria

1. WHEN a merchant opts into aggregator search, THE MindShop Platform SHALL require at least one store location with address, latitude, and longitude
2. THE MindShop Platform SHALL allow merchants to specify a delivery radius in miles for each location
3. THE MindShop Platform SHALL support multiple locations per merchant for businesses with multiple stores
4. WHEN a merchant updates location information, THE MindShop Platform SHALL validate the coordinates and address
5. THE MindShop Platform SHALL store average delivery time estimates for each location
6. THE MindShop Platform SHALL allow merchants to temporarily disable specific locations without removing them

### Requirement 3: Consumer Cross-Merchant Search

**User Story:** As a consumer, I want to search for products across all participating merchants, so that I can find the best options without visiting multiple websites.

#### Acceptance Criteria

1. WHEN a consumer submits a search query, THE MindShop Platform SHALL search across all merchants who have opted into aggregator search
2. THE MindShop Platform SHALL require the consumer's location (latitude, longitude) to calculate delivery distances
3. WHEN searching, THE MindShop Platform SHALL only include merchants within their delivery radius of the consumer's location
4. THE MindShop Platform SHALL generate embeddings for the consumer's query and perform semantic search across all eligible merchant catalogs
5. THE MindShop Platform SHALL return results from multiple merchants in a single unified response
6. THE MindShop Platform SHALL complete cross-merchant searches within 3 seconds for optimal user experience

### Requirement 4: Multi-Factor Ranking Algorithm

**User Story:** As a consumer, I want search results ranked by relevance, price, distance, and merchant quality, so that I can quickly find the best option for my needs.

#### Acceptance Criteria

1. WHEN ranking search results, THE MindShop Platform SHALL calculate a semantic similarity score (0-1) based on embedding distance
2. WHEN ranking search results, THE MindShop Platform SHALL calculate a price score that favors competitive pricing
3. WHEN ranking search results, THE MindShop Platform SHALL calculate a distance score that favors nearby merchants
4. WHEN ranking search results, THE MindShop Platform SHALL calculate a merchant rating score based on historical performance
5. THE MindShop Platform SHALL combine scores using weighted factors: similarity (40%), price (30%), distance (20%), rating (10%)
6. THE MindShop Platform SHALL allow consumers to adjust ranking weights through filter preferences
7. THE MindShop Platform SHALL sort final results by total score in descending order

### Requirement 5: Search Filters and Refinement

**User Story:** As a consumer, I want to filter search results by price, distance, delivery time, and ratings, so that I can narrow down options to my preferences.

#### Acceptance Criteria

1. WHEN a consumer applies filters, THE MindShop Platform SHALL support maximum price filtering
2. WHEN a consumer applies filters, THE MindShop Platform SHALL support maximum distance filtering in miles
3. WHEN a consumer applies filters, THE MindShop Platform SHALL support minimum merchant rating filtering (1-5 stars)
4. WHEN a consumer applies filters, THE MindShop Platform SHALL support maximum delivery time filtering in minutes
5. WHEN a consumer applies filters, THE MindShop Platform SHALL support category filtering based on product types
6. THE MindShop Platform SHALL apply filters before returning results to the consumer
7. THE MindShop Platform SHALL return the count of filtered results along with the results

### Requirement 6: Product Availability and Inventory

**User Story:** As a consumer, I want to see real-time product availability, so that I don't waste time on out-of-stock items.

#### Acceptance Criteria

1. WHEN displaying search results, THE MindShop Platform SHALL show product availability status (in stock, low stock, out of stock)
2. THE MindShop Platform SHALL retrieve availability information from merchant product metadata
3. WHEN a product is out of stock, THE MindShop Platform SHALL rank it lower than in-stock alternatives
4. THE MindShop Platform SHALL allow merchants to update inventory status in real-time via API
5. WHEN a product's availability changes, THE MindShop Platform SHALL reflect the update in search results within 5 minutes

### Requirement 7: Delivery Time Estimation

**User Story:** As a consumer, I want to see estimated delivery times for each result, so that I can choose based on urgency.

#### Acceptance Criteria

1. WHEN displaying search results, THE MindShop Platform SHALL show estimated delivery time for each merchant
2. THE MindShop Platform SHALL calculate delivery time based on merchant's average delivery time and distance to consumer
3. THE MindShop Platform SHALL display delivery time in minutes for times under 120 minutes
4. THE MindShop Platform SHALL display delivery time in hours for times over 120 minutes
5. THE MindShop Platform SHALL allow merchants to specify delivery time ranges (e.g., 30-45 minutes)

### Requirement 8: Search Result Presentation

**User Story:** As a consumer, I want to see comprehensive product information in search results, so that I can make informed decisions without clicking through.

#### Acceptance Criteria

1. WHEN displaying search results, THE MindShop Platform SHALL show product title, description, and image
2. WHEN displaying search results, THE MindShop Platform SHALL show product price and currency
3. WHEN displaying search results, THE MindShop Platform SHALL show merchant name and rating
4. WHEN displaying search results, THE MindShop Platform SHALL show distance from consumer to merchant
5. WHEN displaying search results, THE MindShop Platform SHALL show estimated delivery time
6. WHEN displaying search results, THE MindShop Platform SHALL show availability status
7. WHEN displaying search results, THE MindShop Platform SHALL show a match score indicating relevance to the query

### Requirement 9: Referral Tracking and Commission

**User Story:** As MindShop, I want to track which sales originated from aggregator search, so that I can charge appropriate referral commissions to merchants.

#### Acceptance Criteria

1. WHEN a consumer clicks on a product from search results, THE MindShop Platform SHALL generate a unique referral token
2. THE MindShop Platform SHALL track the referral token through the checkout process
3. WHEN a transaction is completed, THE MindShop Platform SHALL record the referral source as 'aggregator'
4. THE MindShop Platform SHALL calculate commission based on the merchant's agreed commission rate
5. THE MindShop Platform SHALL store commission amounts in the transactions table
6. THE MindShop Platform SHALL provide merchants with reports showing aggregator-sourced sales and commissions

### Requirement 10: Merchant Performance Metrics

**User Story:** As a merchant, I want to see analytics on my aggregator search performance, so that I can optimize my product listings and pricing.

#### Acceptance Criteria

1. WHEN a merchant views aggregator analytics, THE MindShop Platform SHALL show total impressions (appearances in search results)
2. WHEN a merchant views aggregator analytics, THE MindShop Platform SHALL show click-through rate from search results
3. WHEN a merchant views aggregator analytics, THE MindShop Platform SHALL show conversion rate from aggregator traffic
4. WHEN a merchant views aggregator analytics, THE MindShop Platform SHALL show total revenue from aggregator-sourced sales
5. WHEN a merchant views aggregator analytics, THE MindShop Platform SHALL show average ranking position for common queries
6. THE MindShop Platform SHALL allow merchants to filter analytics by date range

### Requirement 11: Geographic Search Optimization

**User Story:** As a consumer, I want search results to prioritize merchants near me, so that I can get faster delivery and support local businesses.

#### Acceptance Criteria

1. WHEN calculating distance, THE MindShop Platform SHALL use the Haversine formula or PostGIS for accurate geographic distance
2. THE MindShop Platform SHALL exclude merchants whose delivery radius does not reach the consumer's location
3. THE MindShop Platform SHALL calculate distance in miles for US-based searches
4. THE MindShop Platform SHALL support distance calculation in kilometers for international searches
5. WHEN multiple merchants have similar products, THE MindShop Platform SHALL favor closer merchants in ranking

### Requirement 12: Search Performance and Scalability

**User Story:** As MindShop, I want cross-merchant searches to be fast and scalable, so that we can handle high consumer traffic without degradation.

#### Acceptance Criteria

1. WHEN executing a cross-merchant search, THE MindShop Platform SHALL complete the search within 3 seconds for 95% of queries
2. THE MindShop Platform SHALL search up to 100 merchants in parallel without timeout
3. THE MindShop Platform SHALL limit results to top 5 products per merchant to control response size
4. THE MindShop Platform SHALL cache merchant location data to reduce database queries
5. THE MindShop Platform SHALL use database indexes on (merchant_id, embedding) for fast semantic search

### Requirement 13: Consumer Search History and Personalization

**User Story:** As a consumer, I want my search history saved, so that I can revisit previous searches and get personalized recommendations.

#### Acceptance Criteria

1. WHEN a consumer performs a search, THE MindShop Platform SHALL store the search query, location, and timestamp
2. THE MindShop Platform SHALL associate searches with a user ID or anonymous session ID
3. THE MindShop Platform SHALL allow consumers to view their search history
4. THE MindShop Platform SHALL track which merchants and products consumers clicked on
5. THE MindShop Platform SHALL use search history to personalize future ranking (optional enhancement)

### Requirement 14: Merchant Exclusion and Blocking

**User Story:** As a consumer, I want to hide specific merchants from my search results, so that I only see options from merchants I trust.

#### Acceptance Criteria

1. WHEN a consumer blocks a merchant, THE MindShop Platform SHALL exclude that merchant from all future search results for that consumer
2. THE MindShop Platform SHALL store merchant exclusions per user or session
3. THE MindShop Platform SHALL allow consumers to unblock merchants at any time
4. THE MindShop Platform SHALL provide a UI for managing blocked merchants

### Requirement 15: API Rate Limiting for Consumer Searches

**User Story:** As MindShop, I want to rate limit consumer search requests, so that we prevent abuse and ensure fair resource allocation.

#### Acceptance Criteria

1. WHEN a consumer makes search requests, THE MindShop Platform SHALL limit requests to 60 per minute per IP address
2. IF a consumer exceeds the rate limit, THEN THE MindShop Platform SHALL return a 429 Too Many Requests error
3. THE MindShop Platform SHALL provide rate limit information in response headers
4. THE MindShop Platform SHALL allow authenticated users higher rate limits than anonymous users
5. THE MindShop Platform SHALL implement exponential backoff for repeated violations

### Requirement 16: Merchant Catalog Freshness

**User Story:** As a merchant, I want my product updates reflected in aggregator search quickly, so that consumers see accurate information.

#### Acceptance Criteria

1. WHEN a merchant updates product information, THE MindShop Platform SHALL reflect changes in search results within 5 minutes
2. WHEN a merchant adds new products, THE MindShop Platform SHALL include them in search results within 5 minutes
3. WHEN a merchant removes products, THE MindShop Platform SHALL exclude them from search results within 5 minutes
4. THE MindShop Platform SHALL regenerate embeddings for updated products automatically
5. THE MindShop Platform SHALL provide merchants with a "refresh catalog" API endpoint for immediate updates

### Requirement 17: Search Analytics and Insights

**User Story:** As MindShop, I want to analyze aggregator search patterns, so that I can improve the ranking algorithm and user experience.

#### Acceptance Criteria

1. WHEN consumers perform searches, THE MindShop Platform SHALL log query text, result count, and user location
2. THE MindShop Platform SHALL track which results consumers click on and their ranking positions
3. THE MindShop Platform SHALL calculate click-through rates for different ranking positions
4. THE MindShop Platform SHALL identify popular search queries and trending products
5. THE MindShop Platform SHALL provide dashboards showing search volume, conversion rates, and merchant performance
