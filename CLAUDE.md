# Cred Vault — Claude Operating Manual

## Developer Brain

Developer Brain lives at: `/Users/rkhooda/Documents/Rkxee Obsidian/Developer's brain`

At the start of every session, read in this order:

1. `/Users/rkhooda/Documents/Rkxee Obsidian/Developer's brain/CLAUDE.md` — governing operating principles
2. `/Users/rkhooda/Documents/Rkxee Obsidian/Developer's brain/ARCHITECTURE.md` — zone structure and content boundaries
3. `/Users/rkhooda/Documents/Rkxee Obsidian/Developer's brain/projects/[project-name]/overview.md` — project context in Developer Brain (read if the file exists; skip if not)

The principles in Developer Brain govern every session in this repository. Do not duplicate them here. If anything here conflicts with Developer Brain, follow Developer Brain and flag the conflict.

---

## Project

**Name:** `CredVault`
*Must match the folder name at `Developer Brain/projects/[project-name]/`.*

**What it is:** [One sentence describing what this repository does.]

**Stack:** [Primary language, frameworks, key dependencies]

---

## Rules

[Project-specific rules only — what Claude needs to know about this codebase that is not covered by Developer Brain's operating principles. Examples: how to run tests, build commands, CI pipeline, deployment process, code style decisions specific to this project.]

*Remove this section if there is nothing project-specific to add.*

---

## Session End

At the end of any significant session:

1. Has the project's technical state changed substantially? → Update `Developer Brain path/projects/CredVault/overview.md`
2. Was a significant architectural decision made? → Create `Developer Brain path/projects/CredVault/decision-[topic].md`
3. Does any knowledge from this session pass the promotion criteria in `Developer Brain path/WORKFLOW.md`? → Promote it

Do not update Developer Brain for routine task completion or information visible from the code.