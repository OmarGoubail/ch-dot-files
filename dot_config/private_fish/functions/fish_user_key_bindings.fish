function fish_user_key_bindings
    # Disable Ctrl+D from closing the shell — use WezTerm Leader+x instead
    bind \cd delete-char
    bind -M insert \cd delete-char
end
