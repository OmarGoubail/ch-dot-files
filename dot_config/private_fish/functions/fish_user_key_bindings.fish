function fish_user_key_bindings
    fish_vi_key_bindings

    # Disable Ctrl+D from closing the shell — use terminal leader+x instead
    bind \cd delete-char
    bind -M insert \cd delete-char
    bind -M default \cd delete-char
end
