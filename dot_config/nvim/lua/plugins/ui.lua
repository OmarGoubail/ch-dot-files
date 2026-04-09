-- UI: colorscheme, bufferline, snacks, icons, aerial

-------------------------------------------------------------------------------
-- Install UI plugins
-------------------------------------------------------------------------------
vim.pack.add({
  { src = "https://github.com/folke/tokyonight.nvim" },
  { src = "https://github.com/echasnovski/mini.icons" },
  { src = "https://github.com/akinsho/bufferline.nvim" },
  { src = "https://github.com/folke/snacks.nvim" },
  { src = "https://github.com/stevearc/aerial.nvim" },
})

-------------------------------------------------------------------------------
-- TokyoNight
-------------------------------------------------------------------------------
pcall(function()
  require("tokyonight").setup({
    style = "night",
    transparent = true,
    styles = {
      sidebars = "transparent",
      floats = "transparent",
    },
  })
end)

-------------------------------------------------------------------------------
-- Mini Icons
-------------------------------------------------------------------------------
pcall(function()
  require("mini.icons").setup()
  MiniIcons.mock_nvim_web_devicons()
end)

-------------------------------------------------------------------------------
-- Bufferline
-------------------------------------------------------------------------------
pcall(function()
  require("bufferline").setup({
    options = {
      close_command = function(n)
        pcall(function() Snacks.bufdelete(n) end)
      end,
      right_mouse_command = function(n)
        pcall(function() Snacks.bufdelete(n) end)
      end,
      diagnostics = "nvim_lsp",
      always_show_bufferline = false,
      offsets = {
        {
          filetype = "neo-tree",
          text = "Neo-tree",
          highlight = "Directory",
          text_align = "left",
        },
      },
    },
  })
end)

-------------------------------------------------------------------------------
-- Snacks.nvim (selective features only)
-------------------------------------------------------------------------------
pcall(function()
  require("snacks").setup({
    bigfile = { enabled = true },
    indent = { enabled = true },
    input = { enabled = true },
    notifier = { enabled = true },
    scope = { enabled = true },
    words = { enabled = true },
    terminal = { enabled = true },
    scroll = { enabled = false },
    dashboard = { enabled = false },
    statuscolumn = { enabled = false },
  })
end)

-------------------------------------------------------------------------------
-- Aerial (code outline)
-------------------------------------------------------------------------------
pcall(function()
  require("aerial").setup({
    backends = { "lsp", "treesitter", "markdown", "man" },
    layout = { min_width = 28 },
    show_guides = true,
    filter_kind = false,
    attach_mode = "global",
  })
  vim.keymap.set("n", "<leader>cs", "<cmd>AerialToggle<cr>", { desc = "Aerial (Symbols)" })
end)
