function europa --wraps='tailscale ssh omargoubail@europa' --description 'Open an SSH shell on europa'
    tailscale ssh omargoubail@europa $argv
end
