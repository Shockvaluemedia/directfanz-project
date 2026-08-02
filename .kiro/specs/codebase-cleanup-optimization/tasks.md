# Implementation Plan: Codebase Cleanup and Optimization

## Overview

This implementation plan guides the cleanup and optimization of the DirectFanz codebase, addressing documentation sprawl, backup file accumulation, environment configuration complexity, test coverage gaps, schema incompleteness, and infrastructure completion. Tasks are organized to allow independent execution while building toward a cleaner, more maintainable codebase.

## Tasks

- [x] 1. Documentation Consolidation
- [x] 1.1 Create documentation consolidation script
  - Create `scripts/consolidate-docs.ts` script
  - Implement markdown file scanning from root directory
  - Implement content-based category classification
  - Create `/docs` directory structure with subdirectories
  - _Requirements: 1.1, 1.2_

- [x] 1.2 Implement link updating and index generation
  - Parse markdown files for internal links
  - Update all links to reflect new paths
  - Generate `docs/README.md` master index
  - Handle duplicate file detection and merging
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 1.3 Write property test for documentation consolidation
  - **Property 1: Documentation Consolidation Integrity**
  - **Validates: Requirements 1.1, 1.3**

- [x] 1.4 Execute documentation consolidation
  - Run consolidation script on codebase
  - Verify all files moved to correct categories
  - Validate all internal links resolve correctly
  - Update root README.md to point to new docs location
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Checkpoint - Documentation Consolidation Complete
  - Verify `/docs` structure is correct
  - Ensure all links work
  - Ask user if questions arise

- [x] 3. Backup and Duplicate File Cleanup
- [x] 3.1 Create file cleanup script with manifest generation
  - Create `scripts/cleanup-files.ts` script
  - Implement pattern matching for backup files (`.backup`, `.bak`, `_backup`, `.disabled`)
  - Generate cleanup manifest JSON before any deletions
  - Calculate total size of files to be removed
  - _Requirements: 2.1, 2.2_

- [x] 3.2 Implement git archiving and cleanup execution
  - Create backup branch with files before removal
  - Implement safe deletion with rollback capability
  - Generate cleanup report with statistics
  - Handle Dockerfile consolidation (keep only essential versions)
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 3.3 Write property test for file cleanup
  - **Property 2: Backup File Identification Completeness**
  - **Validates: Requirements 2.1, 2.5**

- [x] 3.4 Execute file cleanup
  - Run cleanup script on codebase
  - Verify manifest accuracy
  - Confirm backup branch created
  - Validate essential files preserved
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Environment Configuration Consolidation
- [x] 4.1 Analyze and consolidate environment files
  - Create `scripts/consolidate-env.ts` script
  - Scan all `.env*` files and extract variables
  - Identify which files are referenced in code
  - Create consolidated `.env.local.example`, `.env.production.example`, `.env.staging.example`, `.env.test`
  - _Requirements: 3.1, 3.2_

- [x] 4.2 Generate environment documentation
  - Create `docs/guides/ENVIRONMENT_VARIABLES.md`
  - Document all variables with descriptions and categories
  - Include required vs optional designation
  - Add example values and validation rules
  - _Requirements: 3.2_

- [x] 4.3 Implement environment validation module
  - Create `src/lib/env-validation.ts`
  - Implement startup validation for required variables
  - Add clear error messages for missing variables
  - Integrate with Next.js application startup
  - _Requirements: 3.4, 3.5_

- [x] 4.4 Write property tests for environment configuration
  - **Property 3: Environment Reference Safety**
  - **Property 4: Environment Validation Completeness**
  - **Validates: Requirements 3.3, 3.4, 3.5**

- [x] 4.5 Execute environment consolidation
  - Run consolidation script
  - Remove redundant env files
  - Verify no broken references in code
  - Test application startup with new configuration
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Checkpoint - File and Environment Cleanup Complete
  - Verify backup files removed
  - Confirm environment files consolidated
  - Ensure application starts correctly
  - Ask user if questions arise

- [x] 6. Test Coverage Verification and Enhancement
- [x] 6.1 Create test analysis script
  - Create `scripts/analyze-tests.ts` script
  - Implement stub test detection (empty assertions, TODO comments)
  - Generate coverage report with stub vs real test percentages
  - Identify critical paths with low coverage
  - _Requirements: 4.1, 4.2_

- [x] 6.2 Fix or remove stub tests
  - Review identified stub tests
  - Implement real assertions for valuable stubs
  - Remove placeholder tests that add no value
  - Ensure all remaining tests exercise actual code
  - _Requirements: 4.3_

- [x] 6.3 Configure Jest coverage thresholds
  - Update `jest.config.js` with coverage thresholds
  - Set 70% minimum for critical paths
  - Configure coverage reporters
  - Add coverage to CI/CD pipeline
  - _Requirements: 4.4, 4.5_

- [x] 6.4 Verify and fix Playwright E2E tests
  - Review `playwright.config.ts` configuration
  - Ensure all E2E tests are runnable
  - Fix any broken E2E tests
  - Integrate Playwright into CI/CD workflow
  - _Requirements: 4.6_

- [x] 6.5 Write property tests for test coverage
  - **Property 5: Test Stub Elimination**
  - **Property 6: Test Summary Accuracy**
  - **Validates: Requirements 4.1, 4.3, 4.5**

- [x] 7. Prisma Schema Completion
- [x] 7.1 Complete truncated Prisma models
  - Review `prisma/schema.prisma` for truncation
  - Complete `ai_agent_logs` model definition
  - Add any missing fields or relations
  - _Requirements: 5.1, 5.2_

- [x] 7.2 Validate and fix schema relations
  - Run `prisma validate` to check schema
  - Add cascade rules to all relations
  - Fix any validation errors
  - Generate Prisma client without warnings
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 7.3 Write property test for Prisma schema
  - **Property 7: Prisma Relation Cascade Rules**
  - **Validates: Requirements 5.4**

- [x] 8. Checkpoint - Test and Schema Complete
  - Verify test coverage meets thresholds
  - Confirm Prisma schema validates
  - Run full test suite
  - Ask user if questions arise

- [x] 9. Mobile App Backend Integration
- [x] 9.1 Create mobile API service layer
  - Review existing `NahveeEvenMobile` structure
  - Create `src/mobile/services/api.ts` with all endpoint methods
  - Implement type-safe API client matching backend routes
  - Add error handling and retry logic
  - _Requirements: 6.1_

- [x] 9.2 Implement mobile authentication flow
  - Create `src/mobile/services/auth.ts`
  - Implement NextAuth.js token-based authentication
  - Add secure token storage using React Native Keychain
  - Handle token refresh and session management
  - _Requirements: 6.2, 6.3_

- [x] 9.3 Implement offline-first data caching
  - Create `src/mobile/services/cache.ts`
  - Implement AsyncStorage-based content caching
  - Add action queue for offline operations
  - Implement sync mechanism for reconnection
  - _Requirements: 6.4, 6.5_

- [x] 9.4 Set up push notifications
  - Configure Firebase Cloud Messaging
  - Create `src/mobile/services/notifications.ts`
  - Implement notification handlers
  - Add backend integration for sending notifications
  - _Requirements: 6.6_

- [x] 9.5 Write property tests for mobile integration
  - **Property 8: Mobile API Coverage**
  - **Property 9: Mobile Offline Functionality**
  - **Validates: Requirements 6.1, 6.4, 6.5**

- [x] 10. Streaming Infrastructure Completion
- [x] 10.1 Configure AWS IVS channel
  - Update `infrastructure/terraform/streaming-infrastructure.tf`
  - Create IVS channel with proper configuration
  - Set up RTMP ingest endpoint
  - Configure stream key generation
  - _Requirements: 7.1, 7.2_

- [x] 10.2 Implement HLS playback and adaptive bitrate
  - Configure HLS output with multiple quality levels
  - Implement adaptive bitrate streaming
  - Create playback URL generation in `src/lib/streaming-auth.ts`
  - Add quality selection UI components
  - _Requirements: 7.3, 7.4_

- [x] 10.3 Set up VOD recording
  - Configure automatic recording to S3
  - Implement VOD processing pipeline
  - Update `src/lib/vod-service.ts` for recording management
  - Add VOD playback endpoints
  - _Requirements: 7.5_

- [x] 10.4 Integrate streaming with WebSocket chat
  - Connect streaming events to WebSocket server
  - Implement chat overlay for live streams
  - Add viewer count real-time updates
  - Integrate tipping during streams
  - _Requirements: 7.6_

- [x] 10.5 Implement bitrate adaptation
  - Add network quality detection
  - Implement automatic bitrate adjustment
  - Create fallback quality handling
  - Add user quality preference settings
  - _Requirements: 7.7_

- [x] 10.6 Write property tests for streaming
  - **Property 10: Stream Lifecycle Management**
  - **Property 11: Adaptive Bitrate Response**
  - **Validates: Requirements 7.3, 7.5, 7.7****
  - **Validates: Requirements 7.3, 7.5, 7.7**

- [x] 11. Checkpoint - Mobile and Streaming Complete
  - Verify mobile app connects to backend
  - Test streaming end-to-end
  - Validate VOD recording works
  - Ask user if questions arise

- [x] 12. Code Quality Enforcement
- [x] 12.1 Enable TypeScript strict mode
  - Update `tsconfig.json` with strict settings
  - Fix all TypeScript errors in codebase
  - Ensure build passes with strict mode
  - _Requirements: 8.1_

- [x] 12.2 Fix ESLint violations
  - Run ESLint across entire codebase
  - Fix all violations or add justified exceptions
  - Update `.eslintrc.json` with appropriate rules
  - Ensure zero violations on build
  - _Requirements: 8.2_

- [x] 12.3 Configure Prettier and code quality tools
  - Update `.prettierrc` configuration
  - Run Prettier on all files
  - Add duplicate code detection (jscpd)
  - Configure cyclomatic complexity checks
  - _Requirements: 8.4, 8.5, 8.6_

- [x] 12.4 Set up PR quality gates
  - Update GitHub Actions workflow
  - Add quality checks as required status checks
  - Configure branch protection rules
  - Block merges on quality failures
  - _Requirements: 8.3_

- [x] 12.5 Write property test for code quality
  - **Property 12: Code Quality Metrics Enforcement**
  - **Validates: Requirements 8.4, 8.5, 8.6**

- [x] 13. CI/CD Pipeline Verification
- [x] 13.1 Verify build and test automation
  - Review `.github/workflows` configuration
  - Ensure all test types run on push
  - Verify build artifacts are generated
  - Test pipeline with sample commits
  - _Requirements: 9.1, 9.2_

- [x] 13.2 Configure staging auto-deployment
  - Set up staging environment deployment
  - Configure automatic deployment on test pass
  - Add deployment notifications
  - Verify staging environment works
  - _Requirements: 9.3_

- [x] 13.3 Set up production deployment with approval
  - Configure manual approval gate for production
  - Set up rollback automation on failure
  - Add deployment notifications
  - Test rollback procedure
  - _Requirements: 9.4, 9.5_

- [x] 13.4 Implement artifact versioning
  - Add version tagging to build artifacts
  - Configure semantic versioning or commit-based tags
  - Update deployment scripts to use versioned artifacts
  - _Requirements: 9.6_

- [x] 13.5 Write property test for CI/CD
  - **Property 13: Deployment Artifact Versioning**
  - **Validates: Requirements 9.6**

- [x] 14. Repository Organization
- [x] 14.1 Organize root-level files
  - Move scripts to `/scripts` directory
  - Move configuration files to appropriate locations
  - Reduce root to essential files only (< 10)
  - Update all references to moved files
  - _Requirements: 10.1, 10.2_

- [x] 14.2 Organize test files
  - Ensure tests are in `/tests` or co-located with source
  - Remove orphaned test files
  - Update Jest configuration for test locations
  - _Requirements: 10.4_

- [x] 14.3 Verify infrastructure organization
  - Ensure all IaC is under `/infrastructure`
  - Organize Terraform files by resource type
  - Clean up duplicate infrastructure configs
  - _Requirements: 10.5_

- [x] 14.4 Update README for onboarding
  - Rewrite README.md with clear onboarding path
  - Add quick start guide
  - Link to consolidated documentation
  - Include contribution guidelines
  - _Requirements: 10.3_

- [x] 14.5 Write property test for repository organization
  - **Property 14: Repository File Organization**
  - **Validates: Requirements 10.2, 10.4, 10.5**

- [x] 15. Final Checkpoint - Codebase Cleanup Complete
  - Run full test suite
  - Verify all quality checks pass
  - Confirm documentation is accessible
  - Validate CI/CD pipeline works end-to-end
  - Platform codebase is clean, organized, and maintainable

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- Property tests validate universal correctness properties using Jest with fast-check
- Execute tasks in order as some depend on previous completions
- Documentation consolidation should be done first to establish the new structure
- Mobile and streaming tasks can be parallelized if resources allow