import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Property Test: Build System Quality Enforcement', () => {
  const projectRoot = process.cwd();
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  const eslintConfigPath = path.join(projectRoot, '.eslintrc.json');
  const nextConfigPath = path.join(projectRoot, 'next.config.js');
  const packageJsonPath = path.join(projectRoot, 'package.json');

  describe('TypeScript Configuration Enforcement', () => {
    test('Property 4: TypeScript strict mode must be enabled', () => {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
      
      // Strict mode should be enabled
      expect(tsConfig.compilerOptions.strict).toBe(true);
      expect(tsConfig.compilerOptions.noImplicitAny).toBe(true);
      expect(tsConfig.compilerOptions.strictNullChecks).toBe(true);
      expect(tsConfig.compilerOptions.strictFunctionTypes).toBe(true);
      expect(tsConfig.compilerOptions.strictBindCallApply).toBe(true);
      expect(tsConfig.compilerOptions.strictPropertyInitialization).toBe(true);
      expect(tsConfig.compilerOptions.noImplicitThis).toBe(true);
      expect(tsConfig.compilerOptions.alwaysStrict).toBe(true);
    });

    test('Property 4: TypeScript should enforce unused variable detection', () => {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
      
      expect(tsConfig.compilerOptions.noUnusedLocals).toBe(true);
      expect(tsConfig.compilerOptions.noUnusedParameters).toBe(true);
      expect(tsConfig.compilerOptions.noImplicitReturns).toBe(true);
    });

    test('Property 4: TypeScript build errors should not be ignored', () => {
      const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Should not ignore TypeScript build errors
      expect(nextConfigContent).toContain('ignoreBuildErrors: false');
    });

    test('Property 4: TypeScript check script should be available', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.scripts.typecheck).toBeDefined();
      expect(packageJson.scripts.typecheck).toContain('tsc --noEmit');
    });
  });

  describe('ESLint Configuration Enforcement', () => {
    test('Property 4: ESLint should have strict rules configured', () => {
      const eslintConfig = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
      
      // Should extend TypeScript rules
      expect(eslintConfig.extends).toContain('next/typescript');
      
      // Should have strict error rules
      expect(eslintConfig.rules['react/no-unescaped-entities']).toBe('error');
      expect(eslintConfig.rules['react-hooks/exhaustive-deps']).toBe('error');
      expect(eslintConfig.rules['@next/next/no-img-element']).toBe('error');
      expect(eslintConfig.rules['@typescript-eslint/no-unused-vars']).toBe('error');
    });

    test('Property 4: ESLint should not be ignored during builds', () => {
      const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Should not ignore ESLint during builds
      expect(nextConfigContent).toContain('ignoreDuringBuilds: false');
    });

    test('Property 4: ESLint should have TypeScript parser configured', () => {
      const eslintConfig = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
      
      expect(eslintConfig.parser).toBe('@typescript-eslint/parser');
      expect(eslintConfig.plugins).toContain('@typescript-eslint');
      expect(eslintConfig.parserOptions.project).toBe('./tsconfig.json');
    });

    test('Property 4: ESLint check scripts should be available', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.scripts['lint:check']).toBeDefined();
      expect(packageJson.scripts['quality:check']).toBeDefined();
      expect(packageJson.scripts['quality:check']).toContain('typecheck');
      expect(packageJson.scripts['quality:check']).toContain('lint:check');
    });
  });

  describe('Build Process Quality Gates', () => {
    test('Property 4: Quality check script should validate TypeScript', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const qualityCheck = packageJson.scripts['quality:check'];
      
      expect(qualityCheck).toContain('typecheck');
      expect(qualityCheck).toContain('lint:check');
    });

    test('Property 4: Build configuration should enforce quality checks', () => {
      const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
      
      // TypeScript errors should fail builds
      expect(nextConfigContent).toContain('ignoreBuildErrors: false');
      
      // ESLint errors should fail builds
      expect(nextConfigContent).toContain('ignoreDuringBuilds: false');
      
      // ESLint should check specific directories
      expect(nextConfigContent).toContain("dirs: ['src', 'pages']");
    });

    test('Property 4: Development vs Production build enforcement', () => {
      const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Should not have conditional ignoring based on environment
      expect(nextConfigContent).not.toContain('process.env.NODE_ENV === \'development\'');
      
      // Quality checks should be enforced in all environments
      expect(nextConfigContent).toContain('ignoreBuildErrors: false');
      expect(nextConfigContent).toContain('ignoreDuringBuilds: false');
    });
  });

  describe('Code Quality Standards', () => {
    test('Property 4: Console statements should be restricted', () => {
      const eslintConfig = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
      
      // Console should be restricted with warnings
      expect(eslintConfig.rules['no-console']).toEqual(['warn', { allow: ['warn', 'error'] }]);
    });

    test('Property 4: Modern JavaScript features should be enforced', () => {
      const eslintConfig = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
      
      expect(eslintConfig.rules['prefer-const']).toBe('error');
      expect(eslintConfig.rules['no-var']).toBe('error');
    });

    test('Property 4: TypeScript best practices should be enforced', () => {
      const eslintConfig = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
      
      expect(eslintConfig.rules['@typescript-eslint/no-explicit-any']).toBe('warn');
      expect(eslintConfig.rules['@typescript-eslint/prefer-const']).toBe('error');
      expect(eslintConfig.rules['@typescript-eslint/no-non-null-assertion']).toBe('warn');
    });
  });

  describe('Build System Integration', () => {
    test('Property 4: Package.json should have all required quality scripts', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const requiredScripts = [
        'typecheck',
        'lint:check',
        'quality:check',
        'build',
      ];
      
      for (const script of requiredScripts) {
        expect(packageJson.scripts[script]).toBeDefined();
      }
    });

    test('Property 4: TypeScript configuration should be production-ready', () => {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
      
      // Should have proper module resolution
      expect(tsConfig.compilerOptions.moduleResolution).toBe('bundler');
      expect(tsConfig.compilerOptions.esModuleInterop).toBe(true);
      
      // Should have proper path mapping
      expect(tsConfig.compilerOptions.paths).toBeDefined();
      expect(tsConfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);
      
      // Should exclude test files from build
      expect(tsConfig.exclude).toContain('**/*.test.*');
      expect(tsConfig.exclude).toContain('**/__tests__/**/*');
    });

    test('Property 4: ESLint should have proper ECMAScript configuration', () => {
      const eslintConfig = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
      
      expect(eslintConfig.parserOptions.ecmaVersion).toBe(2022);
      expect(eslintConfig.parserOptions.sourceType).toBe('module');
    });
  });

  describe('Quality Gate Validation', () => {
    test('Property 4: TypeScript compilation should pass without errors', () => {
      try {
        // Run TypeScript check
        execSync('npm run typecheck', { 
          cwd: projectRoot, 
          stdio: 'pipe',
          timeout: 30000 
        });
        
        // If we reach here, TypeScript check passed
        expect(true).toBe(true);
      } catch (error) {
        // TypeScript errors should be fixed before this test passes
        console.error('TypeScript errors found:', error.stdout?.toString());
        throw new Error('TypeScript compilation failed - fix errors before proceeding');
      }
    }, 30000);

    test('Property 4: ESLint should pass without errors', () => {
      try {
        // Run ESLint check
        execSync('npm run lint:check', { 
          cwd: projectRoot, 
          stdio: 'pipe',
          timeout: 30000 
        });
        
        // If we reach here, ESLint check passed
        expect(true).toBe(true);
      } catch (error) {
        // ESLint errors should be fixed before this test passes
        console.error('ESLint errors found:', error.stdout?.toString());
        throw new Error('ESLint validation failed - fix errors before proceeding');
      }
    }, 30000);

    test('Property 4: Combined quality check should pass', () => {
      try {
        // Run combined quality check
        execSync('npm run quality:check', { 
          cwd: projectRoot, 
          stdio: 'pipe',
          timeout: 45000 
        });
        
        // If we reach here, all quality checks passed
        expect(true).toBe(true);
      } catch (error) {
        // Quality check errors should be fixed before this test passes
        console.error('Quality check failed:', error.stdout?.toString());
        throw new Error('Quality gate validation failed - fix all issues before proceeding');
      }
    }, 45000);
  });
});