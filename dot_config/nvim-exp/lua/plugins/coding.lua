-- Coding: editing, formatting, linting, text objects

-------------------------------------------------------------------------------
-- Install coding plugins
-------------------------------------------------------------------------------
vim.pack.add({
  { src = "https://github.com/echasnovski/mini.surround" },
  { src = "https://github.com/echasnovski/mini.pairs" },
  { src = "https://github.com/echasnovski/mini.ai" },
  { src = "https://github.com/gbprod/yanky.nvim" },
  { src = "https://github.com/folke/ts-comments.nvim" },
  { src = "https://github.com/windwp/nvim-ts-autotag" },
  { src = "https://github.com/stevearc/conform.nvim" },
  { src = "https://github.com/mfussenegger/nvim-lint" },
})

-------------------------------------------------------------------------------
-- Mini.surround
-------------------------------------------------------------------------------
pcall(function()
  require("mini.surround").setup({
    mappings = {
      add = "gsa",
      delete = "gsd",
      find = "gsf",
      find_left = "gsF",
      highlight = "gsh",
      replace = "gsr",
      update_n_lines = "gsn",
    },
  })
end)

-------------------------------------------------------------------------------
-- Mini.pairs (auto close brackets)
-------------------------------------------------------------------------------
pcall(function()
  require("mini.pairs").setup({
    modes = { insert = true, command = true, terminal = false },
  })
end)

-------------------------------------------------------------------------------
-- Mini.ai (better text objects)
-------------------------------------------------------------------------------
pcall(function()
  require("mini.ai").setup({
    n_lines = 500,
    custom_textobjects = {
      o = require("mini.ai").gen_spec.treesitter({
        a = { "@block.outer", "@conditional.outer", "@loop.outer" },
        i = { "@block.inner", "@conditional.inner", "@loop.inner" },
      }),
      f = require("mini.ai").gen_spec.treesitter({ a = "@function.outer", i = "@function.inner" }),
      c = require("mini.ai").gen_spec.treesitter({ a = "@class.outer", i = "@class.inner" }),
    },
  })
end)

-------------------------------------------------------------------------------
-- Yanky (yank ring)
-------------------------------------------------------------------------------
pcall(function()
  require("yanky").setup({
    highlight = { timer = 200 },
  })

  vim.keymap.set({ "n", "x" }, "p", "<Plug>(YankyPutAfter)")
  vim.keymap.set({ "n", "x" }, "P", "<Plug>(YankyPutBefore)")
  vim.keymap.set("n", "<c-p>", "<Plug>(YankyPreviousEntry)")
  vim.keymap.set("n", "<c-n>", "<Plug>(YankyNextEntry)")
  vim.keymap.set("n", "]p", "<Plug>(YankyPutIndentAfterLinewise)")
  vim.keymap.set("n", "[p", "<Plug>(YankyPutIndentBeforeLinewise)")
end)

-------------------------------------------------------------------------------
-- ts-comments.nvim (context-aware commenting)
-------------------------------------------------------------------------------
pcall(function()
  require("ts-comments").setup()
end)

-------------------------------------------------------------------------------
-- nvim-ts-autotag (auto close/rename HTML tags)
-------------------------------------------------------------------------------
pcall(function()
  require("nvim-ts-autotag").setup()
end)

-------------------------------------------------------------------------------
-- Conform.nvim (formatting)
-------------------------------------------------------------------------------
pcall(function()
  require("conform").setup({
    formatters_by_ft = {
      lua = { "stylua" },
      fish = { "fish_indent" },
      sh = { "shfmt" },
      javascript = { "prettier" },
      typescript = { "prettier" },
      javascriptreact = { "prettier" },
      typescriptreact = { "prettier" },
      html = { "prettier" },
      css = { "prettier" },
      json = { "prettier" },
      yaml = { "prettier" },
      markdown = { "prettier" },
      elixir = { "mix" },
      heex = { "mix" },
      rust = { "rustfmt" },
    },
    format_on_save = function()
      if vim.g.autoformat == false then
        return
      end
      return { timeout_ms = 3000, lsp_fallback = true }
    end,
  })
  vim.g.autoformat = true
end)

-------------------------------------------------------------------------------
-- nvim-lint (linting)
-------------------------------------------------------------------------------
pcall(function()
  local lint = require("lint")
  lint.linters_by_ft = {
    fish = { "fish" },
  }

  vim.api.nvim_create_autocmd({ "BufWritePost", "BufReadPost", "InsertLeave" }, {
    callback = function()
      lint.try_lint()
    end,
  })
end)
