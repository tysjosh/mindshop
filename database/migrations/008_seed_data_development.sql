-- Seed Data for Development Environment
-- This migration creates sample merchants, API keys, and related data for testing

-- ============================================================================
-- MERCHANTS
-- ============================================================================

-- Insert test merchants with different plans and statuses
INSERT INTO merchants (
  merchant_id, 
  cognito_user_id, 
  email, 
  company_name, 
  website, 
  industry, 
  status, 
  plan,
  verified_at
) VALUES 
  -- Active merchant on starter plan
  (
    'acme_electronics_2024',
    'cognito-user-acme-123',
    'admin@acme-electronics.com',
    'ACME Electronics',
    'https://acme-electronics.com',
    'Electronics',
    'active',
    'starter',
    NOW() - INTERVAL '30 days'
  ),
  -- Active merchant on professional plan
  (
    'fashion_hub_2024',
    'cognito-user-fashion-456',
    'contact@fashionhub.com',
    'Fashion Hub',
    'https://fashionhub.com',
    'Fashion & Apparel',
    'active',
    'professional',
    NOW() - INTERVAL '60 days'
  ),
  -- Active merchant on enterprise plan
  (
    'tech_store_2024',
    'cognito-user-tech-789',
    'support@techstore.com',
    'Tech Store Pro',
    'https://techstore.com',
    'Technology',
    'active',
    'enterprise',
    NOW() - INTERVAL '90 days'
  ),
  -- Pending verification merchant
  (
    'new_shop_2024',
    'cognito-user-newshop-101',
    'hello@newshop.com',
    'New Shop',
    'https://newshop.com',
    'General Retail',
    'pending_verification',
    'starter',
    NULL
  ),
  -- Suspended merchant
  (
    'suspended_store_2024',
    'cognito-user-suspended-202',
    'admin@suspended.com',
    'Suspended Store',
    'https://suspended.com',
    'General Retail',
    'suspended',
    'starter',
    NOW() - INTERVAL '15 days'
  )
ON CONFLICT (merchant_id) DO NOTHING;

-- ============================================================================
-- MERCHANT SETTINGS
-- ============================================================================

INSERT INTO merchant_settings (merchant_id, settings) VALUES
  (
    'acme_electronics_2024',
    '{
      "widget": {
        "theme": {
          "primaryColor": "#007bff",
          "position": "bottom-right",
          "borderRadius": "8px"
        },
        "behavior": {
          "autoOpen": false,
          "greeting": "Hi! How can I help you find the perfect electronics today?",
          "maxRecommendations": 3,
          "showProductImages": true
        }
      },
      "rag": {
        "maxResults": 5,
        "threshold": 0.7,
        "enableSemanticSearch": true
      },
      "notifications": {
        "email": true,
        "webhook": false,
        "usageAlerts": true
      }
    }'::jsonb
  ),
  (
    'fashion_hub_2024',
    '{
      "widget": {
        "theme": {
          "primaryColor": "#ff6b9d",
          "position": "bottom-left",
          "borderRadius": "12px"
        },
        "behavior": {
          "autoOpen": true,
          "greeting": "Welcome to Fashion Hub! Looking for something stylish?",
          "maxRecommendations": 5,
          "showProductImages": true
        }
      },
      "rag": {
        "maxResults": 8,
        "threshold": 0.65,
        "enableSemanticSearch": true
      },
      "notifications": {
        "email": true,
        "webhook": true,
        "usageAlerts": true
      }
    }'::jsonb
  ),
  (
    'tech_store_2024',
    '{
      "widget": {
        "theme": {
          "primaryColor": "#00c853",
          "position": "bottom-right",
          "borderRadius": "4px"
        },
        "behavior": {
          "autoOpen": false,
          "greeting": "Tech Store Pro - Your technology expert is here!",
          "maxRecommendations": 4,
          "showProductImages": true
        }
      },
      "rag": {
        "maxResults": 10,
        "threshold": 0.75,
        "enableSemanticSearch": true
      },
      "notifications": {
        "email": true,
        "webhook": true,
        "usageAlerts": true
      }
    }'::jsonb
  ),
  (
    'new_shop_2024',
    '{
      "widget": {
        "theme": {
          "primaryColor": "#007bff",
          "position": "bottom-right",
          "borderRadius": "8px"
        },
        "behavior": {
          "autoOpen": false,
          "greeting": "Hi! How can I help you today?",
          "maxRecommendations": 3,
          "showProductImages": true
        }
      },
      "rag": {
        "maxResults": 5,
        "threshold": 0.7,
        "enableSemanticSearch": true
      },
      "notifications": {
        "email": true,
        "webhook": false,
        "usageAlerts": true
      }
    }'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- API KEYS
-- ============================================================================

-- Note: In production, key_hash would be bcrypt hashed. For development, using simple hashes.
-- Real keys would be: pk_test_abc123... and pk_live_xyz789...

INSERT INTO api_keys (
  key_id,
  merchant_id,
  name,
  key_prefix,
  key_hash,
  environment,
  permissions,
  status,
  last_used_at,
  expires_at
) VALUES
  -- ACME Electronics - Development key
  (
    'key_acme_dev_001',
    'acme_electronics_2024',
    'Development Key',
    'pk_test_',
    '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', -- Mock hash
    'development',
    '["chat:read", "chat:write", "documents:read", "documents:write"]'::jsonb,
    'active',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '1 year'
  ),
  -- ACME Electronics - Production key
  (
    'key_acme_prod_001',
    'acme_electronics_2024',
    'Production Key',
    'pk_live_',
    '$2b$10$zyxwvutsrqponmlkjihgfedcba987654321', -- Mock hash
    'production',
    '["chat:read", "chat:write", "documents:read"]'::jsonb,
    'active',
    NOW() - INTERVAL '30 minutes',
    NOW() + INTERVAL '1 year'
  ),
  -- Fashion Hub - Development key
  (
    'key_fashion_dev_001',
    'fashion_hub_2024',
    'Development Key',
    'pk_test_',
    '$2b$10$fashionhubdevkey123456789abcdefgh', -- Mock hash
    'development',
    '["*"]'::jsonb,
    'active',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '1 year'
  ),
  -- Fashion Hub - Production key
  (
    'key_fashion_prod_001',
    'fashion_hub_2024',
    'Production Key',
    'pk_live_',
    '$2b$10$fashionhubprodkey987654321zyxwvu', -- Mock hash
    'production',
    '["*"]'::jsonb,
    'active',
    NOW() - INTERVAL '15 minutes',
    NOW() + INTERVAL '1 year'
  ),
  -- Tech Store - Multiple keys
  (
    'key_tech_dev_001',
    'tech_store_2024',
    'Development Key - Main',
    'pk_test_',
    '$2b$10$techstoredevkey1234567890abcdefg', -- Mock hash
    'development',
    '["*"]'::jsonb,
    'active',
    NOW() - INTERVAL '3 hours',
    NOW() + INTERVAL '1 year'
  ),
  (
    'key_tech_prod_001',
    'tech_store_2024',
    'Production Key - Website',
    'pk_live_',
    '$2b$10$techstoreprodkey1234567890abcdef', -- Mock hash
    'production',
    '["*"]'::jsonb,
    'active',
    NOW() - INTERVAL '5 minutes',
    NOW() + INTERVAL '1 year'
  ),
  (
    'key_tech_prod_002',
    'tech_store_2024',
    'Production Key - Mobile App',
    'pk_live_',
    '$2b$10$techstoremobilekey1234567890abcd', -- Mock hash
    'production',
    '["chat:read", "chat:write"]'::jsonb,
    'active',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '1 year'
  ),
  -- Revoked key example
  (
    'key_acme_old_001',
    'acme_electronics_2024',
    'Old Development Key (Revoked)',
    'pk_test_',
    '$2b$10$oldkeyrevoked1234567890abcdefgh', -- Mock hash
    'development',
    '["*"]'::jsonb,
    'revoked',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '1 year'
  )
ON CONFLICT (key_id) DO NOTHING;

-- ============================================================================
-- USAGE LIMITS
-- ============================================================================

INSERT INTO usage_limits (
  merchant_id,
  plan,
  queries_per_month,
  documents_max,
  api_calls_per_day,
  storage_gb_max
) VALUES
  -- Starter plan limits
  (
    'acme_electronics_2024',
    'starter',
    1000,
    100,
    5000,
    1
  ),
  (
    'new_shop_2024',
    'starter',
    1000,
    100,
    5000,
    1
  ),
  (
    'suspended_store_2024',
    'starter',
    1000,
    100,
    5000,
    1
  ),
  -- Professional plan limits
  (
    'fashion_hub_2024',
    'professional',
    10000,
    1000,
    50000,
    10
  ),
  -- Enterprise plan limits
  (
    'tech_store_2024',
    'enterprise',
    999999,
    999999,
    999999,
    1000
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MERCHANT USAGE (Historical Data)
-- ============================================================================

-- Generate usage data for the past 30 days for active merchants
DO $$
DECLARE
  day_offset INTEGER;
  current_date DATE;
BEGIN
  FOR day_offset IN 0..29 LOOP
    current_date := CURRENT_DATE - day_offset;
    
    -- ACME Electronics usage
    INSERT INTO merchant_usage (merchant_id, date, metric_type, metric_value, metadata)
    VALUES
      ('acme_electronics_2024', current_date, 'queries', 20 + (RANDOM() * 30)::INTEGER, '{}'::jsonb),
      ('acme_electronics_2024', current_date, 'documents', 50, '{}'::jsonb),
      ('acme_electronics_2024', current_date, 'api_calls', 100 + (RANDOM() * 100)::INTEGER, '{}'::jsonb),
      ('acme_electronics_2024', current_date, 'storage_gb', 0.5, '{}'::jsonb)
    ON CONFLICT (merchant_id, date, metric_type) DO NOTHING;
    
    -- Fashion Hub usage (higher volume)
    INSERT INTO merchant_usage (merchant_id, date, metric_type, metric_value, metadata)
    VALUES
      ('fashion_hub_2024', current_date, 'queries', 200 + (RANDOM() * 100)::INTEGER, '{}'::jsonb),
      ('fashion_hub_2024', current_date, 'documents', 500, '{}'::jsonb),
      ('fashion_hub_2024', current_date, 'api_calls', 1000 + (RANDOM() * 500)::INTEGER, '{}'::jsonb),
      ('fashion_hub_2024', current_date, 'storage_gb', 5.2, '{}'::jsonb)
    ON CONFLICT (merchant_id, date, metric_type) DO NOTHING;
    
    -- Tech Store usage (enterprise level)
    INSERT INTO merchant_usage (merchant_id, date, metric_type, metric_value, metadata)
    VALUES
      ('tech_store_2024', current_date, 'queries', 500 + (RANDOM() * 300)::INTEGER, '{}'::jsonb),
      ('tech_store_2024', current_date, 'documents', 2000, '{}'::jsonb),
      ('tech_store_2024', current_date, 'api_calls', 5000 + (RANDOM() * 2000)::INTEGER, '{}'::jsonb),
      ('tech_store_2024', current_date, 'storage_gb', 25.8, '{}'::jsonb)
    ON CONFLICT (merchant_id, date, metric_type) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- API KEY USAGE (Recent Activity)
-- ============================================================================

-- Generate API key usage for the past 7 days
DO $$
DECLARE
  day_offset INTEGER;
  hour_offset INTEGER;
  current_timestamp TIMESTAMP;
  endpoints TEXT[] := ARRAY['/api/chat', '/api/documents', '/api/documents/search', '/api/semantic-retrieval/search'];
  methods TEXT[] := ARRAY['GET', 'POST', 'PUT'];
  status_codes INTEGER[] := ARRAY[200, 200, 200, 200, 201, 400, 404, 500];
BEGIN
  FOR day_offset IN 0..6 LOOP
    FOR hour_offset IN 0..23 LOOP
      current_timestamp := NOW() - (day_offset || ' days')::INTERVAL - (hour_offset || ' hours')::INTERVAL;
      
      -- ACME Electronics API usage
      INSERT INTO api_key_usage (key_id, merchant_id, endpoint, method, status_code, response_time_ms, timestamp, date)
      VALUES
        (
          'key_acme_prod_001',
          'acme_electronics_2024',
          endpoints[1 + (RANDOM() * (ARRAY_LENGTH(endpoints, 1) - 1))::INTEGER],
          methods[1 + (RANDOM() * (ARRAY_LENGTH(methods, 1) - 1))::INTEGER],
          status_codes[1 + (RANDOM() * (ARRAY_LENGTH(status_codes, 1) - 1))::INTEGER],
          50 + (RANDOM() * 200)::INTEGER,
          current_timestamp,
          current_timestamp::DATE
        );
      
      -- Fashion Hub API usage (more frequent)
      FOR i IN 1..3 LOOP
        INSERT INTO api_key_usage (key_id, merchant_id, endpoint, method, status_code, response_time_ms, timestamp, date)
        VALUES
          (
            'key_fashion_prod_001',
            'fashion_hub_2024',
            endpoints[1 + (RANDOM() * (ARRAY_LENGTH(endpoints, 1) - 1))::INTEGER],
            methods[1 + (RANDOM() * (ARRAY_LENGTH(methods, 1) - 1))::INTEGER],
            status_codes[1 + (RANDOM() * (ARRAY_LENGTH(status_codes, 1) - 1))::INTEGER],
            40 + (RANDOM() * 150)::INTEGER,
            current_timestamp + (i || ' minutes')::INTERVAL,
            current_timestamp::DATE
          );
      END LOOP;
      
      -- Tech Store API usage (highest volume)
      FOR i IN 1..5 LOOP
        INSERT INTO api_key_usage (key_id, merchant_id, endpoint, method, status_code, response_time_ms, timestamp, date)
        VALUES
          (
            'key_tech_prod_001',
            'tech_store_2024',
            endpoints[1 + (RANDOM() * (ARRAY_LENGTH(endpoints, 1) - 1))::INTEGER],
            methods[1 + (RANDOM() * (ARRAY_LENGTH(methods, 1) - 1))::INTEGER],
            status_codes[1 + (RANDOM() * (ARRAY_LENGTH(status_codes, 1) - 1))::INTEGER],
            30 + (RANDOM() * 100)::INTEGER,
            current_timestamp + (i || ' minutes')::INTERVAL,
            current_timestamp::DATE
          );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- DOCUMENTS (Sample Product Catalog)
-- ============================================================================

-- ACME Electronics products
INSERT INTO documents (merchant_id, sku, title, body, document_type, metadata) VALUES
  (
    'acme_electronics_2024',
    'ACME-LAPTOP-001',
    'ACME Pro Laptop 15"',
    'High-performance laptop with Intel i7 processor, 16GB RAM, 512GB SSD. Perfect for professionals and content creators. Features a stunning 15-inch 4K display, backlit keyboard, and all-day battery life.',
    'product',
    '{"price": 1299.99, "category": "Computers", "inStock": true, "rating": 4.5, "reviews": 127}'::jsonb
  ),
  (
    'acme_electronics_2024',
    'ACME-PHONE-001',
    'ACME Smartphone X',
    'Latest flagship smartphone with 6.5" OLED display, 128GB storage, triple camera system. 5G enabled with fast charging and wireless charging support.',
    'product',
    '{"price": 899.99, "category": "Phones", "inStock": true, "rating": 4.7, "reviews": 342}'::jsonb
  ),
  (
    'acme_electronics_2024',
    'ACME-HEADPHONE-001',
    'ACME Wireless Headphones Pro',
    'Premium noise-cancelling wireless headphones with 30-hour battery life. Superior sound quality with deep bass and crystal-clear highs. Comfortable over-ear design.',
    'product',
    '{"price": 299.99, "category": "Audio", "inStock": true, "rating": 4.6, "reviews": 89}'::jsonb
  ),
  (
    'acme_electronics_2024',
    NULL,
    'Shipping Policy',
    'Free shipping on all orders over $50. Standard delivery takes 3-5 business days. Express shipping available for $15 (1-2 business days). International shipping available to select countries.',
    'policy',
    '{"type": "shipping"}'::jsonb
  ),
  (
    'acme_electronics_2024',
    NULL,
    'Return Policy',
    'We accept returns within 30 days of purchase. Items must be in original condition with all packaging and accessories. Refunds processed within 5-7 business days.',
    'policy',
    '{"type": "returns"}'::jsonb
  ),
  (
    'acme_electronics_2024',
    NULL,
    'How do I track my order?',
    'Once your order ships, you will receive a tracking number via email. You can use this number to track your package on our website or the carrier''s website.',
    'faq',
    '{"category": "shipping"}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Fashion Hub products
INSERT INTO documents (merchant_id, sku, title, body, document_type, metadata) VALUES
  (
    'fashion_hub_2024',
    'FH-DRESS-001',
    'Summer Floral Dress',
    'Beautiful floral print summer dress in lightweight cotton. Perfect for warm weather. Available in sizes XS-XL. Features adjustable straps and side pockets.',
    'product',
    '{"price": 79.99, "category": "Dresses", "inStock": true, "rating": 4.8, "reviews": 156, "colors": ["Blue", "Pink", "Yellow"]}'::jsonb
  ),
  (
    'fashion_hub_2024',
    'FH-JEANS-001',
    'Classic Slim Fit Jeans',
    'Timeless slim fit jeans in premium denim. Comfortable stretch fabric with classic 5-pocket design. Available in multiple washes.',
    'product',
    '{"price": 89.99, "category": "Bottoms", "inStock": true, "rating": 4.5, "reviews": 203, "sizes": ["28", "30", "32", "34", "36"]}'::jsonb
  ),
  (
    'fashion_hub_2024',
    'FH-JACKET-001',
    'Leather Biker Jacket',
    'Genuine leather biker jacket with asymmetric zip closure. Features multiple pockets and quilted shoulder detail. Fully lined for comfort.',
    'product',
    '{"price": 299.99, "category": "Outerwear", "inStock": true, "rating": 4.9, "reviews": 78}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Tech Store products
INSERT INTO documents (merchant_id, sku, title, body, document_type, metadata) VALUES
  (
    'tech_store_2024',
    'TS-MONITOR-001',
    '32" 4K Gaming Monitor',
    'Ultra-wide 32-inch 4K gaming monitor with 144Hz refresh rate and 1ms response time. HDR support and AMD FreeSync technology. Perfect for gaming and professional work.',
    'product',
    '{"price": 599.99, "category": "Monitors", "inStock": true, "rating": 4.7, "reviews": 234}'::jsonb
  ),
  (
    'tech_store_2024',
    'TS-KEYBOARD-001',
    'Mechanical Gaming Keyboard RGB',
    'Premium mechanical gaming keyboard with Cherry MX switches. Customizable RGB backlighting and programmable macro keys. Durable aluminum frame.',
    'product',
    '{"price": 149.99, "category": "Peripherals", "inStock": true, "rating": 4.6, "reviews": 412}'::jsonb
  ),
  (
    'tech_store_2024',
    'TS-MOUSE-001',
    'Wireless Gaming Mouse',
    'High-precision wireless gaming mouse with 16000 DPI sensor. Ergonomic design with customizable buttons. Up to 70 hours of battery life.',
    'product',
    '{"price": 79.99, "category": "Peripherals", "inStock": true, "rating": 4.8, "reviews": 567}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- USER SESSIONS (Active Sessions)
-- ============================================================================

INSERT INTO user_sessions (session_id, user_id, merchant_id, conversation_history, context) VALUES
  (
    gen_random_uuid(),
    'user_acme_001',
    'acme_electronics_2024',
    '[
      {"role": "user", "content": "I need a laptop for video editing"},
      {"role": "assistant", "content": "I recommend the ACME Pro Laptop 15\" with its powerful i7 processor and 4K display, perfect for video editing!"}
    ]'::jsonb,
    '{"last_query": "laptop for video editing", "intent": "product_search", "session_start": "2024-11-01T10:30:00Z"}'::jsonb
  ),
  (
    gen_random_uuid(),
    'user_fashion_001',
    'fashion_hub_2024',
    '[
      {"role": "user", "content": "Show me summer dresses"},
      {"role": "assistant", "content": "Check out our Summer Floral Dress! It''s perfect for warm weather and comes in beautiful colors."}
    ]'::jsonb,
    '{"last_query": "summer dresses", "intent": "product_search", "session_start": "2024-11-01T11:15:00Z"}'::jsonb
  ),
  (
    gen_random_uuid(),
    'user_tech_001',
    'tech_store_2024',
    '[
      {"role": "user", "content": "What''s the best gaming monitor?"},
      {"role": "assistant", "content": "Our 32\" 4K Gaming Monitor with 144Hz refresh rate is perfect for gaming!"}
    ]'::jsonb,
    '{"last_query": "best gaming monitor", "intent": "product_search", "session_start": "2024-11-01T12:00:00Z"}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COST TRACKING (Sample Cost Data)
-- ============================================================================

INSERT INTO cost_tracking (merchant_id, session_id, user_id, operation, cost_usd, tokens, compute_ms, metadata) VALUES
  (
    'acme_electronics_2024',
    (SELECT session_id FROM user_sessions WHERE merchant_id = 'acme_electronics_2024' LIMIT 1),
    'user_acme_001',
    'retrieval',
    0.0012,
    '{"input": 150, "output": 0}'::jsonb,
    245,
    '{"model": "text-embedding-ada-002"}'::jsonb
  ),
  (
    'fashion_hub_2024',
    (SELECT session_id FROM user_sessions WHERE merchant_id = 'fashion_hub_2024' LIMIT 1),
    'user_fashion_001',
    'generation',
    0.0045,
    '{"input": 200, "output": 150}'::jsonb,
    1200,
    '{"model": "claude-3-sonnet"}'::jsonb
  ),
  (
    'tech_store_2024',
    (SELECT session_id FROM user_sessions WHERE merchant_id = 'tech_store_2024' LIMIT 1),
    'user_tech_001',
    'retrieval',
    0.0015,
    '{"input": 180, "output": 0}'::jsonb,
    320,
    '{"model": "text-embedding-ada-002"}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Seed Data Inserted Successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Merchants Created: %', (SELECT COUNT(*) FROM merchants);
  RAISE NOTICE '  - Active: %', (SELECT COUNT(*) FROM merchants WHERE status = 'active');
  RAISE NOTICE '  - Pending: %', (SELECT COUNT(*) FROM merchants WHERE status = 'pending_verification');
  RAISE NOTICE '  - Suspended: %', (SELECT COUNT(*) FROM merchants WHERE status = 'suspended');
  RAISE NOTICE '';
  RAISE NOTICE 'API Keys Created: %', (SELECT COUNT(*) FROM api_keys);
  RAISE NOTICE '  - Active: %', (SELECT COUNT(*) FROM api_keys WHERE status = 'active');
  RAISE NOTICE '  - Revoked: %', (SELECT COUNT(*) FROM api_keys WHERE status = 'revoked');
  RAISE NOTICE '';
  RAISE NOTICE 'Documents Created: %', (SELECT COUNT(*) FROM documents);
  RAISE NOTICE 'User Sessions: %', (SELECT COUNT(*) FROM user_sessions);
  RAISE NOTICE 'Usage Records: %', (SELECT COUNT(*) FROM merchant_usage);
  RAISE NOTICE 'API Usage Records: %', (SELECT COUNT(*) FROM api_key_usage);
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test Credentials:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Merchant: acme_electronics_2024';
  RAISE NOTICE '  Email: admin@acme-electronics.com';
  RAISE NOTICE '  Plan: Starter';
  RAISE NOTICE '';
  RAISE NOTICE 'Merchant: fashion_hub_2024';
  RAISE NOTICE '  Email: contact@fashionhub.com';
  RAISE NOTICE '  Plan: Professional';
  RAISE NOTICE '';
  RAISE NOTICE 'Merchant: tech_store_2024';
  RAISE NOTICE '  Email: support@techstore.com';
  RAISE NOTICE '  Plan: Enterprise';
  RAISE NOTICE '========================================';
END $$;


-- ============================================================================
-- BILLING INFORMATION SEED DATA
-- ============================================================================

DO $billing$ BEGIN
  -- Add billing information for test merchants
  INSERT INTO billing_info (
    merchant_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end
  ) VALUES
    -- ACME Electronics - Starter plan
    (
      'acme_electronics_2024',
      'cus_test_acme_electronics',
      'sub_test_acme_starter',
      'starter',
      'active',
      NOW() - INTERVAL '15 days',
      NOW() + INTERVAL '15 days',
      0
    ),
    -- Fashion Hub - Professional plan
    (
      'fashion_hub_2024',
      'cus_test_fashion_hub',
      'sub_test_fashion_pro',
      'professional',
      'active',
      NOW() - INTERVAL '10 days',
      NOW() + INTERVAL '20 days',
      0
    ),
    -- Tech Store - Enterprise plan
    (
      'tech_store_2024',
      'cus_test_tech_store',
      'sub_test_tech_enterprise',
      'enterprise',
      'active',
      NOW() - INTERVAL '5 days',
      NOW() + INTERVAL '25 days',
      0
    )
  ON CONFLICT (merchant_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end;

  RAISE NOTICE 'Billing information seeded for 3 merchants';
END $billing$;
