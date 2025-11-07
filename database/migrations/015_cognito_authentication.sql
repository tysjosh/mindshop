-- Migration: Add Cognito authentication support
-- This migration adds the email_verified column to support Cognito email verification status
-- The cognito_user_id column already exists from previous migrations

-- Add email_verified column to merchants table
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Create index on cognito_user_id if it doesn't exist (should already exist from migration 007)
CREATE INDEX IF NOT EXISTS idx_merchants_cognito_user_id ON merchants(cognito_user_id);

-- Add comment to document the purpose of these columns
COMMENT ON COLUMN merchants.cognito_user_id IS 'AWS Cognito user ID for authentication';
COMMENT ON COLUMN merchants.email_verified IS 'Email verification status from Cognito';
