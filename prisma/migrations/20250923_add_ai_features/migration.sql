-- Migration for AI Features
-- Adds support for content moderation, AI metadata, and revenue optimization tracking

-- Add new fields to content table for AI moderation and metadata
ALTER TABLE content ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PUBLISHED';
ALTER TABLE content ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE content ADD COLUMN IF NOT EXISTS reviewedAt TIMESTAMP;
ALTER TABLE content ADD COLUMN IF NOT EXISTS reviewedBy VARCHAR(255);
ALTER TABLE content ADD COLUMN IF NOT EXISTS reviewReason TEXT;

-- Create moderation log table (optional - for detailed moderation tracking)
CREATE TABLE IF NOT EXISTS moderation_logs (
    id VARCHAR(255) PRIMARY KEY,
    contentId VARCHAR(255) NOT NULL,
    userId VARCHAR(255) NOT NULL,
    result TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING_REVIEW',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_moderation_content 
        FOREIGN KEY (contentId) 
        REFERENCES content(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_moderation_user 
        FOREIGN KEY (userId) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Create price optimization tracking table (optional - for revenue optimization)
CREATE TABLE IF NOT EXISTS price_optimizations (
    id VARCHAR(255) PRIMARY KEY,
    artistId VARCHAR(255) NOT NULL,
    originalPriceId VARCHAR(255) NOT NULL,
    testPriceId VARCHAR(255),
    originalAmount DECIMAL(10,2) NOT NULL,
    optimizedAmount DECIMAL(10,2) NOT NULL,
    testStartDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    testEndDate TIMESTAMP,
    status VARCHAR(50) DEFAULT 'TESTING',
    isActive BOOLEAN DEFAULT TRUE,
    results TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_price_optimization_artist 
        FOREIGN KEY (artistId) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Create AI agent logs table (optional - for agent performance tracking)
CREATE TABLE IF NOT EXISTS ai_agent_logs (
    id VARCHAR(255) PRIMARY KEY,
    agentId VARCHAR(255) NOT NULL,
    agentType VARCHAR(100) NOT NULL,
    taskType VARCHAR(100) NOT NULL,
    taskData TEXT,
    result TEXT,
    success BOOLEAN DEFAULT FALSE,
    processingTimeMs INTEGER DEFAULT 0,
    errorMessage TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_reviewed_at ON content(reviewedAt);
CREATE INDEX IF NOT EXISTS idx_content_metadata ON content USING gin(to_tsvector('english', metadata)) WHERE metadata IS NOT NULL; -- Full-text index on metadata

-- Add indexes for moderation_logs
CREATE INDEX IF NOT EXISTS idx_moderation_logs_content ON moderation_logs(contentId, createdAt);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user ON moderation_logs(userId, createdAt);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_status ON moderation_logs(status, createdAt);

-- Add indexes for price_optimizations
CREATE INDEX IF NOT EXISTS idx_price_opt_artist ON price_optimizations(artistId, createdAt);
CREATE INDEX IF NOT EXISTS idx_price_opt_status ON price_optimizations(status, isActive);
CREATE INDEX IF NOT EXISTS idx_price_opt_test_dates ON price_optimizations(testStartDate, testEndDate);

-- Add indexes for ai_agent_logs
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_type ON ai_agent_logs(agentType, createdAt);
CREATE INDEX IF NOT EXISTS idx_agent_logs_success ON ai_agent_logs(success, createdAt);
CREATE INDEX IF NOT EXISTS idx_agent_logs_task_type ON ai_agent_logs(taskType, createdAt);

-- Update content status values for existing content (set all existing content as published)
UPDATE content 
SET status = 'PUBLISHED' 
WHERE status IS NULL;

-- Add some sample metadata structure for existing content
UPDATE content 
SET metadata = '{"upload":{"uploadTimestamp":"' || "createdAt" || '"}}'
WHERE metadata IS NULL;

-- Add comments explaining the new fields
COMMENT ON COLUMN content.status IS 'Content status: PUBLISHED, PENDING_REVIEW, REJECTED';
COMMENT ON COLUMN content.metadata IS 'JSON metadata including AI moderation results and upload info';
COMMENT ON COLUMN content.reviewedAt IS 'Timestamp when content was reviewed by admin';
COMMENT ON COLUMN content.reviewedBy IS 'User ID of admin who reviewed the content';
COMMENT ON COLUMN content.reviewReason IS 'Reason for approval/rejection';

COMMENT ON TABLE moderation_logs IS 'Detailed AI moderation results for admin review';
COMMENT ON TABLE price_optimizations IS 'Revenue optimization and dynamic pricing test results';
COMMENT ON TABLE ai_agent_logs IS 'Performance and execution logs for AI agents';