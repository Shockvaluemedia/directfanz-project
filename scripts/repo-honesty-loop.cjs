#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const allowDirty = args.has('--allow-dirty');
const skipBuild = args.has('--skip-build');
const startedAt = new Date();
const timestamp = startedAt.toISOString().replace(/[:.]/g, '-');
const reportDir = path.join(root, 'reports', 'honesty', timestamp);
const latestDir = path.join(root, 'reports', 'honesty');

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return '';
  }
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function listFiles(dir, extensions) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];

  const out = [];
  const stack = [absolute];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(root, full);
      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'coverage', 'dist', 'build'].includes(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (extensions.some(ext => entry.name.endsWith(ext))) {
        out.push(relative);
      }
    }
  }
  return out.sort();
}

function run(command, argsForCommand, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, argsForCommand, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout || 120000,
    env: {
      ...process.env,
      CI: process.env.CI || '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  const durationMs = Date.now() - started;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  return {
    command: [command, ...argsForCommand].join(' '),
    code: result.status,
    signal: result.signal,
    durationMs,
    timedOut: result.error && result.error.code === 'ETIMEDOUT',
    stdout,
    stderr,
  };
}

function git(argsForGit) {
  const result = run('git', argsForGit, { timeout: 30000 });
  return `${result.stdout}${result.stderr}`.trim();
}

function npmScript(script, extraArgs = [], timeout = 180000) {
  const argsForNpm = ['run', script];
  if (extraArgs.length > 0) argsForNpm.push('--', ...extraArgs);
  return run('npm', argsForNpm, { timeout });
}

function statusLine(check) {
  return check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
}

function makeCheck(id, title, status, details = []) {
  return { id, title, status, details: details.filter(Boolean) };
}

function packageDependencies() {
  const pkg = JSON.parse(read('package.json') || '{}');
  return {
    pkg,
    deps: {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.optionalDependencies || {}),
    },
  };
}

function isEnvExample(file) {
  return (
    file.endsWith('.example') ||
    file.endsWith('.template') ||
    file.endsWith('.sample') ||
    file === '.env.example'
  );
}

function isSensitiveEnv(file) {
  const base = path.basename(file);
  return base === '.env' || (base.startsWith('.env.') && !isEnvExample(base));
}

function parseExports(file) {
  const text = read(file);
  const exports = new Set();
  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
    /\bexport\s+(?:declare\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)/g,
    /\bexport\s+class\s+([A-Za-z0-9_$]+)/g,
    /\bexport\s+interface\s+([A-Za-z0-9_$]+)/g,
    /\bexport\s+type\s+([A-Za-z0-9_$]+)/g,
    /\bexport\s+enum\s+([A-Za-z0-9_$]+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) exports.add(match[1]);
  }

  const namedExportPattern = /\bexport\s*\{([\s\S]*?)\}/g;
  let namedMatch;
  while ((namedMatch = namedExportPattern.exec(text))) {
    namedMatch[1]
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => {
        const cleaned = part.replace(/^type\s+/, '').split(/\s+as\s+/)[1] || part.split(/\s+as\s+/)[0];
        const name = cleaned.replace(/^type\s+/, '').trim();
        if (name && /^[A-Za-z0-9_$]+$/.test(name)) exports.add(name);
      });
  }

  return exports;
}

function resolveImport(fromFile, source) {
  let base;
  if (source.startsWith('@/')) {
    base = path.join(root, 'src', source.slice(2));
  } else if (source.startsWith('.')) {
    base = path.resolve(path.join(root, path.dirname(fromFile)), source);
  } else {
    return null;
  }

  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return path.relative(root, candidate);
  }
  return null;
}

function findImportContractDrift() {
  const files = listFiles('src', ['.ts', '.tsx', '.js']);
  const exportCache = new Map();
  const misses = [];

  for (const file of files) {
    const text = read(file);
    const importPattern = /\bimport\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importPattern.exec(text))) {
      const source = match[2];
      const resolved = resolveImport(file, source);
      if (!resolved) continue;

      if (!exportCache.has(resolved)) {
        exportCache.set(resolved, parseExports(resolved));
      }
      const exported = exportCache.get(resolved);

      const requested = match[1]
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => part.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
        .filter(Boolean);

      for (const name of requested) {
        if (!exported.has(name)) {
          misses.push(`${file} imports ${name} from ${source}, but ${resolved} does not export it`);
        }
      }
    }
  }

  return misses;
}

function collectStaticChecks() {
  const checks = [];
  const gitRoot = git(['rev-parse', '--show-toplevel']);
  const branch = git(['branch', '--show-current']);
  const status = git(['status', '--short']);
  const statusFiles = status.split('\n').filter(Boolean);

  checks.push(
    makeCheck(
      'repo-root',
      'Running from real git checkout',
      gitRoot === root ? 'pass' : 'fail',
      [`expected ${root}`, `git root ${gitRoot || '(none)'}`]
    )
  );

  checks.push(
    makeCheck(
      'worktree-state',
      'Worktree has no unreviewed local drift',
      statusFiles.length === 0 || allowDirty ? 'pass' : 'fail',
      [
        `branch: ${branch || '(unknown)'}`,
        allowDirty ? 'dirty tree allowed by --allow-dirty' : '',
        statusFiles.length === 0 ? 'no dirty files' : `${statusFiles.length} dirty/untracked entries`,
        ...statusFiles.slice(0, 40),
        statusFiles.length > 40 ? `... ${statusFiles.length - 40} more` : '',
      ]
    )
  );

  const tracked = git(['ls-files']).split('\n').filter(Boolean);
  const forbiddenTracked = tracked.filter(file => {
    const base = path.basename(file);
    if (isSensitiveEnv(file)) return true;
    if (base === 'cookies.txt') return true;
    if (/\.(db|sqlite|sqlite3|zip|tgz|tar\.gz|log)$/.test(base)) return true;
    return false;
  });

  checks.push(
    makeCheck(
      'tracked-artifacts',
      'Tracked files exclude secrets, databases, archives, cookies, and logs',
      forbiddenTracked.length === 0 ? 'pass' : 'fail',
      forbiddenTracked.slice(0, 60)
    )
  );

  const untrackedSensitive = statusFiles
    .filter(line => line.startsWith('?? '))
    .map(line => line.slice(3))
    .filter(file => isSensitiveEnv(file) || /\.(db|sqlite|sqlite3|zip|tgz|tar\.gz|log)$/.test(path.basename(file)));

  checks.push(
    makeCheck(
      'untracked-sensitive-files',
      'Untracked sensitive/local artifacts are not sitting in the repo',
      untrackedSensitive.length === 0 ? 'pass' : 'fail',
      untrackedSensitive.slice(0, 60)
    )
  );

  const libFiles = fs.existsSync(path.join(root, 'src', 'lib'))
    ? fs.readdirSync(path.join(root, 'src', 'lib'))
    : [];
  const jsShadows = libFiles
    .filter(file => file.endsWith('.js'))
    .filter(file => {
      const stem = file.slice(0, -3);
      return exists(path.join('src', 'lib', `${stem}.ts`)) || exists(path.join('src', 'lib', `${stem}.tsx`));
    })
    .map(file => path.join('src', 'lib', file));

  checks.push(
    makeCheck(
      'js-shadows',
      'No stale JavaScript siblings shadow TypeScript library modules',
      jsShadows.length === 0 ? 'pass' : 'fail',
      jsShadows
    )
  );

  const nextConfig = read('next.config.js');
  const suppressionDetails = [];
  if (/ignoreBuildErrors\s*:\s*true/.test(nextConfig)) suppressionDetails.push('typescript.ignoreBuildErrors is true');
  if (/ignoreDuringBuilds\s*:\s*true/.test(nextConfig)) suppressionDetails.push('eslint.ignoreDuringBuilds is true');

  checks.push(
    makeCheck(
      'build-suppressions',
      'Next build does not suppress TypeScript or ESLint failures',
      suppressionDetails.length === 0 ? 'pass' : 'fail',
      suppressionDetails
    )
  );

  const { deps } = packageDependencies();
  const eslintConfig = read('.eslintrc.json');
  const jestConfig = read('jest.config.js');
  const dependencyMisses = [];
  if (/next\/core-web-vitals|next\/typescript/.test(eslintConfig) && !deps['eslint-config-next']) {
    dependencyMisses.push('.eslintrc.json extends Next configs, but eslint-config-next is not installed');
  }
  if (/ts-jest/.test(jestConfig) && !deps['ts-jest']) {
    dependencyMisses.push('jest.config.js uses ts-jest, but ts-jest is not installed');
  }
  if ((exists('playwright.config.ts') || exists('e2e')) && !deps['@playwright/test']) {
    dependencyMisses.push('Playwright tests/config exist, but @playwright/test is not installed');
  }
  if (/from ['"]socket\.io['"]/.test(read('server.ts')) && !deps['socket.io']) {
    dependencyMisses.push('server.ts imports socket.io, but socket.io is not installed');
  }

  checks.push(
    makeCheck(
      'declared-tooling',
      'Configured tooling has matching package dependencies',
      dependencyMisses.length === 0 ? 'pass' : 'fail',
      dependencyMisses
    )
  );

  const tsconfig = JSON.parse(read('tsconfig.json') || '{}');
  const includes = tsconfig.include || [];
  const excludes = tsconfig.exclude || [];
  const blastRadius = [];
  if (includes.some(pattern => pattern.includes('**/*')) && exists('src/mobile') && !excludes.some(pattern => pattern.includes('src/mobile'))) {
    blastRadius.push('tsconfig includes src/mobile without mobile dependencies');
  }
  if (includes.some(pattern => pattern.includes('**/*')) && exists('e2e') && !excludes.some(pattern => pattern.includes('e2e'))) {
    blastRadius.push('tsconfig includes e2e without Playwright dependency boundary');
  }
  if (includes.some(pattern => pattern.includes('**/*')) && exists('scripts') && !excludes.some(pattern => pattern === 'scripts' || pattern.includes('scripts/'))) {
    blastRadius.push('tsconfig includes scripts without a separate script tsconfig');
  }

  checks.push(
    makeCheck(
      'typescript-boundaries',
      'TypeScript scope is deliberate for web, mobile, e2e, and scripts',
      blastRadius.length === 0 ? 'pass' : 'fail',
      blastRadius
    )
  );

  const homePage = read('src/app/page.tsx');
  const placeholderHome = /Platform launching soon/i.test(homePage);
  checks.push(
    makeCheck(
      'homepage-surface',
      'Default homepage is a real product surface, not a placeholder',
      placeholderHome ? 'fail' : 'pass',
      placeholderHome ? ['src/app/page.tsx renders "Platform launching soon..."'] : []
    )
  );

  const readiness = read('docs/aws-deployment-readiness.md');
  const openReadinessItems = readiness
    .split('\n')
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => line.includes('- [ ]'));

  checks.push(
    makeCheck(
      'deployment-readiness',
      'Deployment readiness doc has no open first-deploy blockers',
      openReadinessItems.length === 0 ? 'pass' : 'fail',
      openReadinessItems.map(item => `docs/aws-deployment-readiness.md:${item.index} ${item.line.trim()}`)
    )
  );

  const contractDrift = findImportContractDrift();
  checks.push(
    makeCheck(
      'import-contracts',
      'Named imports match named exports in local source modules',
      contractDrift.length === 0 ? 'pass' : 'fail',
      contractDrift.slice(0, 80)
    )
  );

  return checks;
}

function collectCommandChecks() {
  if (quick) return [];

  const commands = [
    {
      id: 'typecheck',
      title: 'TypeScript typecheck passes',
      run: () => npmScript('typecheck', [], 240000),
    },
    {
      id: 'lint',
      title: 'ESLint check passes',
      run: () => npmScript('lint:check', [], 180000),
    },
    {
      id: 'test',
      title: 'Jest test command starts and passes',
      run: () => npmScript('test', ['--runInBand', '--passWithNoTests', '--watch=false'], 180000),
    },
  ];

  if (!skipBuild) {
    commands.push({
      id: 'build',
      title: 'Next production build passes',
      run: () => npmScript('build', [], 360000),
    });
  }

  const results = [];
  for (const command of commands) {
    console.log(`\n[honesty] Running ${command.id}...`);
    const result = command.run();
    results.push({
      id: command.id,
      title: command.title,
      status: result.code === 0 && !result.signal && !result.timedOut ? 'pass' : 'fail',
      result,
      details: [
        result.command,
        `exit: ${result.code === null ? '(none)' : result.code}`,
        result.signal ? `signal: ${result.signal}` : '',
        result.timedOut ? 'timed out' : '',
        `duration: ${(result.durationMs / 1000).toFixed(1)}s`,
      ].filter(Boolean),
    });
  }
  return results;
}

function writeCommandLogs(commandChecks) {
  fs.mkdirSync(reportDir, { recursive: true });
  for (const check of commandChecks) {
    const log = [
      `$ ${check.result.command}`,
      `exit=${check.result.code}`,
      check.result.signal ? `signal=${check.result.signal}` : '',
      check.result.timedOut ? 'timed out' : '',
      '',
      '--- stdout ---',
      check.result.stdout,
      '',
      '--- stderr ---',
      check.result.stderr,
    ].filter(line => line !== '').join('\n');
    fs.writeFileSync(path.join(reportDir, `${check.id}.log`), log);
  }
}

function renderReport(staticChecks, commandChecks) {
  const allChecks = [...staticChecks, ...commandChecks];
  const failCount = allChecks.filter(check => check.status === 'fail').length;
  const warnCount = allChecks.filter(check => check.status === 'warn').length;
  const passCount = allChecks.filter(check => check.status === 'pass').length;
  const verdict = failCount === 0 ? 'PASS' : 'FAIL';

  const lines = [
    `# Repo Honesty Loop Report`,
    '',
    `Started: ${startedAt.toISOString()}`,
    `Mode: ${quick ? 'quick' : 'full'}${allowDirty ? ', allow-dirty' : ''}${skipBuild ? ', skip-build' : ''}`,
    `Verdict: ${verdict}`,
    '',
    `Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`,
    '',
    '| Check | Status |',
    '| --- | --- |',
    ...allChecks.map(check => `| ${check.title} | ${statusLine(check)} |`),
    '',
  ];

  for (const check of allChecks) {
    lines.push(`## ${statusLine(check)} - ${check.title}`);
    lines.push('');
    if (check.details.length === 0) {
      lines.push('No issues found.');
    } else {
      for (const detail of check.details.slice(0, 120)) {
        lines.push(`- ${detail}`);
      }
      if (check.details.length > 120) {
        lines.push(`- ... ${check.details.length - 120} more`);
      }
    }
    if (check.result) {
      lines.push(`- Log: ${path.join(reportDir, `${check.id}.log`)}`);
    }
    lines.push('');
  }

  return {
    verdict,
    failCount,
    warnCount,
    passCount,
    markdown: lines.join('\n'),
    json: {
      startedAt: startedAt.toISOString(),
      mode: { quick, allowDirty, skipBuild },
      verdict,
      counts: { pass: passCount, warn: warnCount, fail: failCount },
      checks: allChecks.map(check => ({
        id: check.id,
        title: check.title,
        status: check.status,
        details: check.details,
        command: check.result?.command,
        durationMs: check.result?.durationMs,
        exitCode: check.result?.code,
        signal: check.result?.signal,
        timedOut: !!check.result?.timedOut,
      })),
    },
  };
}

function main() {
  if (!exists('package.json')) {
    console.error('Run this command from the directfanz-project repository root.');
    process.exit(2);
  }

  console.log(`[honesty] Starting ${quick ? 'quick' : 'full'} repo honesty loop...`);
  const staticChecks = collectStaticChecks();
  const commandChecks = collectCommandChecks();
  writeCommandLogs(commandChecks);

  fs.mkdirSync(latestDir, { recursive: true });
  const report = renderReport(staticChecks, commandChecks);
  const reportPath = path.join(reportDir, 'report.md');
  const jsonPath = path.join(reportDir, 'report.json');
  fs.writeFileSync(reportPath, report.markdown);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report.json, null, 2)}\n`);
  fs.writeFileSync(path.join(latestDir, 'latest.md'), report.markdown);
  fs.writeFileSync(path.join(latestDir, 'latest.json'), `${JSON.stringify(report.json, null, 2)}\n`);

  console.log('');
  console.log(`[honesty] Verdict: ${report.verdict}`);
  console.log(`[honesty] Summary: ${report.passCount} pass, ${report.warnCount} warn, ${report.failCount} fail`);
  console.log(`[honesty] Report: ${reportPath}`);

  const failures = [...staticChecks, ...commandChecks].filter(check => check.status === 'fail');
  if (failures.length > 0) {
    console.log('');
    console.log('[honesty] Failing checks:');
    for (const failure of failures) {
      console.log(`- ${failure.title}`);
      for (const detail of failure.details.slice(0, 5)) {
        console.log(`  ${detail}`);
      }
      if (failure.details.length > 5) {
        console.log(`  ... ${failure.details.length - 5} more in report`);
      }
    }
    process.exit(1);
  }
}

main();
