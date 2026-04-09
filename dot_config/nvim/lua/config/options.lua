-- Options: LazyVim defaults + user preferences + Neovim 0.12 features

local opt = vim.opt

-- General
opt.autowrite = true
opt.confirm = true
opt.mouse = "a"
opt.sessionoptions = { "buffers", "curdir", "resize", "tabpages", "terminal", "winpos", "winsize" }

-- Clipboard: defer loading for faster startup (xsel/pbcopy can be slow)
vim.schedule(function()
  opt.clipboard = "unnamedplus"
end)

-- Search
opt.ignorecase = true
opt.smartcase = true
opt.inccommand = "nosplit"
opt.grepformat = "%f:%l:%c:%m"
opt.grepprg = "rg --vimgrep"

-- Display
opt.number = true
opt.relativenumber = false -- user preference: absolute numbers
opt.cursorline = true
opt.signcolumn = "yes"
opt.showmode = false
opt.ruler = false
opt.laststatus = 3 -- global statusline
opt.termguicolors = true
opt.conceallevel = 2
opt.pumheight = 10
opt.pumblend = 10
opt.shortmess:append({ W = true, I = true, c = true, C = true })
opt.fillchars = {
  foldopen = "▾",
  foldclose = "▸",
  fold = " ",
  foldsep = " ",
  diff = "╱",
  eob = " ",
}

-- Neovim 0.12: popup borders
opt.winborder = "single"
opt.pumborder = "single"

-- Scrolling
opt.scrolloff = 8 -- user preference
opt.sidescrolloff = 8
opt.smoothscroll = true

-- Editing
opt.expandtab = true
opt.shiftwidth = 2
opt.tabstop = 2
opt.shiftround = true
opt.smartindent = true
opt.wrap = true -- user preference
opt.linebreak = true
opt.list = true
opt.virtualedit = "block"
opt.formatoptions = "jcroqlnt"

-- Folding
opt.foldlevel = 99
opt.foldmethod = "indent"
opt.foldtext = ""

-- Splits
opt.splitbelow = true
opt.splitright = true
opt.splitkeep = "screen"
opt.winminwidth = 5

-- Timing
opt.timeoutlen = 300
opt.updatetime = 250 -- user preference

-- Undo / persistence
opt.undofile = true
opt.undolevels = 10000
opt.undodir = os.getenv("HOME") .. "/.nvim/undodir"
opt.swapfile = false
opt.backup = false

-- Completion (Neovim 0.12 built-in)
opt.completeopt = "menu,menuone,noselect,popup,fuzzy"
opt.jumpoptions = "view"
opt.wildmode = "longest:full,full"

-- Spell
opt.spelllang = { "en" }

-- Diff (Neovim 0.12 improvements)
opt.diffopt:append({ "indent-heuristic", "inline:word", "linematch:60" })

-- Shell
vim.o.shell = "/opt/homebrew/bin/fish"

-- Project-local config
opt.exrc = true

-- Performance: ignore large directories
opt.wildignore:append({
  "*/_build/*", "*/deps/*", "*/node_modules/*",
  "*/.elixir_ls/*", "*/.expert/*", "*/.git/*",
})

-- Enable built-in plugins
vim.cmd("packadd nvim.undotree")
vim.cmd("packadd nvim.difftool")

-------------------------------------------------------------------------------
-- Statusline (built-in, no plugin needed)
-------------------------------------------------------------------------------

-- Highlight groups for the statusline (set after colorscheme loads)
vim.api.nvim_create_autocmd("ColorScheme", {
  group = vim.api.nvim_create_augroup("statusline_colors", { clear = true }),
  callback = function()
    local c = {
      bg = "#1a1b26",
      fg = "#c0caf5",
      blue = "#7aa2f7",
      green = "#9ece6a",
      magenta = "#bb9af7",
      red = "#f7768e",
      yellow = "#e0af68",
      cyan = "#7dcfff",
      orange = "#ff9e64",
      dim = "#565f89",
      dark = "#16161e",
    }
    vim.api.nvim_set_hl(0, "StMode", { fg = c.dark, bg = c.blue, bold = true })
    vim.api.nvim_set_hl(0, "StModeInsert", { fg = c.dark, bg = c.green, bold = true })
    vim.api.nvim_set_hl(0, "StModeVisual", { fg = c.dark, bg = c.magenta, bold = true })
    vim.api.nvim_set_hl(0, "StModeReplace", { fg = c.dark, bg = c.red, bold = true })
    vim.api.nvim_set_hl(0, "StModeCommand", { fg = c.dark, bg = c.orange, bold = true })
    vim.api.nvim_set_hl(0, "StModeTerminal", { fg = c.dark, bg = c.cyan, bold = true })
    vim.api.nvim_set_hl(0, "StBranch", { fg = c.magenta, bg = c.bg })
    vim.api.nvim_set_hl(0, "StFile", { fg = c.fg, bg = c.bg, bold = true })
    vim.api.nvim_set_hl(0, "StFileMod", { fg = c.orange, bg = c.bg, bold = true })
    vim.api.nvim_set_hl(0, "StSep", { fg = c.dim, bg = c.bg })
    vim.api.nvim_set_hl(0, "StDiagError", { fg = c.red, bg = c.bg })
    vim.api.nvim_set_hl(0, "StDiagWarn", { fg = c.yellow, bg = c.bg })
    vim.api.nvim_set_hl(0, "StDiagHint", { fg = c.cyan, bg = c.bg })
    vim.api.nvim_set_hl(0, "StLsp", { fg = c.dim, bg = c.bg })
    vim.api.nvim_set_hl(0, "StPos", { fg = c.fg, bg = c.bg })
    vim.api.nvim_set_hl(0, "StPercent", { fg = c.dark, bg = c.blue })
  end,
})

function _G.statusline()
  -- Mode
  local mode_config = {
    ["n"]    = { "NORMAL",   "StMode" },
    ["no"]   = { "O-PEND",   "StMode" },
    ["nov"]  = { "O-PEND",   "StMode" },
    ["noV"]  = { "O-PEND",   "StMode" },
    ["i"]    = { "INSERT",   "StModeInsert" },
    ["ic"]   = { "INSERT",   "StModeInsert" },
    ["ix"]   = { "INSERT",   "StModeInsert" },
    ["v"]    = { "VISUAL",   "StModeVisual" },
    ["V"]    = { "V-LINE",   "StModeVisual" },
    ["\22"]  = { "V-BLOCK",  "StModeVisual" },
    ["s"]    = { "SELECT",   "StModeVisual" },
    ["S"]    = { "S-LINE",   "StModeVisual" },
    ["\19"]  = { "S-BLOCK",  "StModeVisual" },
    ["R"]    = { "REPLACE",  "StModeReplace" },
    ["Rv"]   = { "V-REPL",   "StModeReplace" },
    ["c"]    = { "COMMAND",  "StModeCommand" },
    ["cv"]   = { "VIM EX",   "StModeCommand" },
    ["ce"]   = { "EX",       "StModeCommand" },
    ["t"]    = { "TERMINAL", "StModeTerminal" },
    ["!"]    = { "SHELL",    "StModeTerminal" },
  }

  local mode = vim.api.nvim_get_mode().mode
  local m = mode_config[mode] or { mode, "StMode" }

  local s = "%#" .. m[2] .. "#  " .. m[1] .. " "

  -- Git branch
  local branch = vim.b.gitsigns_head
  if branch then
    s = s .. "%#StBranch#  " .. branch .. " "
  end

  -- Separator
  s = s .. "%#StSep# | "

  -- File name (colored differently if modified)
  local modified = vim.bo.modified
  s = s .. "%#" .. (modified and "StFileMod" or "StFile") .. "#"
  s = s .. " %f" .. (modified and " +" or "") .. " %r"

  -- Push right
  s = s .. "%="

  -- Diagnostics
  local diag = vim.diagnostic.count(0)
  local sev = vim.diagnostic.severity
  if diag[sev.ERROR] and diag[sev.ERROR] > 0 then
    s = s .. "%#StDiagError# " .. diag[sev.ERROR] .. " "
  end
  if diag[sev.WARN] and diag[sev.WARN] > 0 then
    s = s .. "%#StDiagWarn# " .. diag[sev.WARN] .. " "
  end
  if diag[sev.HINT] and diag[sev.HINT] > 0 then
    s = s .. "%#StDiagHint# " .. diag[sev.HINT] .. " "
  end

  -- LSP progress (truncated)
  local progress = vim.lsp.status()
  if progress and progress ~= "" then
    if #progress > 20 then
      progress = progress:sub(1, 17) .. "..."
    end
    s = s .. "%#StLsp# " .. progress .. " "
  end

  -- LSP client names (show all attached)
  local clients = vim.lsp.get_clients({ bufnr = 0 })
  if #clients > 0 then
    local names = {}
    for _, c in ipairs(clients) do
      table.insert(names, c.name)
    end
    s = s .. "%#StLsp# " .. table.concat(names, ", ") .. " "
  end

  -- Separator
  s = s .. "%#StSep#| "

  -- Position
  s = s .. "%#StPos# %l:%c "

  -- Percentage
  s = s .. "%#StPercent#  %p%% "

  return s
end

vim.o.statusline = "%!v:lua.statusline()"

-- Redraw statusline on LSP progress updates
vim.api.nvim_create_autocmd("LspProgress", {
  callback = function()
    vim.cmd.redrawstatus()
  end,
})
