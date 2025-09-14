-- ==============================================
-- CUSTOM PROJECT WORKSPACES
-- ==============================================
-- This module defines custom workspace shortcuts for specific projects
-- Add your own projects here with custom keybindings

local wezterm = require("wezterm")
local act = wezterm.action

local M = {}

-- Define your custom projects here
-- Each project should have:
-- - name: workspace name
-- - path: directory path
-- - key: hotkey (single character)
-- - startup_cmd: optional command to run on workspace creation
M.projects = {
	{
		name = "dotfiles",
		path = wezterm.home_dir .. "/.config",
		key = "d",
		startup_cmd = "nvim .", -- Opens neovim in the dotfiles directory
	},
	{
		name = "projects",
		path = wezterm.home_dir .. "/projects",
		key = "p",
		-- No startup command, just opens in the directory
	},
	{
		name = "home",
		path = wezterm.home_dir,
		key = "h",
	},
	-- Add your own projects here:
	-- {
	--   name = "myproject",
	--   path = wezterm.home_dir .. "/code/myproject",
	--   key = "m",
	--   startup_cmd = "nvim src/main.py",
	-- },
}

-- Function to create a workspace for a specific project
function M.create_project_workspace(project)
	return wezterm.action_callback(function(window, pane)
		-- Switch to workspace or create it if it doesn't exist
		window:perform_action(
			act.SwitchToWorkspace({
				name = project.name,
				spawn = {
					cwd = project.path,
				},
			}),
			pane
		)

		-- If there's a startup command, run it after a brief delay
		if project.startup_cmd then
			wezterm.sleep_ms(100) -- Small delay to ensure workspace is ready
			local new_pane = window:active_pane()
			new_pane:send_text(project.startup_cmd .. "\\r")
		end
	end)
end

-- Function to get all project keybindings
function M.get_project_keys()
	local keys = {}

	for _, project in ipairs(M.projects) do
		table.insert(keys, {
			key = project.key,
			mods = "LEADER|ALT", -- Leader + Alt + key for project shortcuts
			action = M.create_project_workspace(project),
		})
	end

	return keys
end

-- Function to get a help text for all project shortcuts
function M.get_project_help()
	local help = "Custom Project Shortcuts (Leader + Alt + key):\\n"
	for _, project in ipairs(M.projects) do
		help = help .. string.format("  %s -> %s (%s)\\n", project.key, project.name, project.path)
	end
	return help
end

-- Optional: Add a help command to show all project shortcuts
function M.show_project_help()
	return wezterm.action_callback(function(window, pane)
		window:toast_notification("Project Shortcuts", M.get_project_help(), nil, 4000)
	end)
end


return M

