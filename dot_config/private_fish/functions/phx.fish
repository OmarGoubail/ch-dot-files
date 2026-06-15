function phx --description 'Start Phoenix server, optionally through portless'
    if test (count $argv) -eq 0
        echo "Starting Phoenix server on http://localhost:4000"
        iex -S mix phx.server
        return $status
    end

    if contains -- $argv[1] -h --help
        echo "Usage:"
        echo "  phx                 # start Phoenix on localhost:4000"
        echo "  phx llmv2           # start Phoenix through portless as llmv2.localhost"
        echo "  phx --random        # start Phoenix through portless with a random name"
        return 0
    end

    set -l name $argv[1]

    if contains -- $name -r --random random
        set -l adjectives amber brave calm clever cosmic eager fuzzy gentle happy lucky quiet rapid silver vivid
        set -l nouns badger comet falcon fox llama otter panda raven tiger willow zephyr
        set -l adjective $adjectives[(random 1 (count $adjectives))]
        set -l noun $nouns[(random 1 (count $nouns))]
        set name "$adjective-$noun"
    end

    echo "Starting Phoenix server through portless as $name"
    portless $name sh -c 'PHX_PORT="$PORT" exec iex -S mix phx.server'
end
