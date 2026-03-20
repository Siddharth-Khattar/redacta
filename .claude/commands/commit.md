---
name: commit
description: Create an appropriate commit message
---

<objective>
Check git file status to understand the changes and provide an appropriately succinct commit messages WITHOUT co-athor signature. Ask user if you can commit and commit on their approval.
</objective>

<process>

First, run the tests for both the frontend and backend and fix any problems till the tests pass - DO NOT change the tests as a shortcut to avoid the core problem fix. Only change them if it truly makes business sense to do so.

Then navigate to `/Users/siddharth/Development/Hackathons/Google_Agents_Hack_2026/panacea` and run the command `make format`.

Then check the lint problems that might need a forceful lint fix by using `cd /Users/siddharth/Development/Hackathons/Google_Agents_Hack_2026/panacea/backend && bunx biome check .` and `cd /Users/siddharth/Development/Hackathons/Google_Agents_Hack_2026/panacea/backend && source .venv/bin/activate && uv run ruff check .`

Then fix any errors or issues.

Run `git status` to understand the changes, staged or unstaged.

Understand the scope, content and size of the staged/unstaged files and divide the commit into meaningfully segrated commits with appropriate messages.

Output the commit messages following this format:

```
<type>: <description>
<most important extra detail points if needed, or if commit too big>
```

Then ask the user for approval to commit. Upon confirmation, do the commits logically as they build up with the exact messages you generated. Make changes if the user demands something and repeat the approval loop.

If linter (ruff/pyright/biome/npx) returns any errors or warnings, fix it in a robust, production grade, long term manner. NO shortcuts or quickfixes. Check the specifics of this setup from ../../CLAUDE.md


**Types:** feat, fix, docs, style, refactor, test, chore

**Rules:**
- Main message - One line, max 72 characters
- Imperative mood ("add" not "added")
- No period at end
- Never any co-author

</process>