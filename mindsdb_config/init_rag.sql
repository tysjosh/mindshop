-- RAG Assistant Initialization Script
-- Run this script in MindsDB to set up RAG components

-- Show available ML engines and handlers
SHOW ML_ENGINES;
SHOW HANDLERS;

-- Create a project for RAG operations
CREATE PROJECT IF NOT EXISTS rag_assistant;
USE rag_assistant;

-- Show databases to verify connection
SHOW DATABASES;

-- Example Knowledge Base Creation (requires OpenAI API key)
-- Uncomment and modify with your API key:
/*
CREATE KNOWLEDGE_BASE demo_kb
USING
    embedding_model = {
        "provider": "openai",
        "model_name": "text-embedding-3-large",
        "api_key": "your-openai-api-key-here"
    },
    reranking_model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "your-openai-api-key-here"
    },
    metadata_columns = ['document_type', 'source', 'title', 'created_at'],
    content_columns = ['content'],
    id_column = 'document_id';
*/

-- Example Agent Creation (requires OpenAI API key)
-- Uncomment and modify with your API key:
/*
CREATE AGENT demo_agent
USING
    model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "your-openai-api-key-here"
    },
    data = {
        "knowledge_bases": ["demo_kb"]
    },
    prompt_template = 'You are a helpful RAG assistant. Answer questions based on the provided context from the knowledge base. If you cannot find relevant information, say so clearly.',
    timeout = 30;
*/

-- Example Document Ingestion Job
-- Uncomment after creating knowledge base:
/*
CREATE JOB document_ingestion_job (
    INSERT INTO demo_kb
    SELECT document_id, content, document_type, source, title
    FROM files.uploaded_documents
    WHERE created_at > LAST
)
EVERY 1 hour;
*/

SELECT 'RAG initialization script loaded successfully' as status;
