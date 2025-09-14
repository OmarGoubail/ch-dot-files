function phx --description 'Kill port 4000 and start Phoenix server'
    # Kill only the process listening on port 4000 (not connections to it)
    echo "Killing any process listening on port 4000..."
    lsof -ti :4000 -sTCP:LISTEN | xargs kill -9 2>/dev/null || echo "No process found listening on port 4000"
    # Give it a moment to clean up
    sleep 1
    # Start Phoenix server
    echo "Starting Phoenix server on port 4000"
    iex -S mix phx.server
end
