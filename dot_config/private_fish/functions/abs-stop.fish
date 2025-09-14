function abs-stop --wraps='podman stop audiobookshelf' --description 'alias abs-stop podman stop audiobookshelf'
  podman stop audiobookshelf $argv
        
end
