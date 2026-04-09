-- Tools: smart-splits, treesitter, claudecode

local map = vim.keymap.set

-------------------------------------------------------------------------------
-- Install tool plugins
-------------------------------------------------------------------------------
vim.pack.add({
  { src = "https://github.com/mrjones2014/smart-splits.nvim" },
  { src = "https://github.com/nvim-treesitter/nvim-treesitter" },
})

-------------------------------------------------------------------------------
-- Smart-splits (tmux-aware split navigation/resizing)
-------------------------------------------------------------------------------
pcall(function()
  require("smart-splits").setup({
    ignored_filetypes = { "nofile", "quickfix", "prompt" },
    ignored_buftypes = { "NvimTree" },
  })

  -- Navigation (Ctrl+hjkl)
  map("n", "<C-h>", function() require("smart-splits").move_cursor_left() end, { desc = "Move to Left Split" })
  map("n", "<C-j>", function() require("smart-splits").move_cursor_down() end, { desc = "Move to Below Split" })
  map("n", "<C-k>", function() require("smart-splits").move_cursor_up() end, { desc = "Move to Above Split" })
  map("n", "<C-l>", function() require("smart-splits").move_cursor_right() end, { desc = "Move to Right Split" })

  -- Resizing (Alt+hjkl)
  map("n", "<A-h>", function() require("smart-splits").resize_left() end, { desc = "Resize Left" })
  map("n", "<A-j>", function() require("smart-splits").resize_down() end, { desc = "Resize Down" })
  map("n", "<A-k>", function() require("smart-splits").resize_up() end, { desc = "Resize Up" })
  map("n", "<A-l>", function() require("smart-splits").resize_right() end, { desc = "Resize Right" })
end)

-------------------------------------------------------------------------------
-- Treesitter
-------------------------------------------------------------------------------
-- nvim-treesitter stores queries in runtime/ subdir - add it to rtp
local ts_path = vim.fn.stdpath("data") .. "/site/pack/core/opt/nvim-treesitter/runtime"
if vim.uv.fs_stat(ts_path) and not vim.o.runtimepath:find(ts_path, 1, true) then
  vim.opt.runtimepath:prepend(ts_path)
end

-- Run :TSUpdate after install/update
vim.api.nvim_create_autocmd("User", {
  pattern = "PackChanged",
  callback = function()
    pcall(vim.cmd, "TSUpdate")
  end,
})

-- Parsers to auto-install
local ensure_installed = {
  "bash", "c", "css", "diff", "elixir", "eex", "heex",
  "fish", "html", "javascript", "json", "jsonc", "lua",
  "luadoc", "markdown", "markdown_inline", "query", "regex",
  "rust", "svelte", "astro", "toml", "tsx", "typescript",
  "vim", "vimdoc", "xml", "yaml",
}

-- Auto-install missing parsers on startup
vim.api.nvim_create_autocmd("VimEnter", {
  once = true,
  callback = function()
    local missing = {}
    for _, lang in ipairs(ensure_installed) do
      local ok = pcall(vim.treesitter.language.inspect, lang)
      if not ok then
        table.insert(missing, lang)
      end
    end
    if #missing > 0 then
      vim.notify("Installing treesitter parsers: " .. table.concat(missing, ", "))
      vim.cmd("TSInstall " .. table.concat(missing, " "))
    end
  end,
})

-- Enable treesitter highlighting via built-in API
vim.api.nvim_create_autocmd("FileType", {
  callback = function()
    pcall(vim.treesitter.start)
  end,
})

