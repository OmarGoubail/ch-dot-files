-- ~/.config/nvim/lua/plugins/ai.lua

-- AI assistant configuration
return {
  "coder/claudecode.nvim",
  -- dependencies = {
  --   "folke/snacks.nvim", -- Optional for enhanced terminal
  -- },
  opts = {
    -- Server options
    port_range = { min = 10000, max = 65535 },
    auto_start = true,
    log_level = "info",

    -- Terminal options
    terminal = {
      split_side = "right",
      split_width_percentage = 0.3,
      provider = "auto", -- "auto" (default), "snacks", or "native"
      auto_close = true, -- Auto-close terminal after command completion
    },

    -- Diff options
    diff_opts = {
      auto_close_on_accept = true,
      vertical_split = true,
    },
  },
  config = true,
  keys = {
    { "<leader>a", nil, desc = "AI/Claude Code" },
    { "<leader>ac", "<cmd>ClaudeCode<cr>", desc = "Toggle Claude" },
    { "<leader>as", "<cmd>ClaudeCodeSend<cr>", mode = "v", desc = "Send to Claude" },
    { "<leader>af", "<cmd>ClaudeCodeFocus<cr>", desc = "Focus Claude" },
    { "<leader>ar", "<cmd>ClaudeCode --resume<cr>", desc = "Resume Claude" },
    { "<leader>aC", "<cmd>ClaudeCode --continue<cr>", desc = "Continue Claude" },
    {
      "<leader>as",
      "<cmd>ClaudeCodeTreeAdd<cr>",
      desc = "Add file",
      ft = { "NvimTree", "neo-tree" },
    },
    { "<leader>ao", "<cmd>ClaudeCodeOpen<cr>", desc = "Open Claude" },
    { "<leader>ax", "<cmd>ClaudeCodeClose<cr>", desc = "Close Claude" },
  },
}

-- return {
--   "GeorgesAlkhouri/nvim-aider",
--   cmd = {
--     "AiderTerminalToggle", "AiderHealth",
--   },
--   keys = {
--     { "<leader>aa", "<cmd>AiderTerminalToggle<cr>", desc = "Open Aider" },
--     { "<leader>as", "<cmd>AiderTerminalSend<cr>", desc = "Send to Aider", mode = { "n", "v" } },
--     { "<leader>ac", "<cmd>AiderQuickSendCommand<cr>", desc = "Send Command To Aider" },
--     { "<leader>ab", "<cmd>AiderQuickSendBuffer<cr>", desc = "Send Buffer To Aider" },
--     { "<leader>a+", "<cmd>AiderQuickAddFile<cr>", desc = "Add File to Aider" },
--     { "<leader>a-", "<cmd>AiderQuickDropFile<cr>", desc = "Drop File from Aider" },
--     { "<leader>ar", "<cmd>AiderQuickReadOnlyFile<cr>", desc = "Add File as Read-Only" },
--     -- Example nvim-tree.lua integration if needed
--     { "<leader>a+", "<cmd>AiderTreeAddFile<cr>", desc = "Add File from Tree to Aider", ft = "NvimTree" },
--     { "<leader>a-", "<cmd>AiderTreeDropFile<cr>", desc = "Drop File from Tree from Aider", ft = "NvimTree" },
--   },
--   dependencies = {
--     "folke/snacks.nvim",
--     --- The below dependencies are optional
--     "catppuccin/nvim",
--     "nvim-tree/nvim-tree.lua",
--     --- Neo-tree integration
--     {
--       "nvim-neo-tree/neo-tree.nvim",
--       opts = function(_, opts)
--         -- Example mapping configuration (already set by default)
--         -- opts.window = {
--         --   mappings = {
--         --     ["+"] = { "nvim_aider_add", desc = "add to aider" },
--         --     ["-"] = { "nvim_aider_drop", desc = "drop from aider" }
--         --   }
--         -- }
--         require("nvim_aider.neo_tree").setup(opts)
--       end,
--     },
--   },
--   config = function()
--     require("nvim_aider").setup({
--       -- Command that executes Aider
--       aider_cmd = "aider",
--       -- Command line arguments passed to aider
--       args = {
--         "--no-auto-commits",
--         "--pretty",
--         "--stream",
--         "--subtree-only",
--         "--watch-files"
--       },
--       -- Theme colors (automatically uses Catppuccin flavor if available)
--       theme = {
--         user_input_color = "#a6da95",
--         tool_output_color = "#8aadf4",
--         tool_error_color = "#ed8796",
--         tool_warning_color = "#eed49f",
--         assistant_output_color = "#c6a0f6",
--         completion_menu_color = "#cad3f5",
--         completion_menu_bg_color = "#24273a",
--         completion_menu_current_color = "#181926",
--         completion_menu_current_bg_color = "#f4dbd6",
--       },
--       -- snacks.picker.layout.Config configuration
--       picker_cfg = {
--         preset = "vscode",
--       },
--       -- Other snacks.terminal.Opts options
--       config = {
--         os = { editPreset = "nvim-remote" },
--         gui = { nerdFontsVersion = "3" },
--       },
--       win = {
--         wo = { winbar = "Aider" },
--         style = "nvim_aider",
--         position = "left",
--       },
--     })
--   end,
-- }
