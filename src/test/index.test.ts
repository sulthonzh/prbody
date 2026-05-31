import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generate, formatMarkdown, formatJson, formatText } from '../index.js';
import type { PRDescription } from '../index.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prbody-test-'));
  execSync('git init -b main', { cwd: dir });
  execSync('git config user.email test@test.com', { cwd: dir });
  execSync('git config user.name Test', { cwd: dir });
  return dir;
}

function commit(cwd: string, msg: string, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(cwd, name), content);
    execSync(`git add ${name}`, { cwd });
  }
  execSync(`git commit -m "${msg}"`, { cwd });
}

describe('generate', () => {
  it('detects changes between base and head', async () => {
    const cwd = makeTempRepo();
    commit(cwd, 'initial', { 'a.txt': 'hello' });
    execSync('git checkout -b feature', { cwd });
    commit(cwd, 'feat: add auth', { 'auth.ts': 'export function auth() {}' });
    commit(cwd, 'fix: typo', { 'a.txt': 'hello world' });

    const pr = await generate({ base: 'main', head: 'feature', cwd });
    assert.equal(pr.commits.length, 2);
    assert.equal(pr.filesChanged, 2);
    assert.ok(pr.totalAdditions > 0);
    assert.ok(pr.summary.length > 0);
  });

  it('handles no changes', async () => {
    const cwd = makeTempRepo();
    commit(cwd, 'initial', { 'a.txt': 'hello' });
    execSync('git checkout -b same', { cwd });

    const pr = await generate({ base: 'main', head: 'same', cwd });
    assert.equal(pr.filesChanged, 0);
    assert.equal(pr.commits.length, 0);
  });

  it('detects file additions and deletions', async () => {
    const cwd = makeTempRepo();
    commit(cwd, 'initial', { 'keep.txt': 'stay', 'remove.txt': 'bye' });
    execSync('git checkout -b changes', { cwd });
    fs.writeFileSync(path.join(cwd, 'new.txt'), 'fresh');
    fs.unlinkSync(path.join(cwd, 'remove.txt'));
    execSync('git add -A', { cwd });
    execSync('git commit -m "swap files"', { cwd });

    const pr = await generate({ base: 'main', head: 'changes', cwd });
    assert.ok(pr.changes.some((c: any) => c.file === 'new.txt'));
    assert.ok(pr.changes.some((c: any) => c.file === 'remove.txt'));
  });

  it('generates summary from conventional commits', async () => {
    const cwd = makeTempRepo();
    commit(cwd, 'initial', { 'a.txt': 'hello' });
    execSync('git checkout -b feat', { cwd });
    commit(cwd, 'feat(auth): add JWT middleware', { 'jwt.ts': 'export {}' });
    commit(cwd, 'feat(auth): add login route', { 'login.ts': 'export {}' });

    const pr = await generate({ base: 'main', head: 'feat', cwd });
    assert.ok(pr.summary.includes('auth'));
    assert.ok(pr.commits.length === 2);
  });

  it('uses custom maxFiles and maxCommits', async () => {
    const cwd = makeTempRepo();
    commit(cwd, 'initial', { 'a.txt': 'hello' });
    execSync('git checkout -b big', { cwd });
    for (let i = 0; i < 5; i++) {
      commit(cwd, `commit ${i}`, { [`file${i}.txt`]: `content ${i}` });
    }

    const pr = await generate({ base: 'main', head: 'big', cwd, maxFiles: 2, maxCommits: 2 });
    assert.ok(pr.changes.length <= 2);
    assert.ok(pr.commits.length <= 2);
    assert.equal(pr.filesChanged, 5); // total unchanged
  });
});

describe('formatMarkdown', () => {
  const samplePR: PRDescription = {
    title: 'feat: add auth',
    summary: 'Add JWT authentication.',
    changes: [
      { file: 'auth.ts', status: 'added', additions: 50, deletions: 0 },
      { file: 'login.ts', status: 'modified', additions: 10, deletions: 5 },
      { file: 'old.ts', status: 'deleted', additions: 0, deletions: 20 },
    ],
    commits: [
      { hash: 'abc1234', subject: 'feat: add auth', author: 'Test', date: '2026-01-01' },
    ],
    totalAdditions: 60,
    totalDeletions: 25,
    filesChanged: 3,
    base: 'main',
    head: 'feature',
  };

  it('includes summary section', () => {
    const md = formatMarkdown(samplePR);
    assert.ok(md.includes('## Summary'));
    assert.ok(md.includes('Add JWT authentication'));
  });

  it('includes changes section with status icons', () => {
    const md = formatMarkdown(samplePR);
    assert.ok(md.includes('## Changes'));
    assert.ok(md.includes('auth.ts'));
    assert.ok(md.includes('🆕'));
    assert.ok(md.includes('🗑️'));
  });

  it('includes commits section', () => {
    const md = formatMarkdown(samplePR);
    assert.ok(md.includes('## Commits'));
    assert.ok(md.includes('abc1234'));
  });

  it('includes stats when requested', () => {
    const md = formatMarkdown(samplePR, { stats: true });
    assert.ok(md.includes('## Stats'));
    assert.ok(md.includes('Files changed: 3'));
  });

  it('omits stats by default', () => {
    const md = formatMarkdown(samplePR);
    assert.ok(!md.includes('## Stats'));
  });

  it('handles empty changes and commits', () => {
    const emptyPR: PRDescription = {
      title: 'no changes',
      summary: 'No changes detected.',
      changes: [],
      commits: [],
      totalAdditions: 0,
      totalDeletions: 0,
      filesChanged: 0,
      base: 'main',
      head: 'HEAD',
    };
    const md = formatMarkdown(emptyPR);
    assert.ok(md.includes('## Summary'));
    assert.ok(!md.includes('## Changes'));
  });
});

describe('formatJson', () => {
  it('produces valid JSON with expected fields', () => {
    const pr: PRDescription = {
      title: 'test',
      summary: 'test summary',
      changes: [],
      commits: [],
      totalAdditions: 0,
      totalDeletions: 0,
      filesChanged: 0,
      base: 'main',
      head: 'HEAD',
    };
    const json = formatJson(pr);
    const parsed = JSON.parse(json);
    assert.equal(parsed.title, 'test');
    assert.equal(parsed.base, 'main');
  });
});

describe('formatText', () => {
  it('produces readable text output', () => {
    const pr: PRDescription = {
      title: 'feat: add stuff',
      summary: 'Added stuff',
      changes: [
        { file: 'a.ts', status: 'added', additions: 10, deletions: 0 },
      ],
      commits: [
        { hash: 'abcd123', subject: 'feat: add stuff', author: 'Test', date: '2026-01-01' },
      ],
      totalAdditions: 10,
      totalDeletions: 0,
      filesChanged: 1,
      base: 'main',
      head: 'HEAD',
    };
    const text = formatText(pr);
    assert.ok(text.includes('Title: feat: add stuff'));
    assert.ok(text.includes('[added] a.ts'));
    assert.ok(text.includes('abcd123'));
  });
});
