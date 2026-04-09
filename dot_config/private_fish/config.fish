# Detect OS
set -l os_name (uname -s)

# === PATH Setup (fish_add_path deduplicates automatically) ===
fish_add_path $HOME/.local/bin

switch $os_name
    case Darwin
        if test -f /opt/homebrew/bin/brew
            eval (/opt/homebrew/bin/brew shellenv)
        end

        if test -d /opt/homebrew/opt/openjdk
            set -gx JAVA_HOME /opt/homebrew/opt/openjdk
            fish_add_path $JAVA_HOME/bin
        end

        set -gx BROWSER open

    case Linux
        if test -d /usr/lib/jvm/java-21-openjdk
            set -gx JAVA_HOME /usr/lib/jvm/java-21-openjdk
            fish_add_path $JAVA_HOME/bin
        end

        if test -f /usr/bin/zen-browser
            set -gx BROWSER /usr/bin/zen-browser
        end

        if test -f /home/$USER/stuff/dev/gcloud/google-cloud-sdk/path.fish.inc
            source /home/$USER/stuff/dev/gcloud/google-cloud-sdk/path.fish.inc
        end

        set -gx Z_EXCLUDE /home/$USER/stuff/dev/gcloud /home/$USER/stuff/dev/gcloud/google-cloud-sdk
end

# Volta
if test -d $HOME/.volta
    set -gx VOLTA_HOME $HOME/.volta
    fish_add_path $VOLTA_HOME/bin
end

# Fly.io
if test -d $HOME/.fly
    set -gx FLYCTL_INSTALL $HOME/.fly
    fish_add_path $FLYCTL_INSTALL/bin
end

# Bun
if test -d $HOME/.bun
    set -gx BUN_INSTALL $HOME/.bun
    fish_add_path $BUN_INSTALL/bin
end

# === Abbreviations ===
abbr --add to git switch
abbr --add nb git checkout -b
abbr --add jjd 'jj describe -m'
abbr --add cld claude --dangerously-skip-permissions

# WorkTrunk
abbr --add wts 'wt switch'
abbr --add wtl 'wt list --full'
abbr --add wtm 'wt merge'
abbr --add wtr 'wt remove'
abbr --add wta 'wt switch -x opencode -c'
abbr --add wtpl 'wt step prune --dry-run'

function wtc
    if test (count $argv) -eq 0
        echo "Usage: wtc <branch-name>"
        return 1
    end
    wt switch --create $argv[1] && wt step copy-ignored
end

# === Tool Init (cached for fast startup) ===
# Run `fish_cache_regen` after updating these tools
set -l _cache $HOME/.cache/fish-init
test -d $_cache; or mkdir -p $_cache

if command -v starship >/dev/null
    test -f $_cache/starship.fish; or starship init fish --print-full-init >$_cache/starship.fish
    source $_cache/starship.fish
end

if command -v atuin >/dev/null
    test -f $_cache/atuin.fish; or atuin init fish >$_cache/atuin.fish
    source $_cache/atuin.fish
end

if command -v zoxide >/dev/null
    test -f $_cache/zoxide.fish; or zoxide init fish >$_cache/zoxide.fish
    source $_cache/zoxide.fish
end

if command -v mise >/dev/null
    if status is-interactive
        test -f $_cache/mise.fish; or mise activate fish >$_cache/mise.fish
        source $_cache/mise.fish
    else
        mise activate fish --shims | source
    end
end
