"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_js_1 = require("../index.js");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function makeTempRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prbody-test-'));
    (0, child_process_1.execSync)('git init -b main', { cwd: dir });
    (0, child_process_1.execSync)('git config user.email test@test.com', { cwd: dir });
    (0, child_process_1.execSync)('git config user.name Test', { cwd: dir });
    return dir;
}
function commit(cwd, msg, files) {
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(cwd, name), content);
        (0, child_process_1.execSync)(`git add ${name}`, { cwd });
    }
    (0, child_process_1.execSync)(`git commit -m "${msg}"`, { cwd });
}
(0, node_test_1.describe)('generate', () => {
    (0, node_test_1.it)('detects changes between base and head', async () => {
        const cwd = makeTempRepo();
        commit(cwd, 'initial', { 'a.txt': 'hello' });
        (0, child_process_1.execSync)('git checkout -b feature', { cwd });
        commit(cwd, 'feat: add auth', { 'auth.ts': 'export function auth() {}' });
        commit(cwd, 'fix: typo', { 'a.txt': 'hello world' });
        const pr = await (0, index_js_1.generate)({ base: 'main', head: 'feature', cwd });
        strict_1.default.equal(pr.commits.length, 2);
        strict_1.default.equal(pr.filesChanged, 2);
        strict_1.default.ok(pr.totalAdditions > 0);
        strict_1.default.ok(pr.summary.length > 0);
    });
    (0, node_test_1.it)('handles no changes', async () => {
        const cwd = makeTempRepo();
        commit(cwd, 'initial', { 'a.txt': 'hello' });
        (0, child_process_1.execSync)('git checkout -b same', { cwd });
        const pr = await (0, index_js_1.generate)({ base: 'main', head: 'same', cwd });
        strict_1.default.equal(pr.filesChanged, 0);
        strict_1.default.equal(pr.commits.length, 0);
    });
    (0, node_test_1.it)('detects file additions and deletions', async () => {
        const cwd = makeTempRepo();
        commit(cwd, 'initial', { 'keep.txt': 'stay', 'remove.txt': 'bye' });
        (0, child_process_1.execSync)('git checkout -b changes', { cwd });
        fs.writeFileSync(path.join(cwd, 'new.txt'), 'fresh');
        fs.unlinkSync(path.join(cwd, 'remove.txt'));
        (0, child_process_1.execSync)('git add -A', { cwd });
        (0, child_process_1.execSync)('git commit -m "swap files"', { cwd });
        const pr = await (0, index_js_1.generate)({ base: 'main', head: 'changes', cwd });
        strict_1.default.ok(pr.changes.some((c) => c.file === 'new.txt'));
        strict_1.default.ok(pr.changes.some((c) => c.file === 'remove.txt'));
    });
    (0, node_test_1.it)('generates summary from conventional commits', async () => {
        const cwd = makeTempRepo();
        commit(cwd, 'initial', { 'a.txt': 'hello' });
        (0, child_process_1.execSync)('git checkout -b feat', { cwd });
        commit(cwd, 'feat(auth): add JWT middleware', { 'jwt.ts': 'export {}' });
        commit(cwd, 'feat(auth): add login route', { 'login.ts': 'export {}' });
        const pr = await (0, index_js_1.generate)({ base: 'main', head: 'feat', cwd });
        strict_1.default.ok(pr.summary.includes('auth'));
        strict_1.default.ok(pr.commits.length === 2);
    });
    (0, node_test_1.it)('uses custom maxFiles and maxCommits', async () => {
        const cwd = makeTempRepo();
        commit(cwd, 'initial', { 'a.txt': 'hello' });
        (0, child_process_1.execSync)('git checkout -b big', { cwd });
        for (let i = 0; i < 5; i++) {
            commit(cwd, `commit ${i}`, { [`file${i}.txt`]: `content ${i}` });
        }
        const pr = await (0, index_js_1.generate)({ base: 'main', head: 'big', cwd, maxFiles: 2, maxCommits: 2 });
        strict_1.default.ok(pr.changes.length <= 2);
        strict_1.default.ok(pr.commits.length <= 2);
        strict_1.default.equal(pr.filesChanged, 5); // total unchanged
    });
});
(0, node_test_1.describe)('formatMarkdown', () => {
    const samplePR = {
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
    (0, node_test_1.it)('includes summary section', () => {
        const md = (0, index_js_1.formatMarkdown)(samplePR);
        strict_1.default.ok(md.includes('## Summary'));
        strict_1.default.ok(md.includes('Add JWT authentication'));
    });
    (0, node_test_1.it)('includes changes section with status icons', () => {
        const md = (0, index_js_1.formatMarkdown)(samplePR);
        strict_1.default.ok(md.includes('## Changes'));
        strict_1.default.ok(md.includes('auth.ts'));
        strict_1.default.ok(md.includes('🆕'));
        strict_1.default.ok(md.includes('🗑️'));
    });
    (0, node_test_1.it)('includes commits section', () => {
        const md = (0, index_js_1.formatMarkdown)(samplePR);
        strict_1.default.ok(md.includes('## Commits'));
        strict_1.default.ok(md.includes('abc1234'));
    });
    (0, node_test_1.it)('includes stats when requested', () => {
        const md = (0, index_js_1.formatMarkdown)(samplePR, { stats: true });
        strict_1.default.ok(md.includes('## Stats'));
        strict_1.default.ok(md.includes('Files changed: 3'));
    });
    (0, node_test_1.it)('omits stats by default', () => {
        const md = (0, index_js_1.formatMarkdown)(samplePR);
        strict_1.default.ok(!md.includes('## Stats'));
    });
    (0, node_test_1.it)('handles empty changes and commits', () => {
        const emptyPR = {
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
        const md = (0, index_js_1.formatMarkdown)(emptyPR);
        strict_1.default.ok(md.includes('## Summary'));
        strict_1.default.ok(!md.includes('## Changes'));
    });
});
(0, node_test_1.describe)('formatJson', () => {
    (0, node_test_1.it)('produces valid JSON with expected fields', () => {
        const pr = {
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
        const json = (0, index_js_1.formatJson)(pr);
        const parsed = JSON.parse(json);
        strict_1.default.equal(parsed.title, 'test');
        strict_1.default.equal(parsed.base, 'main');
    });
});
(0, node_test_1.describe)('formatText', () => {
    (0, node_test_1.it)('produces readable text output', () => {
        const pr = {
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
        const text = (0, index_js_1.formatText)(pr);
        strict_1.default.ok(text.includes('Title: feat: add stuff'));
        strict_1.default.ok(text.includes('[added] a.ts'));
        strict_1.default.ok(text.includes('abcd123'));
    });
});
