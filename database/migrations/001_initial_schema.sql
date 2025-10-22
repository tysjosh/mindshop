-- Initial setup for MindsDB RAG Assistant
-- This file contains manual setup steps that need to be run before Drizzle migrations
-- Run this file first, then run: npm run db:generate && npm run db:migrate

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enums (Drizzle will handle table creation)
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('product', 'faq', 'policy', 'review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE outcome AS ENUM ('success', 'failure');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create materialized view for document statistics (will be created after tables exist)
-- This will be created by a separate migration after Drizzle creates the tables

-- Create cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to refresh document stats (will be used after materialized view is created)
CREATE OR REPLACE FUNCTION refresh_document_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY document_stats;
END;
$$ LANGUAGE plpgsql;