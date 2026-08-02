#!/usr/bin/env tsx
/**
 * Environment Configuration Consolidation Script
 * 
 * This script analyzes all .env* files, extracts variables, identifies
 * which files are referenced in code, and creates consolidated environment
 * configuration files.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Types
export interface EnvVariable {
  name: string;
  value?: string;
  description?: string;
  required: boolean;
  category: 'database' | 'auth' | 'payment' | 'storage' | 'email' | 'monitoring' | 'api' | 'other';
  files: string[];
}

export interface EnvFile {
  path: string;
  variables: Map<string, string>;
  referencedInCode: boolean;
}

export interface ConsolidationResult {
  allVariables: Map<string, EnvVariable>;
  envFiles: EnvFile[];
  codeReferences: Map<string, string[]>;
  consolidatedFiles: string[];
  errors: string[];
}

// Variable categories based on common patterns
const VARIABLE_CATEGORIES: Record<string, 'database' | 'auth' | 'payment' | 'storage' | 'email' | 'monitoring' | 'api' | 'other'> = {
  // Database
  'DATABASE_URL': 'database',
  'DB_HOST': 'database',
  'DB_PORT': 'database',
  'DB_NAME': 'database',
  'DB_USER': 'database',
  'DB_PASSWORD': 'database',
  'POSTGRES_': 'database',
  'MYSQL_': 'database',
  'MONGODB_': 'database',
  
  // Authentication
  'NEXTAUTH_': 'auth',
  'AUTH_': 'auth',
  'JWT_': 'auth',
  'SESSION_': 'auth',
  'OAUTH_': 'auth',
  'GOOGLE_CLIENT': 'auth',
  'GITHUB_CLIENT': 'auth',
  
  // Payment
  'STRIPE_': 'payment',
  'PAYPAL_': 'payment',
  'PAYMENT_': 'payment',
  
  // Storage
  'AWS_': 'storage',
  'S3_': 'storage',
  'CLOUDINARY_': 'storage',
  'UPLOAD_': 'storage',
  
  // Email
  'SENDGRID_': 'email',
  'SMTP_': 'email',
  'EMAIL_': 'email',
  'MAIL_': 'email',
  
  // Monitoring
  'SENTRY_': 'monitoring',
  'DATADOG_': 'monitoring',
  'NEW_RELIC_': 'monitoring',
  'LOG_': 'monitoring',
  
  // API
  'API_': 'api',
  'WEBHOOK_': 'api',
  'OPENAI_': 'api',
  'REDIS_': 'api'
};

// Required variables that should always be present
const REQUIRED_VARIABLES = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

/**
 * Find all .env* files in the project
 */
export function findEnvFiles(rootDir: string = '.'): string[] {
  const patterns = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.staging',
    '.env.test',
    '.env.*.example',
    '.env.backup',
    '.env.save'
  ];
  
  const envFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { cwd: rootDir, absolute: true });
    envFiles.push(...files);
  }
  
  // Also check in subdirectories
  const nestedFiles = glob.sync('**/.env*', { 
    cwd: rootDir, 
    absolute: true,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
  });
  
  envFiles.push(...nestedFiles);
  
  // Remove duplicates and sort
  return [...new Set(envFiles)].sort();
}

/**
 * Parse environment file and extract variables
 */
export function parseEnvFile(filePath: string): Map<string, string> {
  const variables = new Map<string, string>();
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // Parse KEY=VALUE format
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\\s*=\\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        variables.set(key, cleanValue);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not parse ${filePath}:`, error);
  }
  
  return variables;
}

/**
 * Categorize environment variable
 */
export function categorizeVariable(name: string): 'database' | 'auth' | 'payment' | 'storage' | 'email' | 'monitoring' | 'api' | 'other' {
  for (const [prefix, category] of Object.entries(VARIABLE_CATEGORIES)) {
    if (name.startsWith(prefix)) {
      return category;
    }
  }
  return 'other';
}

/**
 * Check if environment file is referenced in code
 */
export function checkCodeReferences(envFile: string, rootDir: string = '.'): boolean {
  const filename = path.basename(envFile);
  
  try {
    // Search for references in common config files
    const configFiles = [
      'next.config.js',
      'next.config.ts',
      'package.json',
      'docker-compose.yml',
      'Dockerfile*',
      'vercel.json',
      '.github/workflows/*.yml'
    ];
    
    for (const pattern of configFiles) {
      const files = glob.sync(pattern, { cwd: rootDir, absolute: true });
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          if (content.includes(filename)) {
            return true;
          }
        } catch {
          // Ignore read errors
        }
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Find code references to environment variables
 */
export function findVariableReferences(rootDir: string = '.'): Map<string, string[]> {
  const references = new Map<string, string[]>();
  
  try {
    // Search in source files
    const sourceFiles = glob.sync('src/**/*.{js,ts,tsx,jsx}', { 
      cwd: rootDir, 
      absolute: true 
    });
    
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(rootDir, file);
        
        // Find process.env.VARIABLE_NAME patterns
        const envMatches = content.match(/process\\.env\\.([A-Z_][A-Z0-9_]*)/g);
        if (envMatches) {
          for (const match of envMatches) {
            const varName = match.replace('process.env.', '');
            if (!references.has(varName)) {
              references.set(varName, []);
            }
            references.get(varName)!.push(relativePath);
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  } catch (error) {
    console.warn('Warning: Could not scan for variable references:', error);
  }
  
  return references;
}

/**
 * Generate variable descriptions based on name and usage
 */
export function generateDescription(name: string, category: string): string {
  const descriptions: Record<string, string> = {
    'DATABASE_URL': 'PostgreSQL database connection string',
    'NEXTAUTH_SECRET': 'Secret key for NextAuth.js session encryption',
    'NEXTAUTH_URL': 'Base URL for NextAuth.js callbacks',
    'STRIPE_PUBLISHABLE_KEY': 'Stripe publishable key for client-side payments',
    'STRIPE_SECRET_KEY': 'Stripe secret key for server-side payments',
    'STRIPE_WEBHOOK_SECRET': 'Stripe webhook endpoint secret',
    'AWS_ACCESS_KEY_ID': 'AWS access key for S3 and other services',
    'AWS_SECRET_ACCESS_KEY': 'AWS secret access key',
    'AWS_S3_BUCKET_NAME': 'S3 bucket name for file storage',
    'REDIS_URL': 'Redis connection string for caching',
    'SENDGRID_API_KEY': 'SendGrid API key for email sending',
    'FROM_EMAIL': 'Default from email address',
    'SENTRY_DSN': 'Sentry DSN for error tracking'
  };
  
  if (descriptions[name]) {
    return descriptions[name];
  }
  
  // Generate description based on category and name
  const categoryDescriptions: Record<string, string> = {
    'database': 'Database configuration',
    'auth': 'Authentication configuration',
    'payment': 'Payment processing configuration',
    'storage': 'File storage configuration',
    'email': 'Email service configuration',
    'monitoring': 'Monitoring and logging configuration',
    'api': 'API and external service configuration',
    'other': 'Application configuration'
  };
  
  return `${categoryDescriptions[category]} - ${name.toLowerCase().replace(/_/g, ' ')}`;
}

/**
 * Create consolidated environment file
 */
export function createConsolidatedEnvFile(
  filename: string,
  variables: Map<string, EnvVariable>,
  environment: 'local' | 'production' | 'staging' | 'test'
): string {
  const lines: string[] = [];
  
  lines.push(`# ${filename}`);
  lines.push(`# Generated on ${new Date().toISOString()}`);
  lines.push('');
  
  // Group variables by category
  const categories = new Map<string, EnvVariable[]>();
  
  for (const variable of variables.values()) {
    if (!categories.has(variable.category)) {
      categories.set(variable.category, []);
    }
    categories.get(variable.category)!.push(variable);
  }
  
  // Sort categories
  const sortedCategories = Array.from(categories.keys()).sort();
  
  for (const category of sortedCategories) {
    const categoryVars = categories.get(category)!;
    
    lines.push(`# ${category.toUpperCase()} CONFIGURATION`);
    lines.push('');
    
    for (const variable of categoryVars.sort((a, b) => a.name.localeCompare(b.name))) {
      // Add description as comment
      lines.push(`# ${variable.description}`);
      
      if (variable.required) {
        lines.push('# REQUIRED');
      }
      
      // Add example value
      let exampleValue = '';
      switch (environment) {
        case 'local':
          exampleValue = getLocalExampleValue(variable.name);
          break;
        case 'production':
          exampleValue = getProductionExampleValue(variable.name);
          break;
        case 'staging':
          exampleValue = getStagingExampleValue(variable.name);
          break;
        case 'test':
          exampleValue = getTestExampleValue(variable.name);
          break;
      }
      
      lines.push(`${variable.name}="${exampleValue}"`);
      lines.push('');
    }
  }
  
  return lines.join('\\n');
}

/**
 * Get example values for different environments
 */
function getLocalExampleValue(name: string): string {
  const examples: Record<string, string> = {
    'DATABASE_URL': 'postgresql://postgres:password@localhost:5432/directfanz',
    'REDIS_URL': 'redis://localhost:6379',
    'NEXTAUTH_URL': 'http://localhost:3000',
    'NEXTAUTH_SECRET': 'your-secret-key-change-in-production',
    'STRIPE_PUBLISHABLE_KEY': 'pk_test_...',
    'STRIPE_SECRET_KEY': 'sk_test_...',
    'AWS_S3_BUCKET_NAME': 'directfanz-dev'
  };
  
  return examples[name] || 'your-value-here';
}

function getProductionExampleValue(name: string): string {
  const examples: Record<string, string> = {
    'DATABASE_URL': 'postgresql://user:password@prod-db:5432/directfanz',
    'REDIS_URL': 'redis://prod-redis:6379',
    'NEXTAUTH_URL': 'https://directfanz.io',
    'NEXTAUTH_SECRET': 'CHANGE-THIS-TO-SECURE-RANDOM-STRING',
    'STRIPE_PUBLISHABLE_KEY': 'pk_live_...',
    'STRIPE_SECRET_KEY': 'sk_live_...',
    'AWS_S3_BUCKET_NAME': 'directfanz-production'
  };
  
  return examples[name] || 'CHANGE-THIS-VALUE';
}

function getStagingExampleValue(name: string): string {
  const examples: Record<string, string> = {
    'DATABASE_URL': 'postgresql://user:password@staging-db:5432/directfanz',
    'REDIS_URL': 'redis://staging-redis:6379',
    'NEXTAUTH_URL': 'https://staging.directfanz.io',
    'AWS_S3_BUCKET_NAME': 'directfanz-staging'
  };
  
  return examples[name] || getLocalExampleValue(name);
}

function getTestExampleValue(name: string): string {
  const examples: Record<string, string> = {
    'DATABASE_URL': 'postgresql://postgres:password@localhost:5432/directfanz_test',
    'REDIS_URL': 'redis://localhost:6379/1',
    'NEXTAUTH_URL': 'http://localhost:3000',
    'AWS_S3_BUCKET_NAME': 'directfanz-test'
  };
  
  return examples[name] || 'test-value';
}

/**
 * Main consolidation function
 */
export async function consolidateEnv(
  rootDir: string = '.',
  options: {
    dryRun?: boolean;
    outputDir?: string;
  } = {}
): Promise<ConsolidationResult> {
  const { dryRun = false, outputDir = '.' } = options;
  
  console.log('🔧 Starting environment configuration consolidation...\\n');
  
  // Step 1: Find all environment files
  console.log('🔍 Finding environment files...');
  const envFilePaths = findEnvFiles(rootDir);
  console.log(`   Found ${envFilePaths.length} environment files\\n`);
  
  if (envFilePaths.length === 0) {
    console.log('✅ No environment files found.');
    return {
      allVariables: new Map(),
      envFiles: [],
      codeReferences: new Map(),
      consolidatedFiles: [],
      errors: []
    };
  }
  
  // Step 2: Parse environment files
  console.log('📋 Parsing environment files...');
  const envFiles: EnvFile[] = [];
  const allVariables = new Map<string, EnvVariable>();
  
  for (const filePath of envFilePaths) {
    const variables = parseEnvFile(filePath);
    const referencedInCode = checkCodeReferences(filePath, rootDir);
    
    envFiles.push({
      path: filePath,
      variables,
      referencedInCode
    });
    
    console.log(`   ${path.relative(rootDir, filePath)}: ${variables.size} variables${referencedInCode ? ' (referenced in code)' : ''}`);
    
    // Collect all unique variables
    for (const [name, value] of variables) {
      if (!allVariables.has(name)) {
        const category = categorizeVariable(name);
        const description = generateDescription(name, category);
        const required = REQUIRED_VARIABLES.includes(name);
        
        allVariables.set(name, {
          name,
          value,
          description,
          required,
          category,
          files: []
        });
      }
      
      allVariables.get(name)!.files.push(path.relative(rootDir, filePath));
    }
  }
  
  console.log(`   Total unique variables: ${allVariables.size}\\n`);
  
  // Step 3: Find code references
  console.log('🔎 Finding code references...');
  const codeReferences = findVariableReferences(rootDir);
  console.log(`   Found references to ${codeReferences.size} variables\\n`);
  
  // Step 4: Create consolidated files
  const consolidatedFiles: string[] = [];
  const errors: string[] = [];
  
  if (!dryRun) {
    console.log('📄 Creating consolidated environment files...');
    
    const environments = [
      { name: 'local', filename: '.env.local.example' },
      { name: 'production', filename: '.env.production.example' },
      { name: 'staging', filename: '.env.staging.example' },
      { name: 'test', filename: '.env.test' }
    ];
    
    for (const env of environments) {
      try {
        const content = createConsolidatedEnvFile(
          env.filename,
          allVariables,
          env.name as 'local' | 'production' | 'staging' | 'test'
        );
        
        const outputPath = path.join(outputDir, env.filename);
        fs.writeFileSync(outputPath, content, 'utf-8');
        consolidatedFiles.push(outputPath);
        
        console.log(`   Created ${env.filename}`);
      } catch (error) {
        const errorMsg = `Failed to create ${env.filename}: ${error}`;
        errors.push(errorMsg);
        console.error(`   ✗ ${errorMsg}`);
      }
    }
  } else {
    console.log('🔄 DRY RUN - No files will be created\\n');
    console.log('Would create:');
    console.log('   .env.local.example');
    console.log('   .env.production.example');
    console.log('   .env.staging.example');
    console.log('   .env.test');
  }
  
  console.log('\\n📊 Summary:');
  console.log(`   Environment files found: ${envFiles.length}`);
  console.log(`   Unique variables: ${allVariables.size}`);
  console.log(`   Variables with code references: ${codeReferences.size}`);
  console.log(`   Consolidated files created: ${consolidatedFiles.length}`);
  console.log(`   Errors: ${errors.length}`);
  
  return {
    allVariables,
    envFiles,
    codeReferences,
    consolidatedFiles,
    errors
  };
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) {
    console.log('🔄 Running in DRY RUN mode - no files will be created\\n');
  }
  
  consolidateEnv('.', { dryRun })
    .then(result => {
      if (result.errors.length > 0) {
        console.log('\\n❌ Some errors occurred during consolidation');
        process.exit(1);
      }
      console.log('\\n✅ Environment consolidation complete!');
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}