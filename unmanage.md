Here are the ways to unmanage files in chezmoi:

  1. Remove from chezmoi entirely

  chezmoi forget ~/.config/fish/fish_plugins
  This removes the file from chezmoi management but leaves the actual file in your home directory untouched.

  2. Use .chezmoiignore for patterns

  Create ~/.local/share/chezmoi/.chezmoiignore:
  # Ignore fish plugins that get auto-installed
  .config/fish/fish_plugins
  .config/fish/completions/*

  # Ignore tmux plugin directories
  .config/tmux/plugins/*

  # Ignore all backup files
  **/*.backup
  **/*.bak

  3. See what's currently unmanaged

  chezmoi unmanaged
  Shows files in your home directory that aren't managed by chezmoi.

  4. Remove directories from management

  chezmoi forget ~/.config/tmux/plugins

  5. Check what would be removed

  chezmoi managed | grep fish_plugins

  Example for your case:

  If you want to unmanage fish plugins that get auto-installed:

  # Remove fish_plugins from management
  chezmoi forget ~/.config/fish/fish_plugins

  # Or add to .chezmoiignore to prevent re-adding
  echo ".config/fish/fish_plugins" >> ~/.local/share/chezmoi/.chezmoiignore

  The .chezmoiignore approach is better for things that get auto-generated/installed, since it prevents
  accidentally re-adding them later.
