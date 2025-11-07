# Implementation Plan: Cross-Merchant Aggregator for MindShop

## Overview

This implementation plan breaks down the cross-merchant aggregator feature into discrete, manageable coding tasks. Each task builds incrementally, enabling consumers to search across multiple merchants and receive intelligently ranked results based on relevance, price, distance, and merchant quality.

## Task List

- [ ] 1. Database schema for aggregator support
  - Create migration file for aggregator tables
  - Add aggregator_settings table with merchant opt-in and commission configuration
  - Add merchant_locations table with geographic data and delivery radius
  - Add aggregator_searches table for search logging and analytics
  - Add search_result_clicks table for click tracking
  - Add merchant_ratings table for merchant performance metrics
  - Update transactions table with referral_source, referral_token, commission_rate, and commission_amount columns
  - Add PostGIS spatial indexes for geographic queries
  - Add composite indexes for performance optimization
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 2. Update Drizzle schema definitions
  - [ ] 2.1 Create aggregator_settings table schema
    - Define table with merchantId, aggregatorEnabled, commissionRate, minOrderValue, maxOrderValue, acceptedPaymentMethods
    - Add foreign key constraint to merchants table
    - Add indexes for merchantId and aggregatorEnabled
    - Define AggregatorSettings TypeScript types
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ] 2.2 Create merchant_locations table schema
    - Define table with merchantId, locationName, address, city, state, zipCode, latitude, longitude, deliveryRadius, avgDeliveryTime
    - Add foreign key constraint to merchants table
    - Add spatial index for geographic queries
    - Add indexes for merchantId and isActive
    - Define MerchantLocation TypeScript types
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ] 2.3 Create aggregator_searches table schema
    - Define table with searchId, userId, sessionId, query, queryEmbedding, userLatitude, userLongitude, filters, merchantsSearched, resultsCount, responseTimeMs
    - Add indexes for userId, sessionId, and timestamp
    - Define AggregatorSearch TypeScript types
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 13.1, 13.2, 13.3, 13.4_
  
  - [ ] 2.4 Create search_result_clicks table schema
    - Define table with searchId, merchantId, productId, rankPosition, clickedAt
    - Add foreign key constraint to aggregator_searches table
    - Add indexes for searchId, merchantId, and productId
    - Define SearchResultClick TypeScript types
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ] 2.5 Create merchant_ratings table schema
    - Define table with merchantId, averageRating, totalRatings, totalOrders, successfulOrders, avgResponseTime, onTimeDeliveryRate
    - Add foreign key constraint to merchants table
    - Add indexes for merchantId and averageRating
    - Define MerchantRating TypeScript types
    - _Requirements: 4.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [ ] 2.6 Extend transactions table schema
    - Add referralSource, referralToken, commissionRate, commissionAmount columns
    - Add indexes for referralSource and referralToken
    - Update Transaction TypeScript types
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 3. Implement LocationService
  - [ ] 3.1 Create LocationService class
    - Implement findNearbyMerchants method using PostGIS earth_distance
    - Filter by delivery radius and aggregator opt-in status
    - Return merchants within specified distance
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 3.2 Add distance calculation methods
    - Implement calculateDistance using Haversine formula
    - Support both miles and kilometers
    - Implement estimateDeliveryTime based on distance and base time
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.2, 11.3_

- [ ] 4. Implement RankingService
  - [ ] 4.1 Create RankingService class with multi-factor ranking
    - Implement rankResults method with weighted scoring
    - Calculate similarity score from embedding distance (40% weight)
    - Calculate price score with min-max normalization (30% weight)
    - Calculate distance score with linear decay (20% weight)
    - Calculate rating score normalized to 0-1 (10% weight)
    - Combine scores using configurable weights
    - Sort results by total score descending
    - Assign rank positions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [ ] 4.2 Add support for custom ranking weights
    - Allow consumers to override default weights
    - Validate weights sum to 1.0
    - Apply custom weights in scoring calculation
    - _Requirements: 4.6_

- [ ] 5. Implement AggregatorSearchService
  - [ ] 5.1 Create AggregatorSearchService class
    - Implement search method as main entry point
    - Generate unique searchId for each search
    - Track search start time for performance metrics
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [ ] 5.2 Implement merchant discovery logic
    - Call LocationService to find nearby merchants
    - Handle case when no merchants are nearby
    - Filter merchants by aggregator opt-in status
    - _Requirements: 3.1, 3.2, 3.3, 11.1, 11.2_
  
  - [ ] 5.3 Implement parallel catalog search
    - Generate query embedding using EmbeddingService
    - Search each merchant's catalog in parallel using Promise.all
    - Limit to top 5 products per merchant
    - Apply filters during semantic search (inStock, categories)
    - _Requirements: 3.4, 3.5, 6.1, 6.2, 6.3, 12.1, 12.2, 12.3_
  
  - [ ] 5.4 Implement result aggregation and ranking
    - Flatten results from all merchants
    - Calculate distance for each merchant
    - Call RankingService to rank results
    - Apply post-ranking filters (maxPrice, maxDistance, minRating, maxDeliveryTime)
    - Limit final results to specified limit (default 50)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ] 5.5 Implement search logging
    - Log search query, location, filters, merchants searched
    - Store query embedding for analytics
    - Record results count and response time
    - Associate with userId or sessionId
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [ ] 5.6 Add search result presentation formatting
    - Format product information (title, description, price, image, inStock)
    - Format merchant information (name, rating, distance, deliveryTime, location)
    - Include all score components (similarity, price, distance, rating, total)
    - Include rank position for each result
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 6. Implement MerchantAggregatorService
  - [ ] 6.1 Create MerchantAggregatorService class
    - Implement enableAggregator method to opt merchants into aggregator
    - Implement disableAggregator method to opt merchants out
    - Store commission rate and order value constraints
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ] 6.2 Implement location management methods
    - Implement addLocation method to add merchant store locations
    - Implement updateLocation method to modify location details
    - Implement deactivateLocation method to temporarily disable locations
    - Validate latitude/longitude coordinates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ] 6.3 Implement merchant analytics methods
    - Implement getAggregatorAnalytics method
    - Calculate impressions (appearances in search results)
    - Calculate clicks from search results
    - Calculate conversions from aggregator traffic
    - Calculate revenue and commission from aggregator sales
    - Calculate CTR and conversion rate
    - Support date range filtering
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 7. Implement ClickTrackingService
  - [ ] 7.1 Create ClickTrackingService class
    - Implement trackClick method to log search result clicks
    - Store searchId, merchantId, productId, and rankPosition
    - Record timestamp of click
    - _Requirements: 9.1, 9.2, 9.3, 13.4, 17.2, 17.3_
  
  - [ ] 7.2 Implement referral token generation
    - Implement generateReferralToken method
    - Create unique token linking search to merchant and product
    - Store token with expiration time
    - Return token for checkout tracking
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ] 7.3 Implement referral validation
    - Implement validateReferralToken method
    - Verify token is valid and not expired
    - Extract searchId, merchantId, productId from token
    - Mark token as used after validation
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 8. Create AggregatorSearchController
  - [ ] 8.1 Implement search endpoint handler
    - Validate required fields (query, location, sessionId)
    - Validate location coordinates are valid numbers
    - Validate filters if provided
    - Call AggregatorSearchService.search
    - Return formatted search results
    - Handle errors with appropriate HTTP status codes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ] 8.2 Implement click tracking endpoint handler
    - Validate required fields (searchId, merchantId, productId, rankPosition)
    - Call ClickTrackingService.trackClick
    - Return success response
    - _Requirements: 9.1, 9.2, 9.3, 13.4, 17.2, 17.3_
  
  - [ ] 8.3 Implement referral token endpoint handler
    - Validate required fields (searchId, merchantId, productId)
    - Call ClickTrackingService.generateReferralToken
    - Return referral token
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 9. Create MerchantAggregatorController
  - [ ] 9.1 Implement enableAggregator endpoint handler
    - Verify merchant ownership via authContext
    - Validate commission rate and order constraints
    - Call MerchantAggregatorService.enableAggregator
    - Return success response
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ] 9.2 Implement addLocation endpoint handler
    - Verify merchant ownership
    - Validate location data (address, coordinates, delivery radius)
    - Call MerchantAggregatorService.addLocation
    - Return created location
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ] 9.3 Implement getAnalytics endpoint handler
    - Verify merchant ownership
    - Parse date range from query parameters
    - Call MerchantAggregatorService.getAggregatorAnalytics
    - Return analytics data
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 10. Create aggregator API routes
  - [ ] 10.1 Create aggregator routes file
    - Define POST /api/aggregator/search route (public, rate limited)
    - Define POST /api/aggregator/search/click route (public, rate limited)
    - Define POST /api/aggregator/search/referral-token route (public, rate limited)
    - Apply rate limiting middleware to all public routes
    - _Requirements: 3.1, 3.2, 3.3, 9.1, 9.2, 9.3, 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 10.2 Add merchant aggregator management routes
    - Define POST /api/merchants/:merchantId/aggregator/enable route (authenticated)
    - Define POST /api/merchants/:merchantId/aggregator/disable route (authenticated)
    - Define POST /api/merchants/:merchantId/aggregator/locations route (authenticated)
    - Define PUT /api/merchants/:merchantId/aggregator/locations/:locationId route (authenticated)
    - Define GET /api/merchants/:merchantId/aggregator/analytics route (authenticated)
    - Apply authentication middleware to all merchant routes
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 10.1, 10.2, 10.3_
  
  - [ ] 10.3 Register aggregator routes in main app
    - Import aggregator routes in src/api/app.ts
    - Mount routes at /api/aggregator path
    - _Requirements: 3.1_

- [ ] 11. Implement rate limiting for aggregator endpoints
  - [ ] 11.1 Create rate limiting middleware
    - Implement rateLimitAggregator middleware
    - Set limit to 60 requests per minute per IP
    - Use IP address as key for anonymous users
    - Return 429 status code when limit exceeded
    - Include retry-after header in response
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 11.2 Add higher limits for authenticated users
    - Detect authenticated users from request
    - Apply higher rate limit (e.g., 120 requests per minute)
    - Use userId as key instead of IP
    - _Requirements: 15.4_

- [ ] 12. Implement input validation and sanitization
  - [ ] 12.1 Create validation utilities
    - Implement validateSearchRequest function
    - Validate query is string and not too long (max 500 chars)
    - Validate location coordinates are valid numbers within range
    - Validate filters (maxPrice >= 0, maxDistance >= 0, minRating 0-5)
    - Sanitize user inputs to prevent injection attacks
    - _Requirements: 3.1, 3.2, 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 12.2 Add validation to all controller methods
    - Apply validation before processing requests
    - Return 400 Bad Request for invalid inputs
    - Include descriptive error messages
    - _Requirements: 3.1, 3.2, 5.1, 5.2_

- [ ] 13. Update checkout flow for referral tracking
  - [ ] 13.1 Modify checkout endpoint to accept referral token
    - Add referralToken optional parameter to checkout request
    - Validate referral token if provided
    - Extract merchant and product information from token
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ] 13.2 Calculate and store commission
    - Retrieve merchant's commission rate from aggregator_settings
    - Calculate commission amount based on order total
    - Store referralSource as 'aggregator' in transaction
    - Store referralToken, commissionRate, and commissionAmount
    - _Requirements: 9.4, 9.5, 9.6_
  
  - [ ] 13.3 Update transaction completion logic
    - Mark referral token as used when transaction completes
    - Update merchant ratings based on transaction outcome
    - Track successful vs failed orders for merchant performance
    - _Requirements: 9.5, 9.6, 10.1, 10.2, 10.3_

- [ ] 14. Implement merchant rating updates
  - [ ] 14.1 Create rating update service
    - Implement updateMerchantRating method
    - Calculate new average rating from transaction feedback
    - Update total orders and successful orders count
    - Calculate on-time delivery rate
    - Update average response time
    - _Requirements: 4.4, 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 14.2 Add rating update triggers
    - Update ratings when transaction completes
    - Update ratings when customer provides feedback
    - Recalculate ratings periodically for accuracy
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 15. Implement caching for performance
  - [ ] 15.1 Create AggregatorCacheService
    - Implement merchant info caching with 5-minute TTL
    - Implement nearby merchants caching with 10-minute TTL
    - Use location grid for cache keys
    - Implement cache invalidation on merchant updates
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ] 15.2 Integrate caching into search flow
    - Check cache before database queries
    - Store results in cache after queries
    - Use cached data when available
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 16. Add search analytics and insights
  - [ ] 16.1 Create analytics service
    - Implement getSearchAnalytics method
    - Calculate search volume by time period
    - Identify popular search queries
    - Calculate average response times
    - Track click-through rates by rank position
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [ ] 16.2 Create analytics dashboard endpoints
    - Implement endpoint for overall search metrics
    - Implement endpoint for trending queries
    - Implement endpoint for merchant performance comparison
    - Implement endpoint for conversion funnel analysis
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 17. Implement product availability tracking
  - [ ] 17.1 Add inventory update endpoint
    - Create endpoint for merchants to update product availability
    - Support real-time inventory updates via API
    - Validate merchant ownership of products
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [ ] 17.2 Update search to prioritize in-stock items
    - Filter out-of-stock items when inStockOnly filter is true
    - Rank in-stock items higher than out-of-stock
    - Display availability status in search results
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.6_

- [ ] 18. Create consumer-facing web application
  - [ ] 18.1 Build search interface
    - Create search input component
    - Implement location detection using browser geolocation API
    - Add filter controls (price, distance, rating, delivery time)
    - Display loading state during search
    - _Requirements: 3.1, 3.2, 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 18.2 Build results display component
    - Display product cards with all information
    - Show merchant details and distance
    - Display match scores and ranking
    - Add click tracking on result clicks
    - Implement "Add to Cart" or "View Details" actions
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  
  - [ ] 18.3 Implement search history
    - Store search history in local storage or user account
    - Display recent searches
    - Allow users to revisit previous searches
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [ ] 18.4 Add merchant blocking feature
    - Allow users to block/hide specific merchants
    - Store blocked merchants in user preferences
    - Filter blocked merchants from search results
    - Provide UI to manage blocked merchants
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 19. Create integration tests
  - [ ] 19.1 Test cross-merchant search
    - Create test with multiple merchants and products
    - Verify search returns results from all merchants
    - Verify results are properly ranked
    - Verify filters are applied correctly
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2_
  
  - [ ] 19.2 Test geographic filtering
    - Create test with merchants at various distances
    - Verify only nearby merchants are included
    - Verify distance calculations are accurate
    - Verify delivery radius is respected
    - _Requirements: 2.4, 3.3, 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 19.3 Test referral tracking
    - Create test for complete referral flow
    - Verify referral token generation
    - Verify token validation in checkout
    - Verify commission calculation
    - Verify transaction tracking
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ] 19.4 Test merchant analytics
    - Create test with search, click, and conversion events
    - Verify impressions are counted correctly
    - Verify clicks are tracked
    - Verify conversions are attributed
    - Verify analytics calculations (CTR, conversion rate)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 20. Create performance tests
  - [ ] 20.1 Test search performance with many merchants
    - Create test with 50+ merchants and 100+ products each
    - Verify search completes within 3 seconds
    - Measure response time at different scales
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ] 20.2 Test concurrent search handling
    - Create test with 100+ concurrent searches
    - Verify all searches complete successfully
    - Verify no performance degradation
    - Verify rate limiting works correctly
    - _Requirements: 12.1, 12.2, 15.1, 15.2_

- [ ] 21. Update API documentation
  - [ ] 21.1 Document aggregator search API
    - Document POST /api/aggregator/search endpoint
    - Include request/response examples
    - Document all filter options
    - Document ranking weights customization
    - _Requirements: 3.1, 3.2, 3.3, 4.6, 5.1, 5.2, 5.3_
  
  - [ ] 21.2 Document merchant aggregator management API
    - Document merchant opt-in endpoints
    - Document location management endpoints
    - Document analytics endpoints
    - Include integration examples
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 10.1, 10.2_
  
  - [ ] 21.3 Create merchant integration guide
    - Write step-by-step guide for merchants to opt-in
    - Document how to add locations
    - Document how to update inventory
    - Document how to view analytics
    - Include best practices for optimization
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 6.4, 10.1_

- [ ] 22. Add monitoring and observability
  - [ ] 22.1 Add aggregator-specific metrics
    - Track search volume and response times
    - Track merchant participation rate
    - Track conversion rates from aggregator
    - Track commission revenue
    - _Requirements: 12.1, 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [ ] 22.2 Add logging for debugging
    - Log all search requests with parameters
    - Log search performance metrics
    - Log errors and failures
    - Log referral tracking events
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

## Implementation Notes

- All tasks should maintain backward compatibility with existing merchant functionality
- Database migrations should be tested on a copy of production data before deployment
- Geographic queries require PostGIS extension to be installed
- Search performance is critical - aim for sub-3-second response times
- Rate limiting should be carefully tuned to prevent abuse while allowing legitimate usage
- Commission tracking must be accurate for billing purposes
- All new code should follow existing code style and patterns in the codebase
- Security is paramount - validate all user inputs and prevent injection attacks
