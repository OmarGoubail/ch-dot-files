# Fish shell completions for git-pr CLI

# Helper function to get repositories from GitHub API
function __git_pr_get_repos
    set -l search_term $argv[1]
    if test -n "$GITHUB_TOKEN"
        if test -n "$search_term"
            # Search repos with similarity matching
            git-pr repos --search "$search_term" --limit 20 2>/dev/null | grep -E '^🔒|^🌐' | sed -E 's/^[🔒🌐] +[🍴]* +([^ ]+).*/\1/' | head -10 | sort
        else
            # Limit to 50 repos for performance
            git-pr repos --limit 50 2>/dev/null | grep -E '^🔒|^🌐' | sed -E 's/^[🔒🌐] +[🍴]* +([^ ]+).*/\1/' | head -20 | sort
        end
    end
end

# Helper function to get PRs for a repository
function __git_pr_get_prs
    set -l repo $argv[1]
    set -l search_term $argv[2]
    if test -n "$GITHUB_TOKEN" -a -n "$repo"
        if test -n "$search_term"
            # If search term provided, filter PRs by title similarity
            git-pr prs $repo --limit 20 2>/dev/null | grep -E '^🟢|^🔴' | grep -i "$search_term" | sed -E 's/^[🟢🔴] +[📝]* +#([0-9]+).*/\1/' | head -10 | sort -nr
        else
            # Limit to 10 most recent PRs for performance
            git-pr prs $repo --limit 10 2>/dev/null | grep -E '^🟢|^🔴' | sed -E 's/^[🟢🔴] +[📝]* +#([0-9]+).*/\1/' | sort -nr
        end
    end
end

# Disable file completion for git-pr
complete -c git-pr -f

# Main commands
complete -c git-pr -n '__fish_use_subcommand' -a 'repos' -d 'List and search GitHub repositories'
complete -c git-pr -n '__fish_use_subcommand' -a 'prs' -d 'List PRs for a repository'
complete -c git-pr -n '__fish_use_subcommand' -a 'pr' -d 'Fetch comments and reviews for a specific PR'

# Global options
complete -c git-pr -s h -l help -d 'Show help'
complete -c git-pr -s V -l version -d 'Show version'
complete -c git-pr -s t -l token -d 'GitHub personal access token' -x

# repos command options
complete -c git-pr -n '__fish_seen_subcommand_from repos' -s s -l search -d 'Search repositories by keyword' -x
complete -c git-pr -n '__fish_seen_subcommand_from repos' -s l -l language -d 'Filter by programming language' -x -a 'TypeScript JavaScript Python Java Go Rust C++ C Ruby PHP Swift Kotlin Dart Elixir Shell'
complete -c git-pr -n '__fish_seen_subcommand_from repos' -s v -l visibility -d 'Filter by visibility' -x -a 'public private all'
complete -c git-pr -n '__fish_seen_subcommand_from repos' -l limit -d 'Maximum number of repositories to show' -x

# prs command - repository completion with smart search
complete -c git-pr -n '__fish_seen_subcommand_from prs; and not __fish_seen_subcommand_from (__git_pr_get_repos)' -a '(__git_pr_get_repos (commandline -ct))' -d 'Repository'

# prs command options
complete -c git-pr -n '__fish_seen_subcommand_from prs' -s s -l state -d 'PR state' -x -a 'open closed all'
complete -c git-pr -n '__fish_seen_subcommand_from prs' -l limit -d 'Maximum number of PRs to show' -x

# pr command - repository completion with smart search
complete -c git-pr -n '__fish_seen_subcommand_from pr; and test (count (commandline -opc)) -eq 2' -a '(__git_pr_get_repos (commandline -ct))' -d 'Repository'

# pr command - PR number completion (when repository is already specified)
complete -c git-pr -n '__fish_seen_subcommand_from pr; and test (count (commandline -opc)) -eq 3' -a '(__git_pr_get_prs (commandline -opc)[3] (commandline -ct))' -d 'PR number'

# Common programming languages for faster typing
set -l common_languages TypeScript JavaScript Python Java Go Rust Elixir Ruby PHP Swift Kotlin Dart Shell C++ C

# Enhanced language completion with descriptions
for lang in $common_languages
    complete -c git-pr -n '__fish_seen_subcommand_from repos' -s l -l language -a $lang -d "Filter by $lang"
end

# Visibility options with descriptions
complete -c git-pr -n '__fish_seen_subcommand_from repos' -s v -l visibility -a 'public' -d 'Show only public repositories'
complete -c git-pr -n '__fish_seen_subcommand_from repos' -s v -l visibility -a 'private' -d 'Show only private repositories'
complete -c git-pr -n '__fish_seen_subcommand_from repos' -s v -l visibility -a 'all' -d 'Show all repositories'

# PR state options with descriptions
complete -c git-pr -n '__fish_seen_subcommand_from prs' -s s -l state -a 'open' -d 'Show only open PRs'
complete -c git-pr -n '__fish_seen_subcommand_from prs' -s s -l state -a 'closed' -d 'Show only closed PRs'
complete -c git-pr -n '__fish_seen_subcommand_from prs' -s s -l state -a 'all' -d 'Show all PRs'

# Number suggestions for limit options
complete -c git-pr -n '__fish_seen_subcommand_from repos prs' -l limit -a '10 20 50 100' -d 'Limit results'