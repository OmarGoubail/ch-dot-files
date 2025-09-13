# Chezmoi Context for AI Agents

## Overview
This repository manages dotfiles using chezmoi, a cross-platform dotfile manager that handles machine-specific differences through templating.

## Key Concepts

### Directory Structure
- **Source directory**: `~/.local/share/chezmoi/` (this directory)
- **Target directory**: `~/` (user's home directory)
- **Config directory**: `~/.config/chezmoi/`

### File Naming Convention
- `dot_config/` → `~/.config/`
- `dot_gitconfig` → `~/.gitconfig`
- `private_` prefix → sets directory permissions to 700
- `.tmpl` suffix → template file processed before applying

### Templates
Chezmoi uses Go's text/template syntax for handling OS and machine differences:
```go
{{- if eq .chezmoi.os "darwin" }}
# macOS specific content
{{- else if eq .chezmoi.os "linux" }}
# Linux specific content
{{- end }}
```

### Common Variables
- `.chezmoi.os`: Operating system ("darwin", "linux", "windows")
- `.chezmoi.hostname`: Machine hostname
- `.chezmoi.username`: Current username
- Custom variables defined in `~/.config/chezmoi/chezmoi.toml`

## Workflow Commands

### Daily Operations
- `chezmoi add <file>`: Add a file from home directory
- `chezmoi add --template <file>`: Add as template
- `chezmoi edit <file>`: Edit managed file
- `chezmoi diff`: Preview changes before applying
- `chezmoi apply`: Apply changes to home directory
- `chezmoi update`: Pull latest changes and apply

### Template Management
- Convert existing file to template: `chezmoi add --template <file>`
- Templates are stored with `.tmpl` extension
- Edit templates directly in this source directory
- Apply templates with `chezmoi apply`

## Current Status
- Recently migrated from GNU Stow
- Configs support both Linux and macOS environments
- Secrets need to be moved to template variables
- Git repository not yet initialized

## Next Steps
1. Convert OS-specific configs to templates (especially fish, btop)
2. Handle secrets using template variables
3. Initialize git repository
4. Set up GitHub remote
5. Test on macOS with `chezmoi init --apply <github-username>`

## Important Notes
- Never edit files in home directory directly - use `chezmoi edit` or edit source files here
- Always run `chezmoi diff` before `chezmoi apply` to preview changes
- Files in source use special naming (dot_, private_, .tmpl)
- Chezmoi only manages files it knows about - other files remain untouched