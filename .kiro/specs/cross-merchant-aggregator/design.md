# Design Document: Cross-Merchant Aggregator for MindShop

## Overview

This design document outlines the technical architecture for adding a consumer-facing cross-merchant aggregator to MindShop. This feature enables consumers to search across multiple merchants simultaneously and receive intelligently ranked results based on semantic relevance, price, delivery distance, and merchant quality. The design leverages existing infrastructure (embeddings, document storage, semantic search) while adding new components for location-based filtering, multi-merchant querying, and sophisticated ranking algorithms.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MindShop Platform                             │
│                   (Three Operating Modes)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Mode 1: Direct Merchant (B2B)                                  │
│  └─ Widget embedded on merchant site                           │
│                                                                  │
│  Mode 2: Platform Merchant (B2B2C)                             │
│  └─ Widget embedded on platform → stores                       │
│                                                                  │
│  Mode 3: Aggregator (B2C) ← NEW                                │
│  └─ Consumer app searches across all merchants                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cross-Merchant Search Flow

```
Consumer Query: "organic almond milk near me"
         ↓
    [User Location: 37.7749, -122.4194]
         ↓
┌────────────────────────────────────────┐
│  1. Find Nearby Merchants              │
│     - Query merchant_locations         │
│     - Filter by delivery radius        │
│     - Filter by opt-in status          │
└────────────────┬───────────────────────┘
                 ↓
         [Merchants: Whole Foods, Target, Safeway]
                 ↓
┌────────────────────────────────────────┐
│  2. Generate Query Embedding           │
│     - Embed: "organic almond milk"     │
└────────────────┬───────────────────────┘
                 ↓
         [Embedding Vector: [0.23, -0.45, ...]]
                 ↓
┌────────────────────────────────────────┐
│  3. Parallel Semantic Search           │
│     - Search Whole Foods catalog       │
│     - Search Target catalog            │
│     - Search Safeway catalog           │
│     - Top 5 results per merchant       │
└────────────────┬───────────────────────┘
                 ↓
         [15 Product Matches Total]
                 ↓
┌────────────────────────────────────────┐
│  4. Multi-Factor Ranking               │
│     - Similarity Score (40%)           │
│     - Price Score (30%)                │
│     - Distance Score (20%)             │
│     - Rating Score (10%)               │
└────────────────┬───────────────────────┘
                 ↓
         [Ranked Results 1-15]
                 ↓
┌────────────────────────────────────────┐
│  5. Apply Filters                      │
│     - Max price: $10                   │
│     - Max distance: 5 miles            │
│     - Min rating: 4.0                  │
└────────────────┬───────────────────────┘
                 ↓
         [Final Results: 8 products]
                 ↓
    Return to Consumer
```

## Components and Interfaces

### 1. Database Schema Extensions

#### Merchant Locations Table

```typescript
export const merchantLocations = pgTable(
  "merchant_locations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    locationName: text("location_name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zipCode: text("zip_code").notNull(),
    country: text("country").notNull().default("US"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    deliveryRadius: real("delivery_radius").notNull(), // in miles
    avgDeliveryTime: real("avg_delivery_time").notNull(), // in minutes
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    merchantIdx: index("idx_merchant_locations_merchant").on(table.merchantId),
    activeIdx: index("idx_merchant_locations_active").on(table.isActive),
    // PostGIS spatial index for geographic queries
    geoIdx: index("idx_merchant_locations_geo").using(
      "gist",
      sql`ll_to_earth(${table.latitude}, ${table.longitude})`
    ),
  })
);
```

#### Aggregator Settings Table

```typescript
export const aggregatorSettings = pgTable(
  "aggregator_settings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .unique()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    aggregatorEnabled: boolean("aggregator_enabled").notNull().default(false),
    commissionRate: real("commission_rate").notNull().default(0.05), // 5%
    minOrderValue: real("min_order_value").default(0),
    maxOrderValue: real("max_order_value"),
    acceptedPaymentMethods: jsonb("accepted_payment_methods").default(
      sql`'["card", "digital_wallet"]'::jsonb`
    ),
    settings: jsonb("settings").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    merchantIdx: index("idx_aggregator_settings_merchant").on(table.merchantId),
    enabledIdx: index("idx_aggregator_settings_enabled").on(
      table.aggregatorEnabled
    ),
  })
);
```

#### Aggregator Searches Table

```typescript
export const aggregatorSearches = pgTable(
  "aggregator_searches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    searchId: text("search_id").notNull().unique(),
    userId: text("user_id"), // null for anonymous
    sessionId: text("session_id").notNull(),
    query: text("query").notNull(),
    queryEmbedding: vector("query_embedding", { dimensions: 1536 }),
    userLatitude: real("user_latitude").notNull(),
    userLongitude: real("user_longitude").notNull(),
    filters: jsonb("filters").default(sql`'{}'::jsonb`),
    merchantsSearched: jsonb("merchants_searched").notNull(), // array of merchant IDs
    resultsCount: integer("results_count").notNull(),
    responseTimeMs: real("response_time_ms").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_aggregator_searches_user").on(table.userId),
    sessionIdx: index("idx_aggregator_searches_session").on(table.sessionId),
    timestampIdx: index("idx_aggregator_searches_timestamp").on(table.timestamp),
  })
);
```

#### Search Result Clicks Table

```typescript
export const searchResultClicks = pgTable(
  "search_result_clicks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    searchId: text("search_id")
      .notNull()
      .references(() => aggregatorSearches.searchId),
    merchantId: text("merchant_id").notNull(),
    productId: text("product_id").notNull(),
    rankPosition: integer("rank_position").notNull(),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    searchIdx: index("idx_search_clicks_search").on(table.searchId),
    merchantIdx: index("idx_search_clicks_merchant").on(table.merchantId),
    productIdx: index("idx_search_clicks_product").on(table.productId),
  })
);
```

#### Merchant Ratings Table

```typescript
export const merchantRatings = pgTable(
  "merchant_ratings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.merchantId, { onDelete: "cascade" }),
    averageRating: real("average_rating").notNull().default(5.0),
    totalRatings: integer("total_ratings").notNull().default(0),
    totalOrders: integer("total_orders").notNull().default(0),
    successfulOrders: integer("successful_orders").notNull().default(0),
    avgResponseTime: real("avg_response_time"), // minutes
    onTimeDeliveryRate: real("on_time_delivery_rate").default(1.0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    merchantIdx: index("idx_merchant_ratings_merchant").on(table.merchantId),
    ratingIdx: index("idx_merchant_ratings_rating").on(table.averageRating),
  })
);
```

#### Update Transactions Table

```typescript
// Add to existing transactions table
export const transactions = pgTable("transactions", {
  // ... existing fields ...
  referralSource: text("referral_source"), // 'direct', 'aggregator', 'platform'
  referralToken: text("referral_token"),
  commissionRate: real("commission_rate"),
  commissionAmount: real("commission_amount"),
});
```

### 2. Core Services

#### AggregatorSearchService

```typescript
// src/services/AggregatorSearchService.ts

export interface SearchParams {
  query: string;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  filters?: {
    maxPrice?: number;
    maxDistance?: number; // miles
    minRating?: number;
    maxDeliveryTime?: number; // minutes
    categories?: string[];
    inStockOnly?: boolean;
  };
  userId?: string;
  sessionId: string;
  limit?: number;
}

export interface SearchResult {
  searchId: string;
  query: string;
  resultsCount: number;
  responseTimeMs: number;
  results: ProductMatch[];
}

export interface ProductMatch {
  product: {
    id: string;
    sku: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    image: string;
    inStock: boolean;
    category: string;
  };
  merchant: {
    id: string;
    name: string;
    rating: number;
    totalOrders: number;
    distance: number; // miles
    deliveryTime: number; // minutes
    location: {
      address: string;
      city: string;
      state: string;
    };
  };
  scores: {
    similarity: number; // 0-1
    price: number; // 0-1
    distance: number; // 0-1
    rating: number; // 0-1
    total: number; // weighted sum
  };
  rankPosition: number;
}

export class AggregatorSearchService {
  private embeddingService: EmbeddingService;
  private locationService: LocationService;
  private rankingService: RankingService;
  
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.locationService = new LocationService();
    this.rankingService = new RankingService();
  }
  
  async search(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();
    const searchId = generateSearchId();
    
    // 1. Find nearby merchants
    const nearbyMerchants = await this.locationService.findNearbyMerchants(
      params.userLocation,
      params.filters?.maxDistance || 25 // default 25 miles
    );
    
    if (nearbyMerchants.length === 0) {
      return {
        searchId,
        query: params.query,
        resultsCount: 0,
        responseTimeMs: Date.now() - startTime,
        results: [],
      };
    }
    
    // 2. Generate query embedding
    const queryEmbedding = await this.embeddingService.generate(params.query);
    
    // 3. Search each merchant's catalog in parallel
    const searchPromises = nearbyMerchants.map(merchant =>
      this.searchMerchantCatalog(
        merchant.merchantId,
        queryEmbedding,
        params.filters
      )
    );
    
    const merchantResults = await Promise.all(searchPromises);
    
    // 4. Flatten results
    const allMatches: ProductMatch[] = merchantResults
      .flat()
      .map(match => ({
        ...match,
        merchant: {
          ...match.merchant,
          distance: this.locationService.calculateDistance(
            params.userLocation,
            match.merchant.location
          ),
        },
      }));
    
    // 5. Rank results using multi-factor algorithm
    const rankedResults = await this.rankingService.rankResults(
      allMatches,
      params
    );
    
    // 6. Apply filters
    const filteredResults = this.applyFilters(rankedResults, params.filters);
    
    // 7. Limit results
    const finalResults = filteredResults.slice(0, params.limit || 50);
    
    // 8. Log search
    await this.logSearch({
      searchId,
      userId: params.userId,
      sessionId: params.sessionId,
      query: params.query,
      queryEmbedding,
      userLocation: params.userLocation,
      filters: params.filters,
      merchantsSearched: nearbyMerchants.map(m => m.merchantId),
      resultsCount: finalResults.length,
      responseTimeMs: Date.now() - startTime,
    });
    
    return {
      searchId,
      query: params.query,
      resultsCount: finalResults.length,
      responseTimeMs: Date.now() - startTime,
      results: finalResults,
    };
  }
  
  private async searchMerchantCatalog(
    merchantId: string,
    queryEmbedding: number[],
    filters?: SearchParams["filters"]
  ): Promise<ProductMatch[]> {
    // Build where clause
    const conditions = [eq(documents.merchantId, merchantId)];
    
    if (filters?.inStockOnly) {
      conditions.push(
        sql`${documents.metadata}->>'inStock' = 'true'`
      );
    }
    
    if (filters?.categories && filters.categories.length > 0) {
      conditions.push(
        sql`${documents.metadata}->>'category' = ANY(${filters.categories})`
      );
    }
    
    // Semantic search with filters
    const products = await db
      .select({
        id: documents.id,
        sku: documents.sku,
        title: documents.title,
        body: documents.body,
        metadata: documents.metadata,
        embedding: documents.embedding,
        similarity: sql<number>`1 - (${documents.embedding} <-> ${queryEmbedding})`,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(sql`${documents.embedding} <-> ${queryEmbedding}`)
      .limit(5); // Top 5 per merchant
    
    // Get merchant info
    const merchant = await this.getMerchantInfo(merchantId);
    
    return products.map(p => ({
      product: {
        id: p.id,
        sku: p.sku,
        title: p.title,
        description: p.body,
        price: p.metadata.price,
        currency: p.metadata.currency || "USD",
        image: p.metadata.image,
        inStock: p.metadata.inStock,
        category: p.metadata.category,
      },
      merchant,
      scores: {
        similarity: p.similarity,
        price: 0, // calculated in ranking
        distance: 0, // calculated in ranking
        rating: 0, // calculated in ranking
        total: 0, // calculated in ranking
      },
      rankPosition: 0, // assigned after ranking
    }));
  }
  
  private applyFilters(
    results: ProductMatch[],
    filters?: SearchParams["filters"]
  ): ProductMatch[] {
    let filtered = results;
    
    if (filters?.maxPrice) {
      filtered = filtered.filter(r => r.product.price <= filters.maxPrice!);
    }
    
    if (filters?.maxDistance) {
      filtered = filtered.filter(r => r.merchant.distance <= filters.maxDistance!);
    }
    
    if (filters?.minRating) {
      filtered = filtered.filter(r => r.merchant.rating >= filters.minRating!);
    }
    
    if (filters?.maxDeliveryTime) {
      filtered = filtered.filter(
        r => r.merchant.deliveryTime <= filters.maxDeliveryTime!
      );
    }
    
    if (filters?.inStockOnly) {
      filtered = filtered.filter(r => r.product.inStock);
    }
    
    return filtered;
  }
}
```


#### LocationService

```typescript
// src/services/LocationService.ts

export interface MerchantLocation {
  merchantId: string;
  locationId: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  deliveryRadius: number;
  avgDeliveryTime: number;
}

export class LocationService {
  async findNearbyMerchants(
    userLocation: { latitude: number; longitude: number },
    maxDistance: number
  ): Promise<MerchantLocation[]> {
    // Use PostGIS earth_distance for accurate geographic calculations
    const merchants = await db
      .select()
      .from(merchantLocations)
      .innerJoin(
        aggregatorSettings,
        eq(merchantLocations.merchantId, aggregatorSettings.merchantId)
      )
      .where(
        and(
          eq(merchantLocations.isActive, true),
          eq(aggregatorSettings.aggregatorEnabled, true),
          sql`
            earth_distance(
              ll_to_earth(${userLocation.latitude}, ${userLocation.longitude}),
              ll_to_earth(${merchantLocations.latitude}, ${merchantLocations.longitude})
            ) <= ${maxDistance * 1609.34} -- miles to meters
          `
        )
      );
    
    return merchants.map(m => ({
      merchantId: m.merchant_locations.merchantId,
      locationId: m.merchant_locations.id,
      locationName: m.merchant_locations.locationName,
      address: m.merchant_locations.address,
      city: m.merchant_locations.city,
      state: m.merchant_locations.state,
      latitude: m.merchant_locations.latitude,
      longitude: m.merchant_locations.longitude,
      deliveryRadius: m.merchant_locations.deliveryRadius,
      avgDeliveryTime: m.merchant_locations.avgDeliveryTime,
    }));
  }
  
  calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    // Haversine formula for distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.latitude)) *
        Math.cos(this.toRad(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
  
  estimateDeliveryTime(
    distance: number,
    baseDeliveryTime: number
  ): number {
    // Add 5 minutes per mile to base delivery time
    return baseDeliveryTime + distance * 5;
  }
}
```

#### RankingService

```typescript
// src/services/RankingService.ts

export interface RankingWeights {
  similarity: number; // default 0.4
  price: number; // default 0.3
  distance: number; // default 0.2
  rating: number; // default 0.1
}

export class RankingService {
  private defaultWeights: RankingWeights = {
    similarity: 0.4,
    price: 0.3,
    distance: 0.2,
    rating: 0.1,
  };
  
  async rankResults(
    matches: ProductMatch[],
    params: SearchParams
  ): Promise<ProductMatch[]> {
    // Use custom weights if provided, otherwise use defaults
    const weights = params.rankingWeights || this.defaultWeights;
    
    // Calculate individual scores
    const withScores = matches.map(match => {
      const similarityScore = match.scores.similarity; // already 0-1
      const priceScore = this.calculatePriceScore(
        match.product.price,
        matches.map(m => m.product.price)
      );
      const distanceScore = this.calculateDistanceScore(
        match.merchant.distance,
        params.filters?.maxDistance || 25
      );
      const ratingScore = match.merchant.rating / 5; // normalize to 0-1
      
      const totalScore =
        similarityScore * weights.similarity +
        priceScore * weights.price +
        distanceScore * weights.distance +
        ratingScore * weights.rating;
      
      return {
        ...match,
        scores: {
          similarity: similarityScore,
          price: priceScore,
          distance: distanceScore,
          rating: ratingScore,
          total: totalScore,
        },
      };
    });
    
    // Sort by total score descending
    const sorted = withScores.sort((a, b) => b.scores.total - a.scores.total);
    
    // Assign rank positions
    return sorted.map((match, index) => ({
      ...match,
      rankPosition: index + 1,
    }));
  }
  
  private calculatePriceScore(
    price: number,
    allPrices: number[]
  ): number {
    // Lower price = higher score
    // Normalize using min-max scaling, then invert
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    
    if (minPrice === maxPrice) return 1.0;
    
    const normalized = (price - minPrice) / (maxPrice - minPrice);
    return 1 - normalized; // invert so lower price = higher score
  }
  
  private calculateDistanceScore(
    distance: number,
    maxDistance: number
  ): number {
    // Closer = higher score
    // Linear decay from 1.0 at 0 miles to 0.0 at maxDistance
    return Math.max(0, 1 - distance / maxDistance);
  }
}
```

#### MerchantAggregatorService

```typescript
// src/services/MerchantAggregatorService.ts

export class MerchantAggregatorService {
  async enableAggregator(
    merchantId: string,
    settings: {
      commissionRate: number;
      minOrderValue?: number;
      maxOrderValue?: number;
      acceptedPaymentMethods?: string[];
    }
  ): Promise<void> {
    await db
      .insert(aggregatorSettings)
      .values({
        merchantId,
        aggregatorEnabled: true,
        commissionRate: settings.commissionRate,
        minOrderValue: settings.minOrderValue,
        maxOrderValue: settings.maxOrderValue,
        acceptedPaymentMethods: settings.acceptedPaymentMethods,
      })
      .onConflictDoUpdate({
        target: aggregatorSettings.merchantId,
        set: {
          aggregatorEnabled: true,
          commissionRate: settings.commissionRate,
          minOrderValue: settings.minOrderValue,
          maxOrderValue: settings.maxOrderValue,
          acceptedPaymentMethods: settings.acceptedPaymentMethods,
          updatedAt: new Date(),
        },
      });
  }
  
  async disableAggregator(merchantId: string): Promise<void> {
    await db
      .update(aggregatorSettings)
      .set({
        aggregatorEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(aggregatorSettings.merchantId, merchantId));
  }
  
  async addLocation(
    merchantId: string,
    location: {
      locationName: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      latitude: number;
      longitude: number;
      deliveryRadius: number;
      avgDeliveryTime: number;
    }
  ): Promise<MerchantLocation> {
    const [created] = await db
      .insert(merchantLocations)
      .values({
        merchantId,
        ...location,
        isActive: true,
      })
      .returning();
    
    return created;
  }
  
  async updateLocation(
    locationId: string,
    updates: Partial<MerchantLocation>
  ): Promise<void> {
    await db
      .update(merchantLocations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(merchantLocations.id, locationId));
  }
  
  async getAggregatorAnalytics(
    merchantId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<{
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    commission: number;
    ctr: number;
    conversionRate: number;
  }> {
    // Get impressions (appearances in search results)
    const [impressionData] = await db
      .select({
        count: count(),
      })
      .from(aggregatorSearches)
      .where(
        and(
          sql`${aggregatorSearches.merchantsSearched} @> ${JSON.stringify([merchantId])}`,
          gte(aggregatorSearches.timestamp, dateRange.start),
          lte(aggregatorSearches.timestamp, dateRange.end)
        )
      );
    
    // Get clicks
    const [clickData] = await db
      .select({
        count: count(),
      })
      .from(searchResultClicks)
      .where(
        and(
          eq(searchResultClicks.merchantId, merchantId),
          gte(searchResultClicks.clickedAt, dateRange.start),
          lte(searchResultClicks.clickedAt, dateRange.end)
        )
      );
    
    // Get conversions and revenue
    const [transactionData] = await db
      .select({
        conversions: count(),
        revenue: sum(transactions.totalAmount),
        commission: sum(transactions.commissionAmount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.merchantId, merchantId),
          eq(transactions.referralSource, "aggregator"),
          eq(transactions.status, "completed"),
          gte(transactions.createdAt, dateRange.start),
          lte(transactions.createdAt, dateRange.end)
        )
      );
    
    const impressions = impressionData.count;
    const clicks = clickData.count;
    const conversions = transactionData.conversions;
    const revenue = transactionData.revenue || 0;
    const commission = transactionData.commission || 0;
    
    return {
      impressions,
      clicks,
      conversions,
      revenue,
      commission,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    };
  }
}
```

### 3. API Routes and Controllers

#### Aggregator Search Controller

```typescript
// src/api/controllers/AggregatorSearchController.ts

export class AggregatorSearchController {
  private searchService: AggregatorSearchService;
  private clickTrackingService: ClickTrackingService;
  
  constructor() {
    this.searchService = new AggregatorSearchService();
    this.clickTrackingService = new ClickTrackingService();
  }
  
  async search(req: Request, res: Response): Promise<void> {
    try {
      const {
        query,
        location,
        filters,
        userId,
        sessionId,
        limit,
      } = req.body;
      
      // Validate required fields
      if (!query || !location || !sessionId) {
        res.status(400).json({
          error: "Missing required fields: query, location, sessionId",
        });
        return;
      }
      
      // Validate location
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number"
      ) {
        res.status(400).json({
          error: "Invalid location format",
        });
        return;
      }
      
      // Execute search
      const result = await this.searchService.search({
        query,
        userLocation: location,
        filters,
        userId,
        sessionId,
        limit,
      });
      
      res.status(200).json(result);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  }
  
  async trackClick(req: Request, res: Response): Promise<void> {
    try {
      const { searchId, merchantId, productId, rankPosition } = req.body;
      
      if (!searchId || !merchantId || !productId || !rankPosition) {
        res.status(400).json({
          error: "Missing required fields",
        });
        return;
      }
      
      await this.clickTrackingService.trackClick({
        searchId,
        merchantId,
        productId,
        rankPosition,
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Click tracking error:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
  
  async generateReferralToken(req: Request, res: Response): Promise<void> {
    try {
      const { searchId, merchantId, productId } = req.body;
      
      const token = await this.clickTrackingService.generateReferralToken({
        searchId,
        merchantId,
        productId,
      });
      
      res.status(200).json({ referralToken: token });
    } catch (error) {
      console.error("Referral token error:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
}
```

#### Merchant Aggregator Controller

```typescript
// src/api/controllers/MerchantAggregatorController.ts

export class MerchantAggregatorController {
  private aggregatorService: MerchantAggregatorService;
  
  constructor() {
    this.aggregatorService = new MerchantAggregatorService();
  }
  
  async enableAggregator(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { authContext } = req;
      
      // Verify merchant ownership
      if (authContext.merchantId !== merchantId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      const { commissionRate, minOrderValue, maxOrderValue, acceptedPaymentMethods } =
        req.body;
      
      await this.aggregatorService.enableAggregator(merchantId, {
        commissionRate,
        minOrderValue,
        maxOrderValue,
        acceptedPaymentMethods,
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async addLocation(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { authContext } = req;
      
      if (authContext.merchantId !== merchantId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      const location = await this.aggregatorService.addLocation(
        merchantId,
        req.body
      );
      
      res.status(201).json(location);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { merchantId } = req.params;
      const { authContext } = req;
      const { startDate, endDate } = req.query;
      
      if (authContext.merchantId !== merchantId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }
      
      const analytics = await this.aggregatorService.getAggregatorAnalytics(
        merchantId,
        {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        }
      );
      
      res.status(200).json(analytics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

#### API Routes

```typescript
// src/api/routes/aggregator.ts

import { Router } from "express";
import { AggregatorSearchController } from "../controllers/AggregatorSearchController";
import { MerchantAggregatorController } from "../controllers/MerchantAggregatorController";
import { authenticateRequest } from "../middleware/auth";
import { rateLimitAggregator } from "../middleware/rateLimit";

const router = Router();
const searchController = new AggregatorSearchController();
const merchantController = new MerchantAggregatorController();

// Public search endpoints (no auth required)
router.post(
  "/search",
  rateLimitAggregator,
  searchController.search.bind(searchController)
);

router.post(
  "/search/click",
  rateLimitAggregator,
  searchController.trackClick.bind(searchController)
);

router.post(
  "/search/referral-token",
  rateLimitAggregator,
  searchController.generateReferralToken.bind(searchController)
);

// Merchant aggregator management (auth required)
router.post(
  "/merchants/:merchantId/aggregator/enable",
  authenticateRequest,
  merchantController.enableAggregator.bind(merchantController)
);

router.post(
  "/merchants/:merchantId/aggregator/locations",
  authenticateRequest,
  merchantController.addLocation.bind(merchantController)
);

router.get(
  "/merchants/:merchantId/aggregator/analytics",
  authenticateRequest,
  merchantController.getAnalytics.bind(merchantController)
);

export default router;
```


## Data Models

### Search Request Model

```typescript
export interface AggregatorSearchRequest {
  query: string;
  location: {
    latitude: number;
    longitude: number;
  };
  filters?: {
    maxPrice?: number;
    maxDistance?: number;
    minRating?: number;
    maxDeliveryTime?: number;
    categories?: string[];
    inStockOnly?: boolean;
  };
  rankingWeights?: {
    similarity?: number;
    price?: number;
    distance?: number;
    rating?: number;
  };
  userId?: string;
  sessionId: string;
  limit?: number;
}
```

### Search Response Model

```typescript
export interface AggregatorSearchResponse {
  searchId: string;
  query: string;
  resultsCount: number;
  responseTimeMs: number;
  results: Array<{
    product: {
      id: string;
      sku: string;
      title: string;
      description: string;
      price: number;
      currency: string;
      image: string;
      inStock: boolean;
      category: string;
    };
    merchant: {
      id: string;
      name: string;
      rating: number;
      totalOrders: number;
      distance: number;
      deliveryTime: number;
      location: {
        address: string;
        city: string;
        state: string;
      };
    };
    scores: {
      similarity: number;
      price: number;
      distance: number;
      rating: number;
      total: number;
    };
    rankPosition: number;
  }>;
}
```

## Error Handling

### Aggregator-Specific Errors

```typescript
// src/errors/AggregatorErrors.ts

export class NoMerchantsNearbyError extends Error {
  constructor(location: { latitude: number; longitude: number }) {
    super(`No merchants found near location: ${location.latitude}, ${location.longitude}`);
    this.name = "NoMerchantsNearbyError";
  }
}

export class InvalidLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLocationError";
  }
}

export class SearchTimeoutError extends Error {
  constructor() {
    super("Search request timed out");
    this.name = "SearchTimeoutError";
  }
}

export class RateLimitExceededError extends Error {
  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = "RateLimitExceededError";
  }
}
```

## Testing Strategy

### Unit Tests

#### RankingService Tests

```typescript
// src/services/__tests__/RankingService.test.ts

describe("RankingService", () => {
  let service: RankingService;
  
  beforeEach(() => {
    service = new RankingService();
  });
  
  describe("rankResults", () => {
    it("should rank by similarity when all other factors equal", async () => {
      const matches = [
        createMockMatch({ similarity: 0.9, price: 10, distance: 1, rating: 4.5 }),
        createMockMatch({ similarity: 0.7, price: 10, distance: 1, rating: 4.5 }),
        createMockMatch({ similarity: 0.8, price: 10, distance: 1, rating: 4.5 }),
      ];
      
      const ranked = await service.rankResults(matches, mockParams);
      
      expect(ranked[0].scores.similarity).toBe(0.9);
      expect(ranked[1].scores.similarity).toBe(0.8);
      expect(ranked[2].scores.similarity).toBe(0.7);
    });
    
    it("should favor lower prices", async () => {
      const matches = [
        createMockMatch({ similarity: 0.8, price: 15, distance: 1, rating: 4.5 }),
        createMockMatch({ similarity: 0.8, price: 5, distance: 1, rating: 4.5 }),
        createMockMatch({ similarity: 0.8, price: 10, distance: 1, rating: 4.5 }),
      ];
      
      const ranked = await service.rankResults(matches, mockParams);
      
      expect(ranked[0].product.price).toBe(5);
      expect(ranked[1].product.price).toBe(10);
      expect(ranked[2].product.price).toBe(15);
    });
    
    it("should favor closer merchants", async () => {
      const matches = [
        createMockMatch({ similarity: 0.8, price: 10, distance: 5, rating: 4.5 }),
        createMockMatch({ similarity: 0.8, price: 10, distance: 1, rating: 4.5 }),
        createMockMatch({ similarity: 0.8, price: 10, distance: 3, rating: 4.5 }),
      ];
      
      const ranked = await service.rankResults(matches, mockParams);
      
      expect(ranked[0].merchant.distance).toBe(1);
      expect(ranked[1].merchant.distance).toBe(3);
      expect(ranked[2].merchant.distance).toBe(5);
    });
    
    it("should apply custom weights", async () => {
      const matches = [
        createMockMatch({ similarity: 0.9, price: 20, distance: 1, rating: 3.0 }),
        createMockMatch({ similarity: 0.7, price: 5, distance: 1, rating: 5.0 }),
      ];
      
      // Heavy price weight
      const ranked = await service.rankResults(matches, {
        ...mockParams,
        rankingWeights: { similarity: 0.1, price: 0.7, distance: 0.1, rating: 0.1 },
      });
      
      expect(ranked[0].product.price).toBe(5); // Cheaper wins despite lower similarity
    });
  });
});
```

#### LocationService Tests

```typescript
// src/services/__tests__/LocationService.test.ts

describe("LocationService", () => {
  let service: LocationService;
  
  beforeEach(() => {
    service = new LocationService();
  });
  
  describe("calculateDistance", () => {
    it("should calculate distance between two points", () => {
      const sf = { latitude: 37.7749, longitude: -122.4194 };
      const oakland = { latitude: 37.8044, longitude: -122.2712 };
      
      const distance = service.calculateDistance(sf, oakland);
      
      expect(distance).toBeCloseTo(8.6, 1); // ~8.6 miles
    });
    
    it("should return 0 for same location", () => {
      const point = { latitude: 37.7749, longitude: -122.4194 };
      
      const distance = service.calculateDistance(point, point);
      
      expect(distance).toBe(0);
    });
  });
  
  describe("findNearbyMerchants", () => {
    it("should find merchants within radius", async () => {
      await createTestMerchant("merchant-1", { lat: 37.7749, lng: -122.4194 });
      await createTestMerchant("merchant-2", { lat: 37.8044, lng: -122.2712 });
      await createTestMerchant("merchant-3", { lat: 40.7128, lng: -74.0060 }); // NYC
      
      const userLocation = { latitude: 37.7749, longitude: -122.4194 }; // SF
      const nearby = await service.findNearbyMerchants(userLocation, 10);
      
      expect(nearby).toHaveLength(2);
      expect(nearby.map(m => m.merchantId)).toContain("merchant-1");
      expect(nearby.map(m => m.merchantId)).toContain("merchant-2");
      expect(nearby.map(m => m.merchantId)).not.toContain("merchant-3");
    });
  });
});
```

### Integration Tests

```typescript
// src/tests/integration/aggregatorSearch.test.ts

describe("Aggregator Search Integration", () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });
  
  afterEach(async () => {
    await cleanupTestDatabase();
  });
  
  it("should search across multiple merchants", async () => {
    // Setup: Create 3 merchants with products
    await createTestMerchant("whole-foods", {
      location: { lat: 37.7749, lng: -122.4194 },
      products: [
        { title: "Organic Almond Milk", price: 4.99 },
        { title: "Organic Soy Milk", price: 3.99 },
      ],
    });
    
    await createTestMerchant("target", {
      location: { lat: 37.7844, lng: -122.4078 },
      products: [
        { title: "Silk Almond Milk", price: 3.49 },
        { title: "Oat Milk", price: 4.49 },
      ],
    });
    
    await createTestMerchant("safeway", {
      location: { lat: 37.7694, lng: -122.4862 },
      products: [
        { title: "Almond Breeze", price: 2.99 },
      ],
    });
    
    // Execute search
    const response = await request(app)
      .post("/api/aggregator/search")
      .send({
        query: "almond milk",
        location: { latitude: 37.7749, longitude: -122.4194 },
        sessionId: "test-session",
      });
    
    expect(response.status).toBe(200);
    expect(response.body.resultsCount).toBeGreaterThan(0);
    expect(response.body.results).toHaveLength(3);
    
    // Verify results from all 3 merchants
    const merchantIds = response.body.results.map(r => r.merchant.id);
    expect(merchantIds).toContain("whole-foods");
    expect(merchantIds).toContain("target");
    expect(merchantIds).toContain("safeway");
  });
  
  it("should apply filters correctly", async () => {
    await createTestMerchant("merchant-1", {
      location: { lat: 37.7749, lng: -122.4194 },
      products: [
        { title: "Expensive Product", price: 50 },
        { title: "Cheap Product", price: 5 },
      ],
    });
    
    const response = await request(app)
      .post("/api/aggregator/search")
      .send({
        query: "product",
        location: { latitude: 37.7749, longitude: -122.4194 },
        filters: { maxPrice: 10 },
        sessionId: "test-session",
      });
    
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].product.title).toBe("Cheap Product");
  });
  
  it("should rank by multiple factors", async () => {
    await createTestMerchant("close-expensive", {
      location: { lat: 37.7749, lng: -122.4194 }, // 0 miles
      rating: 3.0,
      products: [{ title: "Product A", price: 20 }],
    });
    
    await createTestMerchant("far-cheap", {
      location: { lat: 37.8044, lng: -122.2712 }, // ~8 miles
      rating: 5.0,
      products: [{ title: "Product B", price: 5 }],
    });
    
    const response = await request(app)
      .post("/api/aggregator/search")
      .send({
        query: "product",
        location: { latitude: 37.7749, longitude: -122.4194 },
        sessionId: "test-session",
      });
    
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(2);
    
    // Verify ranking considers all factors
    const first = response.body.results[0];
    const second = response.body.results[1];
    
    expect(first.scores.total).toBeGreaterThan(second.scores.total);
  });
});
```

### Performance Tests

```typescript
// src/tests/performance/aggregatorSearch.perf.ts

describe("Aggregator Search Performance", () => {
  it("should complete search within 3 seconds", async () => {
    // Setup: 50 merchants with 100 products each
    await createManyMerchants(50, 100);
    
    const startTime = Date.now();
    
    const response = await request(app)
      .post("/api/aggregator/search")
      .send({
        query: "test product",
        location: { latitude: 37.7749, longitude: -122.4194 },
        sessionId: "perf-test",
      });
    
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(3000); // 3 seconds
  });
  
  it("should handle concurrent searches", async () => {
    await createManyMerchants(20, 50);
    
    const searches = Array(100).fill(null).map((_, i) =>
      request(app)
        .post("/api/aggregator/search")
        .send({
          query: `query ${i}`,
          location: { latitude: 37.7749, longitude: -122.4194 },
          sessionId: `session-${i}`,
        })
    );
    
    const startTime = Date.now();
    const responses = await Promise.all(searches);
    const duration = Date.now() - startTime;
    
    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(5000); // 5 seconds for 100 concurrent
  });
});
```

## Performance Optimization

### Database Indexing

```sql
-- Spatial index for geographic queries
CREATE INDEX idx_merchant_locations_geo 
ON merchant_locations 
USING GIST (ll_to_earth(latitude, longitude));

-- Composite index for aggregator-enabled merchants
CREATE INDEX idx_aggregator_enabled_merchants
ON aggregator_settings (aggregator_enabled, merchant_id)
WHERE aggregator_enabled = true;

-- Index for semantic search with merchant filter
CREATE INDEX idx_documents_merchant_embedding
ON documents (merchant_id, embedding);

-- Index for search analytics
CREATE INDEX idx_aggregator_searches_timestamp
ON aggregator_searches (timestamp DESC);

CREATE INDEX idx_search_clicks_search_merchant
ON search_result_clicks (search_id, merchant_id);
```

### Caching Strategy

```typescript
// src/services/CacheService.ts

export class AggregatorCacheService {
  private merchantCache: Map<string, MerchantInfo>;
  private locationCache: Map<string, MerchantLocation[]>;
  
  constructor() {
    this.merchantCache = new Map();
    this.locationCache = new Map();
  }
  
  // Cache merchant info for 5 minutes
  async getMerchantInfo(merchantId: string): Promise<MerchantInfo> {
    if (this.merchantCache.has(merchantId)) {
      return this.merchantCache.get(merchantId)!;
    }
    
    const info = await fetchMerchantInfo(merchantId);
    this.merchantCache.set(merchantId, info);
    
    setTimeout(() => {
      this.merchantCache.delete(merchantId);
    }, 5 * 60 * 1000);
    
    return info;
  }
  
  // Cache nearby merchants by location grid
  async getNearbyMerchants(
    location: { latitude: number; longitude: number },
    radius: number
  ): Promise<MerchantLocation[]> {
    const cacheKey = `${Math.floor(location.latitude * 100)}_${Math.floor(location.longitude * 100)}_${radius}`;
    
    if (this.locationCache.has(cacheKey)) {
      return this.locationCache.get(cacheKey)!;
    }
    
    const merchants = await fetchNearbyMerchants(location, radius);
    this.locationCache.set(cacheKey, merchants);
    
    setTimeout(() => {
      this.locationCache.delete(cacheKey);
    }, 10 * 60 * 1000); // 10 minutes
    
    return merchants;
  }
}
```

### Query Optimization

```typescript
// Use prepared statements for frequent queries
const searchMerchantCatalogPrepared = db
  .select()
  .from(documents)
  .where(
    and(
      eq(documents.merchantId, sql.placeholder('merchantId')),
      sql`${documents.embedding} <-> ${sql.placeholder('embedding')} < 0.5`
    )
  )
  .orderBy(sql`${documents.embedding} <-> ${sql.placeholder('embedding')}`)
  .limit(5)
  .prepare();

// Execute with parameters
const results = await searchMerchantCatalogPrepared.execute({
  merchantId: 'merchant-123',
  embedding: queryEmbedding,
});
```

## Security Considerations

### Rate Limiting

```typescript
// src/api/middleware/rateLimit.ts

export const rateLimitAggregator = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: (req) => {
    // Use IP address for anonymous users
    return req.ip || req.headers['x-forwarded-for'] as string;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests",
      retryAfter: 60,
    });
  },
});
```

### Input Validation

```typescript
// Validate and sanitize user inputs
export function validateSearchRequest(req: any): void {
  // Validate query
  if (!req.query || typeof req.query !== 'string') {
    throw new Error("Invalid query");
  }
  
  if (req.query.length > 500) {
    throw new Error("Query too long");
  }
  
  // Validate location
  if (!req.location || 
      typeof req.location.latitude !== 'number' ||
      typeof req.location.longitude !== 'number') {
    throw new Error("Invalid location");
  }
  
  if (req.location.latitude < -90 || req.location.latitude > 90) {
    throw new Error("Invalid latitude");
  }
  
  if (req.location.longitude < -180 || req.location.longitude > 180) {
    throw new Error("Invalid longitude");
  }
  
  // Validate filters
  if (req.filters) {
    if (req.filters.maxPrice && req.filters.maxPrice < 0) {
      throw new Error("Invalid maxPrice");
    }
    
    if (req.filters.maxDistance && req.filters.maxDistance < 0) {
      throw new Error("Invalid maxDistance");
    }
  }
}
```

## Migration Strategy

### Phase 1: Database Schema

```sql
-- migrations/003_add_aggregator_support.sql

-- Add aggregator settings table
CREATE TABLE aggregator_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  aggregator_enabled BOOLEAN NOT NULL DEFAULT false,
  commission_rate REAL NOT NULL DEFAULT 0.05,
  min_order_value REAL,
  max_order_value REAL,
  accepted_payment_methods JSONB DEFAULT '["card", "digital_wallet"]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aggregator_settings_merchant ON aggregator_settings(merchant_id);
CREATE INDEX idx_aggregator_settings_enabled ON aggregator_settings(aggregator_enabled);

-- Add merchant locations table
CREATE TABLE merchant_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  delivery_radius REAL NOT NULL,
  avg_delivery_time REAL NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_merchant_locations_merchant ON merchant_locations(merchant_id);
CREATE INDEX idx_merchant_locations_active ON merchant_locations(is_active);
CREATE INDEX idx_merchant_locations_geo ON merchant_locations 
  USING GIST (ll_to_earth(latitude, longitude));

-- Add aggregator searches table
CREATE TABLE aggregator_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  session_id TEXT NOT NULL,
  query TEXT NOT NULL,
  query_embedding VECTOR(1536),
  user_latitude REAL NOT NULL,
  user_longitude REAL NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  merchants_searched JSONB NOT NULL,
  results_count INTEGER NOT NULL,
  response_time_ms REAL NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aggregator_searches_user ON aggregator_searches(user_id);
CREATE INDEX idx_aggregator_searches_session ON aggregator_searches(session_id);
CREATE INDEX idx_aggregator_searches_timestamp ON aggregator_searches(timestamp);

-- Add search result clicks table
CREATE TABLE search_result_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id TEXT NOT NULL REFERENCES aggregator_searches(search_id),
  merchant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  rank_position INTEGER NOT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_search_clicks_search ON search_result_clicks(search_id);
CREATE INDEX idx_search_clicks_merchant ON search_result_clicks(merchant_id);
CREATE INDEX idx_search_clicks_product ON search_result_clicks(product_id);

-- Add merchant ratings table
CREATE TABLE merchant_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  average_rating REAL NOT NULL DEFAULT 5.0,
  total_ratings INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  successful_orders INTEGER NOT NULL DEFAULT 0,
  avg_response_time REAL,
  on_time_delivery_rate REAL DEFAULT 1.0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_merchant_ratings_merchant ON merchant_ratings(merchant_id);
CREATE INDEX idx_merchant_ratings_rating ON merchant_ratings(average_rating);

-- Update transactions table
ALTER TABLE transactions
ADD COLUMN referral_source TEXT,
ADD COLUMN referral_token TEXT,
ADD COLUMN commission_rate REAL,
ADD COLUMN commission_amount REAL;

CREATE INDEX idx_transactions_referral_source ON transactions(referral_source);
CREATE INDEX idx_transactions_referral_token ON transactions(referral_token);
```

This design provides a comprehensive, scalable solution for cross-merchant aggregator search that leverages MindShop's existing infrastructure while adding powerful new consumer-facing capabilities.
