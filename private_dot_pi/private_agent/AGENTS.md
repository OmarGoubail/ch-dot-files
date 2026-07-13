# Global Agent Instructions

At the start of each session, check if `notes.md` exists in the current directory. If it does, read it before doing anything else.

When you learn something worth remembering (a gotcha, a convention, a decision made), append it to `notes.md` in the current project directory. Format:

```
## YYYY-MM-DD | <topic>
- short note
```

Keep notes terse. One line per thing. No fluff.

`notes.md` should never ever be commited! it should only be in the working dir and should be left unstaged

When working on a Linear issue, always use Linear's `gitBranchName` exactly for the branch/PR branch when Linear provides one, unless the user explicitly asks for a different branch name. This keeps Linear issue-to-PR tracking intact.

Before changing or claiming something about a file, inspect the relevant source. Preserve unrelated user changes. After edits, inspect the diff and run the smallest relevant validation.
