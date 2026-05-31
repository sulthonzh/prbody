# prbody

Auto-generate PR descriptions from git diffs and commits. No AI needed — just structured summaries of what actually changed.

## Why

Writing PR descriptions is tedious. You either write nothing, or spend 10 minutes crafting something nobody reads. `prbody` gives you a solid middle ground — a structured, informative description generated from your actual changes.

## Install

```bash
npm install -g prbody
```

## Usage

```bash
# Auto-detect base branch (main/master) and generate
prbody

# Specify base and head
prbody --base main --head feature/auth

# Generate and copy to clipboard
prbody --copy

# Output as JSON
prbody --json

# Include file stats
prbody --stats

# Custom template
prbody --template ./my-template.md
```

## What it generates

```
## Summary

Add JWT authentication middleware and login/signup endpoints.

## Changes

- **auth.ts**: Add JWT token generation and verification
- **middleware.ts**: Add auth middleware for protected routes
- **routes.ts**: Add /login and /signup endpoints
- **users.ts**: Add password hashing with bcrypt

## Commits (4)

- feat: add JWT token generation (a1b2c3d)
- feat: add auth middleware (e4f5g6h)
- feat: add login/signup routes (i7j8k9l)
- chore: add bcrypt dependency (m0n1o2p)

## Stats

Files changed: 4 | Additions: +187 | Deletions: -12
```

## API

```js
import { generate, formatMarkdown, formatJson } from 'prbody';

const result = await generate({ base: 'main', head: 'feature/auth' });
console.log(formatMarkdown(result));
```

## License

MIT
