-- Seed billing information for test merchants

-- Delete existing billing info for test merchants (if any)
DELETE FROM billing_info 
WHERE merchant_id IN ('acme_electronics_2024', 'fashion_hub_2024', 'tech_store_2024');

-- Insert fresh billing data
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
  );

SELECT 'Billing information seeded for ' || COUNT(*) || ' merchants' as result
FROM billing_info 
WHERE merchant_id IN ('acme_electronics_2024', 'fashion_hub_2024', 'tech_store_2024');
