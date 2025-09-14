if status is-interactive
    # Commands to run in interactive sessions can go here
    #fish_vi_key_bindings
    atuin init fish | source
end

# Detect OS
set -l os_name (uname -s)
set -l arch_name (uname -m)

# OS-specific configurations
switch $os_name
    case Darwin # macOS (M4 MacBook)
        # Set up Homebrew for Apple Silicon
        set -gx PATH /opt/homebrew/bin /opt/homebrew/sbin $PATH
        if test -f /opt/homebrew/bin/brew
            eval (/opt/homebrew/bin/brew shellenv)
        end

        if command -v zoxide >/dev/null
            zoxide init fish | source
        end

        # Java on macOS (if installed via Homebrew)
        if test -d /opt/homebrew/opt/openjdk
            set -x JAVA_HOME /opt/homebrew/opt/openjdk
            set -x PATH $JAVA_HOME/bin $PATH
        end

        # Browser (use system default)
        set -x BROWSER open

    case Linux # Arch Linux

        if command -v zoxide >/dev/null
            zoxide init fish | source
        end

        # Java
        if test -d /usr/lib/jvm/java-21-openjdk
            set -x JAVA_HOME /usr/lib/jvm/java-21-openjdk
            set -x PATH $JAVA_HOME/bin $PATH
        end

        # Browser
        if test -f /usr/bin/zen-browser
            set -x BROWSER /usr/bin/zen-browser
        end

        # Google Cloud SDK
        if test -f /home/$USER/stuff/dev/gcloud/google-cloud-sdk/path.fish.inc
            source /home/$USER/stuff/dev/gcloud/google-cloud-sdk/path.fish.inc
        end

        # Z exclude paths
        set -gx Z_EXCLUDE /home/$USER/stuff/dev/gcloud /home/$USER/stuff/dev/gcloud/google-cloud-sdk
end

# Universal configurations (work on both systems)
# Starship prompt
if command -v starship >/dev/null
end

# Volta
if test -d $HOME/.volta
    set -gx VOLTA_HOME $HOME/.volta
    set -gx PATH $VOLTA_HOME/bin $PATH
end

# Fly.io CLI
if test -d $HOME/.fly
    set -gx FLYCTL_INSTALL $HOME/.fly
    set -gx PATH $FLYCTL_INSTALL/bin $PATH
end

# Bun
if test -d $HOME/.bun
    set --export BUN_INSTALL $HOME/.bun
    set --export PATH $BUN_INSTALL/bin $PATH
end

# Git abbreviations
abbr --add to git switch
abbr --add nb git checkout -b
abbr --add jjd 'jj describe -m'

# ASDF configuration
if test -z $ASDF_DATA_DIR
    set _asdf_shims $HOME/.asdf/shims
else
    set _asdf_shims $ASDF_DATA_DIR/shims
end

# Do not use fish_add_path (added in Fish 3.2) because it
# potentially changes the order of items in PATH
if not contains $_asdf_shims $PATH
    set -gx --prepend PATH $_asdf_shims
end
set --erase _asdf_shims

# Local bin directory (user-specific)
if test -d $HOME/.local/bin
    set -gx PATH $HOME/.local/bin $PATH
end

# Environment variables (keep these secret in production!)

# bun
set --export BUN_INSTALL "$HOME/.bun"
set --export PATH $BUN_INSTALL/bin $PATH

starship init fish | source

abbr cld claude --dangerously-skip-permissions

# /home/omargoubail/.local/bin/mise activate fish | source # added by https://mise.run/fish
if status is-interactive
    mise activate fish | source
else
    mise activate fish --shims | source
end
