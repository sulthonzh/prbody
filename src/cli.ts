#!/usr/bin/env node
import { generate, formatMarkdown, formatJson, formatText } from './index';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(`
prbody — Auto-generate PR descriptions from git diffs

Usage:
  prbody [options]

Options:
  --base <branch>    Base branch (default: auto-detect main/master)
  --head <branch>    Head branch (default: HEAD)
  --json             Output as JSON
  --text             Output as plain text
  --stats            Include file stats in markdown
  --copy             Copy to clipboard (requires pbcopy/xclip)
  -h, --help         Show this help
  -v, --version      Show version

Examples:
  prbody                          # auto-detect base, generate markdown
  prbody --base main --json       # JSON output against main
  prbody --base develop --stats   # with stats against develop
`);
    process.exit(0);
  }

  if (hasFlag('--version') || hasFlag('-v')) {
    const pkg = require('../package.json');
    console.log(`prbody v${pkg.version}`);
    process.exit(0);
  }

  const base = getArg('--base');
  const head = getArg('--head');
  const json = hasFlag('--json');
  const text = hasFlag('--text');
  const stats = hasFlag('--stats');
  const copy = hasFlag('--copy');

  try {
    const result = await generate({ base, head });

    let output: string;
    if (json) {
      output = formatJson(result);
    } else if (text) {
      output = formatText(result);
    } else {
      output = formatMarkdown(result, { stats });
    }

    if (copy) {
      const { execSync } = require('child_process');
      const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip -selection clipboard';
      execSync(cmd, { input: output, encoding: 'utf-8' });
      console.log('Copied to clipboard!');
    } else {
      console.log(output);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
