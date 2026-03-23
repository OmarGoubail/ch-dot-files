return {

  {
    "echasnovski/mini.files",
    opts = {
      windows = {
        preview = true,
        width_focus = 50,
        width_preview = 70,
      },
      options = {
        -- Whether to use for editing directories
        -- Disabled by default in LazyVim because neo-tree is used for that
        use_as_default_explorer = false,
      },
      content = {
        -- Filter out certain directories/files for performance (124k+ files in Jump project)
        filter = function(entry)
          local excluded_dirs = { 
            ".git", 
            "node_modules", 
            "_build", 
            "deps", 
            "build", 
            "dist",
            ".elixir_ls",
            ".expert",
            ".elixir_tools",
            "priv/static/assets",
            "cover",
            "doc",
            "tmp",
            ".venv",
          }
          for _, dir in ipairs(excluded_dirs) do
            if entry.name:match(dir) then
              return false -- Exclude matching entries
            end
          end
          return true -- Include all other entries
        end,
      },
    },
    keys = {
      {
        "<leader>fm",
        function()
          require("mini.files").open(vim.api.nvim_buf_get_name(0), true)
        end,
        desc = "Open mini.files (Directory of Current File)",
      },
    },
  },

  {
    "mikavilpas/yazi.nvim",
    event = "VeryLazy",
    keys = {
      -- 👇 in this section, choose your own keymappings!
      {
        "-",
        mode = { "n", "v" },
        "<cmd>Yazi<cr>",
        desc = "Open yazi at the current file",
      },
      {
        -- Open in the current working directory
        "<leader>cw",
        "<cmd>Yazi cwd<cr>",
        desc = "Open the file manager in nvim's working directory",
      },
      {
        -- NOTE: this requires a version of yazi that includes
        -- https://github.com/sxyazi/yazi/pull/1305 from 2024-07-18
        "<c-up>",
        "<cmd>Yazi toggle<cr>",
        desc = "Resume the last yazi session",
      },
    },
    ---@type YaziConfig
    opts = {
      -- if you want to open yazi instead of netrw, see below for more info
      open_for_directories = false,
      keymaps = {
        show_help = "<f1>",
      },
    },
  },
}
