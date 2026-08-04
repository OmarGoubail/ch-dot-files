function phx --description 'Start Phoenix directly or through portless'
    if test (count $argv) -eq 0
        set -l port 4000
        echo "Starting Phoenix server on http://localhost:$port"
        set -lx PHX_PORT $port
        set -lx PORT $port
        iex -S mix phx.server
        return $status
    end

    if contains -- $argv[1] -h --help
        echo "Usage:"
        echo "  phx [PORT]             # start Phoenix directly, defaulting to port 4000"
        echo "  phx -p NAME            # start Phoenix through portless as NAME.localhost"
        echo "  phx -p --random        # start Phoenix through portless with a random name"
        return 0
    end

    if contains -- $argv[1] -p --portless
        if test (count $argv) -ne 2
            echo "Usage: phx -p NAME | phx -p --random" >&2
            return 2
        end

        set -l name $argv[2]
        if contains -- $name -r --random random
            set -l adjectives amber brave calm clever cosmic eager fuzzy gentle happy lucky quiet rapid silver vivid
            set -l nouns badger comet falcon fox llama otter panda raven tiger willow zephyr
            set -l adjective $adjectives[(random 1 (count $adjectives))]
            set -l noun $nouns[(random 1 (count $nouns))]
            set name "$adjective-$noun"
        end

        echo "Starting Phoenix server through portless as $name"
        portless $name sh -c 'PHX_PORT="$PORT" exec iex -S mix phx.server'
        return $status
    end

    if test (count $argv) -ne 1; or not string match -q -r '^[0-9]+$' -- $argv[1]
        echo "Usage: phx [PORT] | phx -p NAME | phx -p --random" >&2
        return 2
    end

    set -l port $argv[1]
    if test $port -lt 1; or test $port -gt 65535
        echo "Port out of range: $port" >&2
        return 2
    end

    echo "Starting Phoenix server on http://localhost:$port"
    set -lx PHX_PORT $port
    set -lx PORT $port
    iex -S mix phx.server
end
