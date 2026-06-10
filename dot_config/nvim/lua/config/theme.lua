local M = {}

local last_signature

local catalog = {
	tokyo = {
		light = { colorscheme = "tokyonight", style = "day", background = "light" },
		dark = { colorscheme = "tokyonight", style = "night", background = "dark" },
	},
	catppuccin = {
		light = { colorscheme = "catppuccin-latte", style = "latte", flavour = "latte", background = "light" },
		dark = { colorscheme = "catppuccin-mocha", style = "mocha", flavour = "mocha", background = "dark" },
	},
	["rose-pine"] = {
		light = { colorscheme = "rose-pine-dawn", style = "dawn", variant = "dawn", background = "light" },
		dark = { colorscheme = "rose-pine", style = "main", variant = "main", background = "dark" },
	},
	kanagawa = {
		light = { colorscheme = "kanagawa-lotus", style = "lotus", background = "light" },
		dark = { colorscheme = "kanagawa-wave", style = "wave", background = "dark" },
	},
	gruvbox = {
		light = { colorscheme = "gruvbox", background = "light" },
		dark = { colorscheme = "gruvbox", background = "dark" },
	},
	one = {
		light = { colorscheme = "onedark", style = "light", background = "light" },
		dark = { colorscheme = "onedark", style = "dark", background = "dark" },
	},
	solarized = {
		light = { colorscheme = "solarized", background = "light" },
		dark = { colorscheme = "solarized", background = "dark" },
	},
	dracula = {
		dark = { colorscheme = "dracula", background = "dark" },
	},
	nord = {
		light = { colorscheme = "nord", background = "light" },
		dark = { colorscheme = "nord", background = "dark" },
	},
	vesper = {
		dark = { colorscheme = "vesper", background = "dark" },
	},
}

local function generated_theme_file()
	local config_home = os.getenv("XDG_CONFIG_HOME")
	if config_home and config_home ~= "" then
		return config_home .. "/theme/nvim.lua"
	end
	return vim.fn.expand("~/.config/theme/nvim.lua")
end

local function string_or_nil(value)
	if type(value) == "string" and value ~= "" then
		return value
	end
	return nil
end

local function valid_mode(mode)
	return mode == "light" or mode == "dark"
end

local function entry_for(profile, mode)
	local profile_entry = catalog[profile] or catalog.tokyo
	return profile_entry[mode] or profile_entry.dark or catalog.tokyo.dark
end

local function load_generated()
	local path = generated_theme_file()
	if vim.fn.filereadable(path) ~= 1 then
		return {}
	end

	local chunk = loadfile(path)
	if not chunk then
		return {}
	end

	local ok, result = pcall(chunk)
	if ok and type(result) == "table" then
		return result
	end

	return {}
end

local function normalize(raw)
	raw = type(raw) == "table" and raw or {}

	local profile = string_or_nil(raw.profile) or "tokyo"
	if not catalog[profile] then
		profile = "tokyo"
	end

	local mode = valid_mode(raw.mode) and raw.mode or "dark"
	local effective_mode = valid_mode(raw.effective_mode) and raw.effective_mode or mode
	if not catalog[profile][effective_mode] then
		effective_mode = catalog[profile][mode] and mode or "dark"
	end

	local entry = entry_for(profile, effective_mode)
	local background = string_or_nil(raw.background) or entry.background or effective_mode
	if background ~= "light" and background ~= "dark" then
		background = effective_mode
	end

	return {
		profile = profile,
		mode = mode,
		effective_mode = effective_mode,
		colorscheme = string_or_nil(raw.colorscheme) or entry.colorscheme,
		style = string_or_nil(raw.style) or entry.style,
		flavour = string_or_nil(raw.flavour) or entry.flavour,
		variant = string_or_nil(raw.variant) or entry.variant,
		background = background,
		transparent = raw.transparent ~= false,
	}
end

local function signature(state)
	return table.concat({
		state.profile,
		state.mode,
		state.effective_mode,
		state.colorscheme,
		state.style or "",
		state.flavour or "",
		state.variant or "",
		state.background,
		tostring(state.transparent),
	}, "|")
end

local function safe_setup(module_name, opts)
	local ok, plugin = pcall(require, module_name)
	if ok and type(plugin) == "table" and type(plugin.setup) == "function" then
		pcall(plugin.setup, opts)
	end
end

local function setup_tokyonight(state)
	safe_setup("tokyonight", {
		style = state.style or (state.background == "light" and "day" or "night"),
		transparent = state.transparent,
		styles = {
			sidebars = "transparent",
			floats = "transparent",
		},
	})
end

local function setup_catppuccin(state)
	safe_setup("catppuccin", {
		flavour = state.flavour or state.style or (state.background == "light" and "latte" or "mocha"),
		transparent_background = state.transparent,
		background = { light = "latte", dark = "mocha" },
	})
end

local function setup_rose_pine(state)
	safe_setup("rose-pine", {
		variant = state.variant or state.style or (state.background == "light" and "dawn" or "main"),
		styles = { transparency = state.transparent },
	})
end

local function setup_kanagawa(state)
	safe_setup("kanagawa", {
		theme = state.style or (state.background == "light" and "lotus" or "wave"),
		transparent = state.transparent,
	})
end

local function setup_gruvbox(state)
	safe_setup("gruvbox", { transparent_mode = state.transparent })
end

local function setup_onedark(state)
	safe_setup("onedark", {
		style = state.style or state.background,
		transparent = state.transparent,
	})
end

local function setup_solarized(state)
	safe_setup("solarized", {
		transparent = { enabled = state.transparent },
	})
end

local function setup_dracula(state)
	safe_setup("dracula", { transparent_bg = state.transparent })
end

local function setup_nord(state)
	vim.g.nord_disable_background = state.transparent
	safe_setup("nord", { transparent = state.transparent })
end

local function setup_vesper(state)
	safe_setup("vesper", { transparent = state.transparent })
end

local setup_handlers = {
	tokyo = setup_tokyonight,
	catppuccin = setup_catppuccin,
	["rose-pine"] = setup_rose_pine,
	kanagawa = setup_kanagawa,
	gruvbox = setup_gruvbox,
	one = setup_onedark,
	solarized = setup_solarized,
	dracula = setup_dracula,
	nord = setup_nord,
	vesper = setup_vesper,
}

local function setup_for(state)
	local handler = setup_handlers[state.profile]
	if handler then
		handler(state)
	end
end

local function apply_colorscheme(name)
	if not name or name == "" then
		return false
	end
	return pcall(vim.cmd.colorscheme, name)
end

function M.read()
	return normalize(load_generated())
end

function M.read_mode()
	return M.read().mode
end

function M.tokyonight_options(mode)
	mode = mode or M.read().effective_mode
	return {
		style = mode == "light" and "day" or "night",
		transparent = true,
		styles = {
			sidebars = "transparent",
			floats = "transparent",
		},
	}
end

function M.apply()
	local state = M.read()
	last_signature = signature(state)

	vim.o.background = state.background == "light" and "light" or "dark"
	setup_for(state)

	local ok = apply_colorscheme(state.colorscheme)
	if not ok and state.colorscheme ~= "tokyonight" then
		local fallback_mode = state.background == "light" and "light" or "dark"
		local fallback = normalize({ profile = "tokyo", mode = fallback_mode, effective_mode = fallback_mode })
		vim.o.background = fallback.background
		setup_tokyonight(fallback)
		ok = apply_colorscheme("tokyonight")
	end

	if not ok then
		pcall(vim.cmd.colorscheme, "habamax")
	end

	return state
end

function M.apply_if_changed()
	local state = M.read()
	local current_signature = signature(state)
	if current_signature ~= last_signature then
		return M.apply(), true
	end
	return state, false
end

return M
