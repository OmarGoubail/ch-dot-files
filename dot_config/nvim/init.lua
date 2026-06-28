-- Neovim 0.12 config
-- No LazyVim distribution -- built-in features + essential plugins

-- Leaders must be set before anything else
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"

-- Disable unused providers for faster startup
vim.g.loaded_python3_provider = 0
vim.g.loaded_ruby_provider = 0
vim.g.loaded_perl_provider = 0
vim.g.loaded_node_provider = 0

-- Fix markdown indentation settings
vim.g.markdown_recommended_style = 0

-- Load options before plugins (some plugins read vim options on load)
require("config.options")

-- Load plugins via vim.pack (Neovim 0.12 built-in package manager)
require("plugins")

-- Load autocmds, keymaps, and pack management after plugins
require("config.autocmds")
require("config.keymaps")
require("config.pack")

require("config.tuxedo").setup()

local theme = require("config.theme")

-- Transparency: remove backgrounds for terminal transparency
local transparent_groups = {
	"Normal",
	"NormalNC",
	"NormalFloat",
	"NormalSB",
	"SignColumn",
	"StatusLine",
	"StatusLineNC",
	"Pmenu",
	"PmenuSel",
	"OilDir",
	"OilDirIcon",
}

local function apply_transparency()
	for _, group in ipairs(transparent_groups) do
		pcall(vim.api.nvim_set_hl, 0, group, { bg = "NONE" })
	end
end

vim.api.nvim_create_autocmd("ColorScheme", {
	callback = apply_transparency,
})

-- Colorscheme (with generated theme state and fallback)
theme.apply()
apply_transparency()

vim.api.nvim_create_user_command("ThemeReload", function()
	theme.apply()
	apply_transparency()
end, { desc = "Reload generated theme state" })

vim.api.nvim_create_autocmd("FocusGained", {
	callback = function()
		local _, changed = theme.apply_if_changed()
		if changed then
			apply_transparency()
		end
	end,
})
