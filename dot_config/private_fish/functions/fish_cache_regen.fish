function fish_cache_regen --description "Regenerate cached tool init scripts"
    set -l dir $HOME/.cache/fish-init
    rm -rf $dir
    mkdir -p $dir

    command -v starship >/dev/null; and starship init fish --print-full-init >$dir/starship.fish; and echo "cached starship"
    command -v atuin >/dev/null; and atuin init fish >$dir/atuin.fish; and echo "cached atuin"
    command -v zoxide >/dev/null; and zoxide init fish >$dir/zoxide.fish; and echo "cached zoxide"
    command -v mise >/dev/null; and mise activate fish >$dir/mise.fish; and echo "cached mise"

    echo "done — restart your shell to pick up changes"
end
