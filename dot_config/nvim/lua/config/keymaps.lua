-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
--
-- local logsitter = require("logsitter")
-- local javascript_logger = require("logsitter.lang.javascript")

local map = vim.keymap.set

-- escape i mode

map("i", "kj", "<ESC>")
map("i", "jk", "<ESC>")

-- logsitter.register(javascript_logger, { "svelte", "ts", "tsx", "jsx", "vue" })

-- map("n", "<leader>dq", function()
--   logsitter.log()
-- end, { desc = "console log " })

map("n", "<leader>sl", "<cmd>Lazy reload luasnip<cr>", { desc = "Reload LuaSnip" })

-- map({ "n", "v" }, "<leader>aa", "<cmd>CodeCompanionActions<cr>", { noremap = true, silent = true })
-- map({ "n", "v" }, "<leader>ac", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })
-- map("v", "ga", "<cmd>CodeCompanionChat Add<cr>", { noremap = true, silent = true })

-- Expand 'cc' into 'CodeCompanion' in the command line
-- vim.cmd([[cab cc CodeCompanion]])
