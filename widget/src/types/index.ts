/**
 * Widget configuration types
 */
export interface RAGConfig {
  merchantId: string;
  apiKey: string;
  apiBaseUrl?: string;
  theme?: Partial<ThemeConfig>;
  behavior?: Partial<BehaviorConfig>;
  integration?: Partial<IntegrationConfig>;
}

export interface ThemeConfig {
  primaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  zIndex?: number;
}

export interface BehaviorConfig {
  autoOpen?: boolean;
  greeting?: string;
  placeholder?: string;
  maxRecommendations?: number;
  showTimestamps?: boolean;
  enableSoundNotifications?: boolean;
}

export interface IntegrationConfig {
  addToCartCallback?: (product: Product) => void;
  checkoutCallback?: (items: CartItem[]) => void;
  analyticsCallback?: (event: AnalyticsEvent) => void;
}

/**
 * Message types
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  recommendations?: Product[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Product types
 */
export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  url?: string;
  inStock?: boolean;
  metadata?: Record<string, any>;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

/**
 * API types
 */
export interface ChatRequest {
  query: string;
  sessionId: string;
  merchantId: string;
  userId?: string;
  context?: Record<string, any>;
}

export interface ChatResponse {
  answer: string;
  recommendations?: Product[];
  sessionId: string;
  executionTime?: number;
  metadata?: Record<string, any>;
}

export interface SessionRequest {
  merchantId: string;
  userId?: string;
}

export interface SessionResponse {
  sessionId: string;
  createdAt: string;
}

/**
 * Analytics types
 */
export interface AnalyticsEvent {
  event: string;
  query?: string;
  responseTime?: number;
  productId?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * Storage types
 */
export interface StorageData {
  sessionId: string | null;
  userId: string | null;
  sessionCreatedAt: Date | null;
  history: Message[];
  lastUpdated: Date;
}
