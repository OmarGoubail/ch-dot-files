---

name: jj-vcs

description: Comprehensive guide to Jujutsu (jj) version control system for parallel development, stacked branches, and team collaboration. Activate when the user mentions jj, jujutsu, or when working in a repository with a .jj directory. Covers advanced workflows including mega-merges, agent-parallel development, first-class conflicts, and recovery operations.
allowed-tools: Bash(jj *), Read(*), Grep(*)
compatibility: opencode
metadata:
  audience: engineers
  workflow: version-control

---

# Jujutsu (jj) Version Control System - Complete Guide

**Comprehensive skill for Jujutsu v0.26+** covering basic workflows through advanced parallel development patterns.

## Critical: Agent Environment Rules

When running as an automated agent:

1. **ALWAYS use `-m` flags** to avoid editor prompts:

```bash
# CORRECT - inline message
jj desc -m "Add user authentication"
jj squash -m "Fix typo"
jj new -m "Next feature"

# WRONG - opens editor, will hang
jj desc
jj squash
jj new
```

2. **NEVER use interactive flags** (`-i`, `--interactive`):

```bash
# WRONG - hangs in agent environment
jj squash -i
jj split -i
jj resolve

# CORRECT - non-interactive alternatives
jj squash
jj split
# Edit conflict files directly, then verify with jj st
```

3. **Verify with `jj st`** after every mutation to confirm state.

---

## Core Mental Model

### Changes vs Commits

**Change**: The fundamental unit of work with a **stable ID** (e.g., `kntqzsqt`). Changes persist across rewrites (amend, rebase) and can be edited at any time.

**Commit**: A specific snapshot with a SHA hash. Changes when content changes.

```
Git:  Commit A (abc123) → amended → Commit A' (def456) [NEW SHA]
jj:   Change A (kntqzsqt) → amended → Change A (kntqzsqt) [SAME ID]
      Commit ID changes: abc123 → def456
```

### Working Copy (@)

**Your working directory IS a commit** (`@`). Files are automatically snapshotted. No staging area.

```bash
# Edit files - they're already "committed" to @
echo "code" > file.txt
jj st
# Working copy (@): kntqzsqt (auto-snapshotted)
```

### Key Differences from Traditional VCS

| Concept | Traditional | jj |
|---------|-------------|-----|
| Working directory | Untracked changes | Is commit `@` |
| Staging area | `git add` required | Automatic, none |
| Commits | Immutable | Mutable, editable anytime |
| History rewrite | Dangerous, complex | Safe, automatic descendant rebasing |
| Conflicts | Block workflow | First-class, can be committed |
| Branches | Auto-move | Bookmarks don't auto-move |
| Anonymous work | Detached HEAD warning | Normal, first-class |

---

## Essential Daily Commands

### Status and History

```bash
# Check current state (USE THIS, not git status)
jj st

# View change graph
jj log
jj log -r 'main..@'     # Your work not in main
jj log -r 'mine()'      # Only your changes

# View specific change
jj show <change-id>
jj diff                 # Working copy changes
```

### Creating and Navigating Changes

```bash
# Create new empty change (finalizes current, starts fresh)
jj new
jj new -m "Add payment processing"    # With message
jj new main -m "Feature from main"      # From specific point

# Describe current change (optional, anytime)
jj desc -m "Better authentication flow"

# Navigate between changes
jj edit <change-id>     # Jump to specific change
jj edit @-              # Parent
jj edit @+              # Child
jj edit @--3            # 3 parents back
jj prev                 # Move to parent
jj next                 # Move to child
```

### Modifying History

```bash
# Edit past change - descendants auto-rebase!
jj edit kntqzsqt
# Make changes...
jj squash               # Amends kntqzsqt, descendants follow

# Squash current into parent
jj squash
jj squash -m "Combined message"

# Split a change
jj split
jj split file1.txt file2.txt

# Rebase and descendants auto-rebase
jj rebase -s <change> -d <destination>
jj rebase -b <bookmark> -d main

# Abandon (delete) a change
jj abandon <change-id>
```

### Recovery

```bash
# Undo last operation
jj undo

# View operation history
jj op log
jj op log -p

# Restore to specific operation
jj op restore <operation-id>

# See how a change evolved
jj evolog -r <change-id>
```

---

## Parallel Development Workflows

### The Mega-Merge Pattern

**Use case**: Work on multiple independent features simultaneously, test integration before pushing.

```bash
# Create independent features
jj new main -m "Feature A: Database schema"
jj bookmark create feature-a

jj new main -m "Feature B: API endpoints"
jj bookmark create feature-b

jj new main -m "Feature C: Frontend components"
jj bookmark create feature-c

# Create integration workspace
jj new feature-a feature-b feature-c -m "Integration: test all features"
jj new -m "Integration testing work"

# Now you're on top of ALL features combined
# Test if they work together
# Conflicts? They're stored, you keep working!
```

**Tree view:**

```
@  Integration testing work
◉  Integration: test all features
├─┬─┬─╮
│ │ │ ◉  Feature C
│ │ ◉  Feature B
│ ◉  Feature A
├─┴─┴─╯
◉  main
```

### Agent-Parallel Workflow

**Use case**: Multiple AI agents working on same codebase without conflicts.

```bash
# Agent 1: Database work
jj new main -m "AGENT-1: Setup auth tables"
jj bookmark create agent1-db

# Agent 2: API work (simultaneously, same parent)
jj new main -m "AGENT-2: Create login endpoint"
jj bookmark create agent2-api

# Agent 3: Tests (simultaneously)
jj new main -m "AGENT-3: Add auth tests"
jj bookmark create agent3-tests

# You: Integration merge
jj new agent1-db agent2-api agent3-tests -m "INTEGRATE: Test all agent work"

# Test integration. If conflicts exist, they're stored in the merge commit!
# You keep working, resolve when ready.
```

### Auto-Distribute Changes with `jj absorb`

When you have mixed changes in working copy:

```bash
# Working copy has changes for multiple parent features
jj absorb

# Automatically moves each change to the commit that last touched those lines
# If ambiguous, change stays in working copy (safe)

# Absorb specific files only
jj absorb -- file1.txt file2.txt
```

---

## Team Collaboration Workflows

### The Dev Branch Hub Pattern

**Essential for large teams.** Creates a local buffer between your work and main.

```bash
# Create your local dev hub
jj new main -m "(empty) dev branch"
jj bookmark create dev

# Branch ALL work from dev, not main
jj new dev -m "Feature: Payment processing"
jj bookmark create feature-payment

jj new dev -m "Feature: User dashboard"
jj bookmark create feature-dashboard

jj new dev -m "Bugfix: Login error"
jj bookmark create fix-login
```

**When teammates land PRs on main:**

```bash
# Fetch updates
jj git fetch

# Rebase dev onto new main ONCE
jj rebase -s dev -d main@origin

# If conflicts, fix ONCE in dev
jj edit dev
# Resolve...
jj squash

# ALL features (payment, dashboard, fix-login) automatically have the fix!
# Because they're descendants of dev.
```

### Stacked PRs Workflow

```bash
# Create dependent changes
jj new main -m "Part 1: Database migration"
jj bookmark create part-1

jj new -m "Part 2: API endpoints"
jj bookmark create part-2

jj new -m "Part 3: Frontend integration"
jj bookmark create part-3

# Push entire stack
jj git push --bookmark 'glob:part-*'

# Reviewer wants changes to Part 2?
jj edit part-2
# Make changes...
jj squash
# Part 3 automatically rebased on top!
jj git push --bookmark 'glob:part-*'
```

### Syncing with Teammates

```bash
# Fetch all remote changes
jj git fetch

# See what teammates landed
jj log -r 'main@origin..main'

# Track teammate's branch for review
jj bookmark track feature-auth --remote=origin
jj git fetch

# Create review workspace
jj workspace add ../review-auth
cd ../review-auth
jj new feature-auth@origin -m "Review auth feature"
```

### Pushing to Remote

```bash
# Push specific bookmark
jj git push --bookmark feature-x

# Push all bookmarks matching pattern
jj git push --bookmark 'glob:feature-*'

# Push change (auto-creates branch name)
jj git push --change kntqzsqt

# Push all tracked bookmarks
jj git push --tracked
```

**CRITICAL**: Bookmarks don't auto-move. Update before pushing:

```bash
jj bookmark move feature-x --to @
jj git push --bookmark feature-x
```

---

## Conflict Resolution

### First-Class Conflicts

In jj, **conflicts don't block workflow**. They are stored as data in commits.

```bash
# Rebase creates conflicts? No problem!
jj rebase -s feature -d main
# Operation SUCCEEDS, conflicts stored in commit

jj log
# Shows: xyz (conflict) Feature work

# Continue working, resolve later!
jj new xyz -m "Continue despite conflicts"
```

### Resolution Workflow (Non-Interactive)

```bash
# 1. Create working copy on conflicted commit
jj new <conflicted-change>

# 2. View conflict markers (example "diff" style):
cat file.ex
# <<<<<<< conflict 1 of 1
# %%%%%%% diff from: base_commit
# \       to: side_a_commit
# -base_content
# +side_a_changes
# +++++++ side_b_commit
# side_b_content
# >>>>>>> conflict 1 of 1 ends

# 3. Resolve by editing files directly (no jj resolve - it's interactive)
vim file.ex
# Remove markers, keep correct content

# 4. Verify resolution
jj st
jj diff

# 5. Move resolution into conflicted commit
jj squash

# 6. Descendants automatically get resolved state!
```

### Deferred Resolution

```bash
# Rebase entire stack - some have conflicts
jj rebase -s 'all:roots(main..@)' -d main

# Work on non-conflicted changes
jj new <non-conflicted-change>
# ... keep working ...

# Later, fix conflicts:
jj edit <conflicted-change>
# Resolve...
jj squash
```

---

## Advanced Revsets

Revsets are jj's query language for selecting changes.

### Basic Operators

| Expression | Selects |
|------------|---------|
| `@` | Working copy |
| `@-` | Parent |
| `@+` | Child |
| `::@` | All ancestors of @ |
| `@::` | All descendants of @ |
| `main..@` | Commits not in main (your work) |
| `main::@` | DAG range between main and @ |
| `~main` | Everything except main |
| `x & y` | Intersection |
| `x \| y` | Union |
| `x ~ y` | Difference |

### Functions

```bash
# Filtering
mine()                    # Your authored commits
files(path)               # Commits touching path
description(pattern)      # Commits with matching message
author(pattern)           # By author
committer_date(after:"1 week ago")  # Recent commits
empty()                   # Empty commits
conflicts()               # Conflicts with conflicts

# Navigation
ancestors(x)              # All ancestors
descendants(x)            # All descendants
heads(x)                  # Tips of x
roots(x)                  # Roots of x
parents(x)                # Direct parents
children(x)               # Direct children
latest(x, 5)              # Latest 5

# Special
all()                     # All visible commits
root()                    # Virtual root
main@origin               # Remote bookmark
trunk()                   # Default trunk
```

### Common Queries

```bash
# Your work not in main
jj log -r 'mine() & main..@'

# Commits touching auth code
jj log -r 'files(lib/auth)'

# Your recent changes
jj log -r 'mine() & committer_date(after:"3 days ago")'

# Everything except tags and main
jj log -r 'all() ~ (tags() | main)'

# Ancestors of both feature-a and feature-b (common history)
jj log -r '::feature-a & ::feature-b'
```

### The `all:` Prefix

When a revset might resolve to multiple commits:

```bash
# Without all: - fails if multiple matches
jj rebase -s 'roots(main..@)' -d main  # ERROR

# With all: - expects multiple, works correctly
jj rebase -s 'all:roots(main..@)' -d main  # SUCCESS
```

---

## Configuration

### User Settings

```bash
# Identity
jj config set --user user.name "Agent Name"
jj config set --user user.email "agent@system.local"

# Editor (always use one that works non-interactively)
jj config set --user ui.editor "code --wait"

# Default log view
jj config set --user revsets.log "@ | ancestors(immutable_heads().., 2) | present(trunk())"
```

### Aliases

```toml
# ~/.config/jj/config.toml
[aliases]
# Shortcuts
st = ["status"]
lg = ["log"]
desc = ["describe"]

# Workflows
tug = ["bookmark", "move", "--from", "closest_bookmark(@-)", "--to", "@-"]
retrunk = ["rebase", "-d", "trunk()"]
sync = ["git", "fetch"]
push-all = ["git", "push", "--bookmark", "glob:feature-*"]
stack = ["log", "-r", "stack()"]
my-work = ["log", "-r", "mine() & main..@"]
```

### Revset Aliases

```toml
[revset-aliases]
# Your identity
'mine()' = 'author("Agent Name")'
'my-work' = 'mutable() & mine()'

# Stacks
'stack(x)' = 'x | ancestors(descendants(immutable_heads()..x), 2)'
'stack()' = 'stack(@)'

# Integration helpers
'unpushed(x)' = '::x & ~reachable(::x, remote_bookmarks())'
'wip' = 'description(regex:"^(wip|todo|fixme):?")'
'closest_bookmark(to)' = 'heads(::to & bookmarks())'

# Recent work
'recent()' = 'mine() & committer_date(after:"1 week ago")'
```

---

## Large Codebase Optimization

### Performance Settings

```toml
# ~/.config/jj/config.toml
[snapshot]
# Don't auto-track new files (faster in huge repos)
auto-track = "none()"

# Limit file size
max-new-file-size = "1MiB"

[revsets]
# Limit default log scope
log = "main..@"

# Prioritize short prefixes for your work
short-prefixes = "(main..@)::"
```

### Workflow Adjustments

```bash
# Manually track only what you need
jj file track lib/feature/*.ex

# Use sparse checkout if needed
jj sparse set --add lib/

# Ignore working copy for read-only operations (faster)
jj --ignore-working-copy log
```

---

## Troubleshooting

### Git Tools Show Different State

**Expected in colocation.** jj and Git have separate views. Trust `jj st` and `jj log`.

```bash
# Sync to Git if needed
jj git export
```

### Divergent Change

Same change ID has multiple commits (concurrent edits).

```bash
jj st  # Shows warning
jj log -r 'divergent()'  # See them

# Abandon unwanted version
jj abandon <change-id>/1
# Keep /0 (current)
```

### Bookmark Shows Asterisk (*)

Bookmark diverged from remote.

```bash
jj git fetch
jj new main main@origin -m "Merge remote"
# OR rebase:
jj rebase -s my-bookmark -d main@origin
```

### Stale Working Copy

Workspace modified from elsewhere.

```bash
jj st  # Shows warning
jj workspace update-stale
```

### Slow Operations

```bash
# Disable colocation if not needed
jj git colocation disable

# Use filesystem monitor
[filesystem-monitor]
watchman = true
```

---

## Quick Reference

### Command Cheat Sheet

| Task | Command |
|------|---------|
| Check status | `jj st` |
| View history | `jj log` |
| View your work | `jj log -r 'main..@'` |
| New change | `jj new -m "message"` |
| Describe change | `jj desc -m "message"` |
| Edit change | `jj edit <id>` |
| Move to parent | `jj prev` or `jj edit @-` |
| Move to child | `jj next` or `jj edit @+` |
| Squash into parent | `jj squash` |
| Split change | `jj split` |
| Rebase | `jj rebase -s <src> -d <dst>` |
| Abandon | `jj abandon <id>` |
| Undo | `jj undo` |
| Absorb changes | `jj absorb` |
| Create bookmark | `jj bookmark create <name>` |
| Move bookmark | `jj bookmark move <name> --to @` |
| Push | `jj git push --bookmark <name>` |
| Fetch | `jj git fetch` |

### Revset Quick Reference

| Expression | Meaning |
|------------|---------|
| `@` | Working copy |
| `@-` | Parent |
| `::@` | All ancestors |
| `main..@` | Your work not in main |
| `mine()` | Your authored commits |
| `files(path)` | Commits touching path |
| `root()` | Virtual root commit |
| `all()` | All visible commits |

---

## Best Practices Summary

1. **Always use `jj st`** as your source of truth (ignore Git tools in colocation)
2. **Use `-m` flags** to avoid interactive prompts in agent environment
3. **Describe before coding** (optional but recommended): `jj desc -m "intent"`
4. **Create parallel changes** with `jj new <same-parent>` for independent work
5. **Use mega-merge** (`jj new feature-a feature-b`) to test integration
6. **Use dev branch hub** for team workflows to minimize rebase conflicts
7. **Don't fear conflicts** - they're first-class, resolve when ready
8. **Use `jj absorb`** to auto-distribute changes to appropriate commits
9. **Fix conflicts once** in a stacked change - descendants auto-get the fix
10. **Use `jj undo`** liberally - operation log is your safety net
11. **Update bookmarks** before pushing: `jj bookmark move <name> --to @`
12. **Work with change IDs** - they're stable across rewrites

---

## Resources

- **Official Docs**: <https://jj-vcs.github.io/jj/latest/>
- **Tutorial**: <https://steveklabnik.github.io/jujutsu-tutorial/>
- **Git Comparison**: <https://docs.jj-vcs.dev/latest/git-comparison/>
- **Community**: <https://github.com/jj-vcs/jj/discussions>
