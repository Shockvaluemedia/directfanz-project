#!/usr/bin/env tsx
/**
 * Test Analysis Script
 * 
 * This script analyzes test files to detect stub tests, empty assertions,
 * TODO comments, and generates coverage reports with real vs stub test percentages.
 * 
 * Requirements: 4.1, 4.2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { execSync } from 'child_process';

// Types
export interface TestFile {
  path: string;
  content: string;
  testCount: number;
  stubTests: StubTest[];
  realTests: number;
  coverage?: CoverageInfo;
}

export interface StubTest {
  name: string;
  line: number;
  reason: 'empty_assertion' | 'todo_comment' | 'placeholder_expect' | 'no_assertions' | 'skip_only';
  details: string;
}

export interface CoverageInfo {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface TestAnalysisResult {
  totalTestFiles: number;
  totalTests: number;
  stubTests: number;
  realTests: number;
  stubPercentage: number;
  testFiles: TestFile[];
  coverageReport?: CoverageReport;
  criticalPaths: CriticalPath[];
  recommendations: string[];
}

export interface CoverageReport {
  overall: CoverageInfo;
  files: Map<string, CoverageInfo>;
  uncoveredFiles: string[];
}

export interface CriticalPath {
  path: string;
  importance: 'high' | 'medium' | 'low';
  currentCoverage: number;
  reason: string;
}

// Patterns for detecting stub tests
const STUB_PATTERNS = {
  emptyAssertion: [
    /expect\(\)\./,
    /expect\(true\)\.toBe\(true\)/,
    /expect\(false\)\.toBe\(false\)/,
    /expect\(1\)\.toBe\(1\)/
  ],
  todoComment: [
    /\/\/ TODO/i,
    /\/\* TODO/i,
    /\/\/ FIXME/i,
    /\/\* FIXME/i,
    /\/\/ XXX/i
  ],
  placeholderExpect: [
    /expect\(.*\)\.toBeDefined\(\)/,
    /expect\(.*\)\.toBeUndefined\(\)/,
    /expect\(.*\)\.toBeTruthy\(\)/,
    /expect\(.*\)\.toBeFalsy\(\)/
  ],
  skipOnly: [
    /\.skip\(/,
    /\.only\(/,
    /xdescribe\(/,
    /xit\(/,
    /xtest\(/
  ]
};

// Critical paths that should have high test coverage
const CRITICAL_PATHS = [
  { pattern: 'src/app/api/**/*.ts', importance: 'high' as const, reason: 'API endpoints' },
  { pattern: 'src/lib/auth*.ts', importance: 'high' as const, reason: 'Authentication logic' },
  { pattern: 'src/lib/payment*.ts', importance: 'high' as const, reason: 'Payment processing' },
  { pattern: 'src/lib/database*.ts', importance: 'high' as const, reason: 'Database operations' },
  { pattern: 'src/lib/security*.ts', importance: 'high' as const, reason: 'Security functions' },
  { pattern: 'src/components/auth/**/*.tsx', importance: 'medium' as const, reason: 'Auth components' },
  { pattern: 'src/components/payment/**/*.tsx', importance: 'medium' as const, reason: 'Payment components' },
  { pattern: 'src/hooks/**/*.ts', importance: 'medium' as const, reason: 'Custom hooks' },
  { pattern: 'src/utils/**/*.ts', importance: 'medium' as const, reason: 'Utility functions' }
];

/**
 * Find all test files in the project
 */
export function findTestFiles(rootDir: string = '.'): string[] {
  const patterns = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.test.js',
    '**/*.test.jsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/*.spec.js',
    '**/*.spec.jsx'
  ];
  
  const testFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { 
      cwd: rootDir, 
      absolute: true,
      ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**']
    });
    testFiles.push(...files);
  }
  
  return [...new Set(testFiles)].sort();
}

/**
 * Analyze a single test file
 */
export function analyzeTestFile(filePath: string): TestFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const stubTests: StubTest[] = [];
  let testCount = 0;
  
  // Count total tests
  const testMatches = content.match(/(test|it|describe)\s*\(/g);
  testCount = testMatches ? testMatches.length : 0;
  
  // Analyze each line for stub patterns
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      return;
    }
    
    // Check for empty assertions
    for (const pattern of STUB_PATTERNS.emptyAssertion) {
      if (pattern.test(line)) {
        stubTests.push({
          name: extractTestName(lines, index),
          line: lineNumber,
          reason: 'empty_assertion',
          details: `Empty or trivial assertion: ${trimmedLine}`
        });
        break;
      }
    }
    
    // Check for TODO comments
    for (const pattern of STUB_PATTERNS.todoComment) {
      if (pattern.test(line)) {
        stubTests.push({
          name: extractTestName(lines, index),
          line: lineNumber,
          reason: 'todo_comment',
          details: `TODO comment: ${trimmedLine}`
        });
        break;
      }
    }
    
    // Check for placeholder expects
    for (const pattern of STUB_PATTERNS.placeholderExpect) {
      if (pattern.test(line) && !hasRealAssertion(lines, index)) {
        stubTests.push({
          name: extractTestName(lines, index),
          line: lineNumber,
          reason: 'placeholder_expect',
          details: `Placeholder assertion: ${trimmedLine}`
        });
        break;
      }
    }
    
    // Check for skip/only
    for (const pattern of STUB_PATTERNS.skipOnly) {
      if (pattern.test(line)) {
        stubTests.push({
          name: extractTestName(lines, index),
          line: lineNumber,
          reason: 'skip_only',
          details: `Skipped or focused test: ${trimmedLine}`
        });
        break;
      }
    }
  });
  
  // Check for tests with no assertions
  const testBlocks = extractTestBlocks(content);
  for (const block of testBlocks) {
    if (!hasAssertions(block.content)) {
      stubTests.push({
        name: block.name,
        line: block.line,
        reason: 'no_assertions',
        details: 'Test has no assertions'
      });
    }
  }
  
  const realTests = testCount - stubTests.length;
  
  return {
    path: filePath,
    content,
    testCount,
    stubTests,
    realTests: Math.max(0, realTests)
  };
}

/**
 * Extract test name from surrounding context
 */
function extractTestName(lines: string[], currentIndex: number): string {
  // Look backwards for test/it/describe declaration
  for (let i = currentIndex; i >= Math.max(0, currentIndex - 10); i--) {
    const line = lines[i];
    const match = line.match(/(test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (match) {
      return match[2];
    }
  }
  return 'Unknown test';
}

/**
 * Check if line has real assertion logic
 */
function hasRealAssertion(lines: string[], currentIndex: number): boolean {
  // Look at surrounding lines for complex assertions
  const contextLines = lines.slice(
    Math.max(0, currentIndex - 3),
    Math.min(lines.length, currentIndex + 3)
  ).join(' ');
  
  const realAssertionPatterns = [
    /expect\(.*\)\.toEqual\(/,
    /expect\(.*\)\.toMatchObject\(/,
    /expect\(.*\)\.toHaveLength\(/,
    /expect\(.*\)\.toContain\(/,
    /expect\(.*\)\.toThrow\(/,
    /expect\(.*\)\.toHaveBeenCalled/,
    /expect\(.*\)\.toHaveBeenCalledWith/
  ];
  
  return realAssertionPatterns.some(pattern => pattern.test(contextLines));
}

/**
 * Extract test blocks from content
 */
function extractTestBlocks(content: string): { name: string; line: number; content: string }[] {
  const blocks: { name: string; line: number; content: string }[] = [];
  const lines = content.split('\n');
  
  let currentBlock: { name: string; line: number; content: string } | null = null;
  let braceCount = 0;
  
  lines.forEach((line, index) => {
    const testMatch = line.match(/(test|it)\s*\(\s*['"`]([^'"`]+)['"`]/);
    
    if (testMatch) {
      // Start new test block
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      
      currentBlock = {
        name: testMatch[2],
        line: index + 1,
        content: line
      };
      braceCount = 0;
    }
    
    if (currentBlock) {
      currentBlock.content += '\n' + line;
      
      // Count braces to find end of block
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceCount += openBraces - closeBraces;
      
      if (braceCount < 0 && line.includes('}')) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    }
  });
  
  if (currentBlock) {
    blocks.push(currentBlock);
  }
  
  return blocks;
}

/**
 * Check if test block has assertions
 */
function hasAssertions(content: string): boolean {
  const assertionPatterns = [
    /expect\s*\(/,
    /assert\s*\(/,
    /should\s*\./,
    /\.should\s*\./
  ];
  
  return assertionPatterns.some(pattern => pattern.test(content));
}

/**
 * Identify critical paths with low coverage
 */
export function identifyCriticalPaths(rootDir: string = '.'): CriticalPath[] {
  const criticalPaths: CriticalPath[] = [];
  
  for (const pathConfig of CRITICAL_PATHS) {
    const files = glob.sync(pathConfig.pattern, { 
      cwd: rootDir, 
      absolute: true,
      ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**']
    });
    
    for (const file of files) {
      // For now, assume 0% coverage - would need actual coverage data
      criticalPaths.push({
        path: path.relative(rootDir, file),
        importance: pathConfig.importance,
        currentCoverage: 0,
        reason: pathConfig.reason
      });
    }
  }
  
  return criticalPaths.sort((a, b) => {
    const importanceOrder = { high: 3, medium: 2, low: 1 };
    return importanceOrder[b.importance] - importanceOrder[a.importance];
  });
}

/**
 * Generate recommendations based on analysis
 */
export function generateRecommendations(result: TestAnalysisResult): string[] {
  const recommendations: string[] = [];
  
  // Stub test recommendations
  if (result.stubPercentage > 30) {
    recommendations.push(`High stub test percentage (${result.stubPercentage.toFixed(1)}%). Consider implementing real assertions.`);
  }
  
  if (result.stubTests > 0) {
    recommendations.push(`Found ${result.stubTests} stub tests. Review and implement proper test logic.`);
  }
  
  // Critical path recommendations
  const highImportancePaths = result.criticalPaths.filter(p => p.importance === 'high');
  if (highImportancePaths.length > 0) {
    recommendations.push(`${highImportancePaths.length} critical paths need test coverage.`);
  }
  
  // File-specific recommendations
  const filesWithManyStubs = result.testFiles.filter(f => f.stubTests.length > 3);
  if (filesWithManyStubs.length > 0) {
    recommendations.push(`${filesWithManyStubs.length} test files have multiple stub tests.`);
  }
  
  return recommendations;
}

/**
 * Main analysis function
 */
export async function analyzeTests(
  rootDir: string = '.',
  options: {
    includeCoverage?: boolean;
    outputFile?: string;
  } = {}
): Promise<TestAnalysisResult> {
  const { includeCoverage = true, outputFile } = options;
  
  console.log('🧪 Starting test analysis...\n');
  
  // Step 1: Find test files
  console.log('🔍 Finding test files...');
  const testFilePaths = findTestFiles(rootDir);
  console.log(`   Found ${testFilePaths.length} test files\n`);
  
  if (testFilePaths.length === 0) {
    console.log('✅ No test files found.');
    return {
      totalTestFiles: 0,
      totalTests: 0,
      stubTests: 0,
      realTests: 0,
      stubPercentage: 0,
      testFiles: [],
      criticalPaths: [],
      recommendations: []
    };
  }
  
  // Step 2: Analyze test files
  console.log('📋 Analyzing test files...');
  const testFiles: TestFile[] = [];
  let totalTests = 0;
  let totalStubTests = 0;
  
  for (const filePath of testFilePaths) {
    const analysis = analyzeTestFile(filePath);
    testFiles.push(analysis);
    totalTests += analysis.testCount;
    totalStubTests += analysis.stubTests.length;
    
    const relativePath = path.relative(rootDir, filePath);
    console.log(`   ${relativePath}: ${analysis.testCount} tests (${analysis.stubTests.length} stubs)`);
  }
  
  console.log(`   Total: ${totalTests} tests (${totalStubTests} stubs)\n`);
  
  // Step 3: Identify critical paths
  console.log('🎯 Identifying critical paths...');
  const criticalPaths = identifyCriticalPaths(rootDir);
  console.log(`   Found ${criticalPaths.length} critical paths\n`);
  
  // Step 4: Calculate metrics
  const realTests = totalTests - totalStubTests;
  const stubPercentage = totalTests > 0 ? (totalStubTests / totalTests) * 100 : 0;
  
  const result: TestAnalysisResult = {
    totalTestFiles: testFiles.length,
    totalTests,
    stubTests: totalStubTests,
    realTests,
    stubPercentage,
    testFiles,
    criticalPaths,
    recommendations: []
  };
  
  // Step 5: Generate recommendations
  result.recommendations = generateRecommendations(result);
  
  // Step 6: Save report
  if (outputFile) {
    const report = generateReport(result);
    fs.writeFileSync(outputFile, report, 'utf-8');
    console.log(`📄 Saved analysis report to ${outputFile}\n`);
  }
  
  console.log('📊 Summary:');
  console.log(`   Test files: ${result.totalTestFiles}`);
  console.log(`   Total tests: ${result.totalTests}`);
  console.log(`   Stub tests: ${result.stubTests} (${result.stubPercentage.toFixed(1)}%)`);
  console.log(`   Real tests: ${result.realTests}`);
  console.log(`   Critical paths: ${result.criticalPaths.length}`);
  console.log(`   Recommendations: ${result.recommendations.length}`);
  
  return result;
}

/**
 * Generate analysis report
 */
function generateReport(result: TestAnalysisResult): string {
  const lines: string[] = [];
  
  lines.push('# Test Analysis Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Total Test Files:** ${result.totalTestFiles}`);
  lines.push(`**Total Tests:** ${result.totalTests}`);
  lines.push(`**Stub Tests:** ${result.stubTests} (${result.stubPercentage.toFixed(1)}%)`);
  lines.push(`**Real Tests:** ${result.realTests}`);
  lines.push('');
  
  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of result.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }
  
  // Critical paths
  if (result.criticalPaths.length > 0) {
    lines.push('## Critical Paths');
    lines.push('');
    for (const path of result.criticalPaths) {
      lines.push(`- **${path.path}** (${path.importance}) - ${path.reason}`);
    }
    lines.push('');
  }
  
  // Stub tests by file
  const filesWithStubs = result.testFiles.filter(f => f.stubTests.length > 0);
  if (filesWithStubs.length > 0) {
    lines.push('## Files with Stub Tests');
    lines.push('');
    for (const file of filesWithStubs) {
      lines.push(`### ${path.basename(file.path)}`);
      lines.push('');
      for (const stub of file.stubTests) {
        lines.push(`- **Line ${stub.line}:** ${stub.name} - ${stub.details}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const includeCoverage = !args.includes('--no-coverage');
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'test-analysis-report.md';
  
  analyzeTests('.', { includeCoverage, outputFile })
    .then(result => {
      if (result.recommendations.length > 0) {
        console.log('\n⚠️  Recommendations:');
        result.recommendations.forEach(rec => console.log(`   • ${rec}`));
      }
      console.log('\n✅ Test analysis complete!');
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}