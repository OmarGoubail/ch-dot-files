function europa-forward --description 'Forward same-numbered localhost ports from europa'
    if test (count $argv) -eq 0
        echo 'Usage: europa-forward PORT [PORT ...]'
        return 2
    end

    set -l forwards
    for port in $argv
        if not string match -q -r '^[0-9]+$' -- $port
            echo "Invalid port: $port" >&2
            return 2
        end

        if test $port -lt 1; or test $port -gt 65535
            echo "Port out of range: $port" >&2
            return 2
        end

        set -a forwards -L "$port:127.0.0.1:$port"
    end

    tailscale ssh omargoubail@europa \
        -N -T \
        -o ExitOnForwardFailure=yes \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        $forwards
end
