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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = generate;
exports.formatMarkdown = formatMarkdown;
exports.formatJson = formatJson;
exports.formatText = formatText;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
function runGit(args, cwd) {
    try {
        return (0, child_process_1.execSync)(`git ${args}`, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).trim();
    }
    catch {
        return '';
    }
}
function detectBaseBranch(cwd) {
    // Try common base branches
    for (const branch of ['main', 'master', 'develop', 'dev']) {
        const result = runGit(`rev-parse --verify ${branch}`, cwd);
        if (result)
            return branch;
    }
    return 'main';
}
function parseDiffNumStat(output) {
    if (!output)
        return [];
    return output.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^(\d+)\t(\d+)\t(.+)$/);
        if (!match)
            return null;
        const [, add, del, file] = match;
        const additions = parseInt(add, 10);
        const deletions = parseInt(del, 10);
        let status = 'modified';
        let actualFile = file;
        let oldFile;
        if (file.includes('=>')) {
            // rename pattern: old => new
            const renameMatch = file.match(/^{?(.+?)\s*=>\s*(.+?)}?$/);
            if (renameMatch) {
                oldFile = renameMatch[1];
                actualFile = renameMatch[2];
                status = 'renamed';
            }
        }
        if (additions > 0 && deletions === 0)
            status = 'added';
        if (deletions > 0 && additions === 0 && status !== 'renamed')
            status = 'deleted';
        return { file: actualFile, status, additions, deletions, oldFile };
    }).filter(Boolean);
}
function parseLog(output) {
    if (!output)
        return [];
    return output.split('\n').filter(Boolean).map(line => {
        const [hash, subject, author, date] = line.split('|||');
        return { hash: hash.substring(0, 7), subject, author, date };
    });
}
function generateSummary(commits, changes) {
    if (commits.length === 0 && changes.length === 0) {
        return 'No changes detected.';
    }
    const subjects = commits.map(c => c.subject);
    const types = subjects.map(s => {
        const match = s.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
        return match ? { type: match[1], scope: match[2] || '', desc: match[3] } : null;
    }).filter(Boolean);
    if (types.length > 0) {
        const scopes = [...new Set(types.map(t => t.scope).filter(Boolean))];
        const mainDesc = types[0]?.desc || subjects[0] || 'Update code';
        if (scopes.length === 1) {
            return `${capitalize(mainDesc)} (${scopes[0]}).`;
        }
        if (scopes.length > 1) {
            return `${capitalize(mainDesc)}. Affects: ${scopes.join(', ')}.`;
        }
        return `${capitalize(mainDesc)}.`;
    }
    if (subjects.length > 0) {
        return `${capitalize(subjects[0])}${subjects.length > 1 ? ` and ${subjects.length - 1} more change${subjects.length > 2 ? 's' : ''}` : ''}.`;
    }
    return `${changes.length} file${changes.length > 1 ? 's' : ''} changed.`;
}
function capitalize(s) {
    if (!s)
        return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function categorizeFile(file) {
    const ext = path.extname(file).toLowerCase();
    const dir = path.dirname(file);
    const basename = path.basename(file);
    if (basename === 'package.json' || basename === 'package-lock.json')
        return 'Dependencies';
    if (dir.includes('test') || dir.includes('__test') || dir.includes('spec'))
        return 'Tests';
    if (dir.includes('doc') || ext === '.md')
        return 'Documentation';
    if (ext === '.css' || ext === '.scss' || ext === '.less')
        return 'Styles';
    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx')
        return 'Source';
    if (ext === '.json' || ext === '.yaml' || ext === '.yml')
        return 'Config';
    if (ext === '.sh' || basename === 'Dockerfile' || basename === 'Makefile')
        return 'Infra';
    return 'Other';
}
async function generate(options = {}) {
    const cwd = options.cwd || process.cwd();
    const base = options.base || detectBaseBranch(cwd);
    const head = options.head || 'HEAD';
    const maxFiles = options.maxFiles || 50;
    const maxCommits = options.maxCommits || 30;
    // Get diff stats
    const diffOutput = runGit(`diff --numstat ${base}..${head}`, cwd);
    const allChanges = parseDiffNumStat(diffOutput);
    const changes = allChanges.slice(0, maxFiles);
    // Get commit log
    const logOutput = runGit(`log --format="%h|||%s|||%an|||%ai" ${base}..${head}`, cwd);
    const allCommits = parseLog(logOutput);
    const commits = allCommits.slice(0, maxCommits);
    const totalAdditions = allChanges.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = allChanges.reduce((sum, c) => sum + c.deletions, 0);
    const title = commits.length > 0
        ? commits[0].subject
        : changes.length > 0
            ? `Update ${changes.length} file${changes.length > 1 ? 's' : ''}`
            : 'No changes';
    return {
        title,
        summary: generateSummary(commits, changes),
        changes,
        commits,
        totalAdditions,
        totalDeletions,
        filesChanged: allChanges.length,
        base,
        head,
    };
}
function formatMarkdown(pr, options = {}) {
    const lines = [];
    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(pr.summary);
    lines.push('');
    // Changes grouped by category
    if (pr.changes.length > 0) {
        lines.push('## Changes');
        lines.push('');
        const categories = new Map();
        for (const change of pr.changes) {
            const cat = categorizeFile(change.file);
            if (!categories.has(cat))
                categories.set(cat, []);
            categories.get(cat).push(change);
        }
        for (const [category, files] of categories) {
            lines.push(`**${category}**`);
            for (const f of files) {
                const statusIcon = f.status === 'added' ? '🆕' : f.status === 'deleted' ? '🗑️' : f.status === 'renamed' ? '📦' : '✏️';
                const suffix = f.status === 'renamed' && f.oldFile ? ` (from ${f.oldFile})` : '';
                lines.push(`- ${statusIcon} \`${f.file}\`${suffix}`);
            }
            lines.push('');
        }
    }
    // Commits
    if (pr.commits.length > 0) {
        lines.push(`## Commits (${pr.commits.length})`);
        lines.push('');
        for (const c of pr.commits) {
            lines.push(`- ${c.subject} (\`${c.hash}\`)`);
        }
        lines.push('');
    }
    // Stats
    if (options.stats) {
        lines.push('## Stats');
        lines.push('');
        lines.push(`Files changed: ${pr.filesChanged} | Additions: +${pr.totalAdditions} | Deletions: -${pr.totalDeletions}`);
        lines.push('');
    }
    return lines.join('\n').trim();
}
function formatJson(pr) {
    return JSON.stringify(pr, null, 2);
}
function formatText(pr) {
    const lines = [];
    lines.push(`Title: ${pr.title}`);
    lines.push(`Base: ${pr.base} → Head: ${pr.head}`);
    lines.push(`Summary: ${pr.summary}`);
    lines.push('');
    if (pr.changes.length > 0) {
        lines.push('Changes:');
        for (const c of pr.changes) {
            const status = c.status === 'renamed' && c.oldFile
                ? `${c.oldFile} → ${c.file}`
                : `[${c.status}] ${c.file}`;
            lines.push(`  ${status} (+${c.additions}/-${c.deletions})`);
        }
        lines.push('');
    }
    if (pr.commits.length > 0) {
        lines.push(`Commits (${pr.commits.length}):`);
        for (const c of pr.commits) {
            lines.push(`  ${c.hash} ${c.subject}`);
        }
        lines.push('');
    }
    lines.push(`Stats: ${pr.filesChanged} files, +${pr.totalAdditions}, -${pr.totalDeletions}`);
    return lines.join('\n');
}
