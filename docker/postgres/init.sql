-- Initialize the direct_fan_platform database
-- This file runs when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The database 'direct_fan_platform' is already created by the POSTGRES_DB environment variable
-- Additional initialization can be added here if needed