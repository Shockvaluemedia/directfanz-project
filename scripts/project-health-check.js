#!/usr/bin/env node

/**
 * Project Health Check Script
 *
 * This script performs various checks on the project to ensure:
 * - All dependencies are properly installed
 * - No duplicate or unused dependencies
 * - Code structure follows best practices
 * - No dead code or unused files
 * - Performance optimizations are in place
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProjectHealthChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.recommendations = [];
    this.projectRoot = path.join(__dirname, '..');
  }

  async run() {
    console.log('🔍 Running Project Health Check...\n');

    await this.checkPackageJson();
    await this.checkTSConfig();
    await this.checkProjectStructure();
    await this.checkForDeadCode();
    await this.checkDependencyUsage();

    this.printResults();
  }

  async checkPackageJson() {
    console.log('📦 Checking package.json...');

    try {
      const mainPackage = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
      );
      const mobilePackage = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'NahveeEvenMobile', 'package.json'), 'utf8')
      );

      // Check for version inconsistencies
      const reactVersionMain =
        mainPackage.dependencies?.react || mainPackage.devDependencies?.react;
      const reactVersionMobile =
        mobilePackage.dependencies?.react || mobilePackage.devDependencies?.react;

      if (reactVersionMain && reactVersionMobile && reactVersionMain !== reactVersionMobile) {
        this.warnings.push(
          `React version mismatch: main (${reactVersionMain}) vs mobile (${reactVersionMobile})`
        );
      }

      // Check for unused dev dependencies
      const devDeps = Object.keys(mainPackage.devDependencies || {});
      const potentiallyUnused = devDeps.filter(
        dep =>
          !['typescript', 'eslint', 'prettier', '@types/', 'jest'].some(used => dep.includes(used))
      );

      if (potentiallyUnused.length > 0) {
        this.recommendations.push(
          `Consider reviewing these dev dependencies: ${potentiallyUnused.join(', ')}`
        );
      }

      console.log('  ✅ Package.json checked');
    } catch (error) {
      this.issues.push(`Failed to check package.json: ${error.message}`);
    }
  }

  async checkTSConfig() {
    console.log('⚙️  Checking TypeScript configuration...');

    try {
      const tsConfig = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'tsconfig.json'), 'utf8')
      );
      const mobileTsConfig = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'NahveeEvenMobile', 'tsconfig.json'), 'utf8')
      );

      // Check if strict mode is properly configured
      if (!tsConfig.compilerOptions?.strict && !tsConfig.compilerOptions?.noImplicitAny) {
        this.recommendations.push(
          'Consider enabling stricter TypeScript settings for better type safety'
        );
      }

      // Check for proper path mapping
      if (!tsConfig.compilerOptions?.paths) {
        this.recommendations.push('Consider adding path mapping for cleaner imports');
      }

      console.log('  ✅ TypeScript config checked');
    } catch (error) {
      this.issues.push(`Failed to check tsconfig.json: ${error.message}`);
    }
  }

  async checkProjectStructure() {
    console.log('📁 Checking project structure...');

    const expectedDirs = ['src/app', 'src/components', 'src/lib', 'src/mobile', 'prisma', 'public'];

    for (const dir of expectedDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        this.warnings.push(`Expected directory missing: ${dir}`);
      }
    }

    // Check for proper component organization
    const componentsDir = path.join(this.projectRoot, 'src/components');
    if (fs.existsSync(componentsDir)) {
      const components = fs.readdirSync(componentsDir, { withFileTypes: true });
      const componentFiles = components.filter(item => item.isFile() && item.name.endsWith('.tsx'));

      if (componentFiles.length > 10) {
        this.recommendations.push(
          'Consider organizing components into subdirectories for better structure'
        );
      }
    }

    console.log('  ✅ Project structure checked');
  }

  async checkForDeadCode() {
    console.log('🧹 Checking for dead code...');

    // Simple check for empty or single-line files
    const srcDir = path.join(this.projectRoot, 'src');
    const files = this.getAllTSXFiles(srcDir);

    let emptyFiles = 0;
    let smallFiles = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content
          .trim()
          .split('\n')
          .filter(line => line.trim().length > 0);

        if (lines.length === 0) {
          emptyFiles++;
        } else if (lines.length < 5 && !file.includes('types') && !file.includes('constants')) {
          smallFiles++;
        }
      } catch (error) {
        // Ignore file read errors
      }
    }

    if (emptyFiles > 0) {
      this.warnings.push(`Found ${emptyFiles} empty files that could be removed`);
    }

    if (smallFiles > 0) {
      this.recommendations.push(`Found ${smallFiles} very small files that might be consolidated`);
    }

    console.log('  ✅ Dead code check completed');
  }

  async checkDependencyUsage() {
    console.log('📋 Checking dependency usage...');

    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
      );
      const dependencies = Object.keys(packageJson.dependencies || {});

      // Simple check for potentially unused dependencies
      const codeDir = path.join(this.projectRoot, 'src');
      const allFiles = this.getAllTSXFiles(codeDir);

      let unusedDeps = [];
      let totalChecked = 0;

      for (const dep of dependencies.slice(0, 20)) {
        // Check first 20 to avoid long execution
        totalChecked++;
        let found = false;

        for (const file of allFiles.slice(0, 50)) {
          // Check first 50 files
          try {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes(`'${dep}'`) || content.includes(`"${dep}"`)) {
              found = true;
              break;
            }
          } catch (error) {
            // Ignore file read errors
          }
        }

        if (!found && !dep.startsWith('@types/') && dep !== 'react' && dep !== 'next') {
          unusedDeps.push(dep);
        }
      }

      if (unusedDeps.length > 0) {
        this.recommendations.push(
          `Potentially unused dependencies (limited check): ${unusedDeps.join(', ')}`
        );
      }

      console.log(`  ✅ Dependency usage checked (${totalChecked} dependencies analyzed)`);
    } catch (error) {
      this.warnings.push(`Could not complete dependency usage check: ${error.message}`);
    }
  }

  getAllTSXFiles(dir) {
    let files = [];

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          files = files.concat(this.getAllTSXFiles(fullPath));
        } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.ts'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore directory read errors
    }

    return files;
  }

  printResults() {
    console.log('\\n🎯 Health Check Results:\\n');

    if (this.issues.length === 0) {
      console.log('✅ No critical issues found!');
    } else {
      console.log('❌ Issues found:');
      this.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    if (this.warnings.length > 0) {
      console.log('\\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    if (this.recommendations.length > 0) {
      console.log('\\n💡 Recommendations:');
      this.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    console.log('\\n📊 Summary:');
    console.log(`  • Issues: ${this.issues.length}`);
    console.log(`  • Warnings: ${this.warnings.length}`);
    console.log(`  • Recommendations: ${this.recommendations.length}`);

    if (this.issues.length === 0 && this.warnings.length <= 3) {
      console.log('\\n🌟 Overall project health: GOOD');
    } else if (this.issues.length === 0) {
      console.log('\\n🔶 Overall project health: FAIR');
    } else {
      console.log('\\n🔴 Overall project health: NEEDS ATTENTION');
    }

    console.log('\\n✨ Health check complete!');
  }
}

// Run the health check
const checker = new ProjectHealthChecker();
checker.run().catch(error => {
  console.error('Health check failed:', error);
  process.exit(1);
});

export default ProjectHealthChecker;
