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
-- Run :TSUpdate after install/update
vim.api.nvim_create_autocmd("User", {
  pattern = "PackChanged",
  callback = function()
    pcall(vim.cmd, "TSUpdate")
  end,
})

-- Try nvim-treesitter configs API (may not exist on main branch)
pcall(function()
  ---@diagnostic disable-next-line: missing-fields
  require("nvim-treesitter.configs").setup({
    ensure_installed = {
      "bash", "c", "css", "diff", "elixir", "eex", "heex",
      "fish", "html", "javascript", "json", "jsonc", "lua",
      "luadoc", "markdown", "markdown_inline", "query", "regex",
      "rust", "svelte", "astro", "toml", "tsx", "typescript",
      "vim", "vimdoc", "xml", "yaml",
    },
    highlight = { enable = true },
    indent = { enable = true },
  })
end)

-- Fallback: ensure treesitter highlighting is always enabled via built-in API
-- Neovim 0.12 can do this natively without the plugin
vim.api.nvim_create_autocmd("FileType", {
  callback = function()
    pcall(vim.treesitter.start)
  end,
})

