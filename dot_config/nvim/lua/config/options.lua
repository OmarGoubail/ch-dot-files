-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
--

local opt = vim.opt
vim.opt.shell = "fish"

vim.api.nvim_create_autocmd("FileType", {
  pattern = "*",
  callback = function()
    vim.opt_local.formatoptions:remove({ "r", "o" })
  end,
})

opt.relativenumber = false -- Relative line numbe

vim.opt.sessionoptions = {
  -- "blank",
  "buffers",
  "curdir",
  -- "folds",
  -- "globals",
  -- "help",
  -- "localoptions",
  -- "options",
  -- "skiprtp",
  "resize",
  -- "sesdir",
  "tabpages",
  "terminal", -- <== NOTE for restoring terminal windows
  "winpos",
  "winsize",
}

-- vim.o.expandtab = true
vim.o.wrap = true
vim.o.signcolumn = "yes"
vim.opt.smartindent = true
vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undodir = os.getenv("HOME") .. "/.nvim/undodir"
vim.opt.undofile = true
vim.opt.scrolloff = 8
vim.opt.updatetime = 50
vim.o.autoread = true
vim.opt.exrc = true
-- vim.opt.secure = true

vim.api.nvim_create_autocmd({ "FocusGained", "BufEnter", "CursorHold", "CursorHoldI" }, {
  pattern = "*",
  callback = function()
    if vim.fn.mode() ~= "c" then
      vim.cmd("checktime")
    end
  end,
})

-- Also reload on file system events if available
vim.api.nvim_create_autocmd("FileChangedShellPost", {
  pattern = "*",
  callback = function()
    vim.notify("File changed on disk. Buffer reloaded.", vim.log.levels.INFO)
  end,
})
