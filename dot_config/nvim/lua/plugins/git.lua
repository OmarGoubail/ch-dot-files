-- Git: diffview (primary diff tool), neogit, gitsigns

local map = vim.keymap.set

-------------------------------------------------------------------------------
-- Install git plugins
-------------------------------------------------------------------------------
vim.pack.add({
  { src = "https://github.com/sindrets/diffview.nvim" },
  { src = "https://github.com/NeogitOrg/neogit" },
  { src = "https://github.com/lewis6991/gitsigns.nvim" },
})

-------------------------------------------------------------------------------
-- Diffview.nvim (primary diff viewer -- replaces lazygit for viewing diffs)
-------------------------------------------------------------------------------
pcall(function()
  require("diffview").setup({
    enhanced_diff_hl = true,
    view = {
      default = { layout = "diff2_horizontal" },
      merge_tool = { layout = "diff3_horizontal" },
    },
  })

  map("n", "<leader>gd", "<cmd>DiffviewOpen<cr>", { desc = "Diffview: All Changes" })
  map("n", "<leader>gD", "<cmd>DiffviewClose<cr>", { desc = "Diffview: Close" })
  map("n", "<leader>gh", "<cmd>DiffviewFileHistory %<cr>", { desc = "Diffview: File History" })
  map("n", "<leader>gH", "<cmd>DiffviewFileHistory<cr>", { desc = "Diffview: Repo History" })
  map("n", "<leader>gl", "<cmd>DiffviewOpen HEAD~1<cr>", { desc = "Diffview: Last Commit" })
  map("n", "<leader>gr", "<cmd>DiffviewRefresh<cr>", { desc = "Diffview: Refresh" })

  -- Unified diff: all changes in one scrollable buffer
  map("n", "<leader>gU", function()
    vim.cmd("tabnew")
    vim.bo.buftype = "nofile"
    vim.bo.bufhidden = "wipe"
    vim.bo.filetype = "diff"
    vim.cmd("r !git diff")
    vim.cmd("0d_")
    vim.bo.modifiable = false
    vim.api.nvim_buf_set_name(0, "git diff (all files)")
  end, { desc = "Git Diff: Unified (all files)" })
end)

-------------------------------------------------------------------------------
-- Neogit (git client for staging/committing)
-------------------------------------------------------------------------------
pcall(function()
  require("neogit").setup({
    integrations = {
      diffview = true,
    },
    kind = "tab",
    signs = {
      section = { "▸", "▾" },
      item = { "▸", "▾" },
    },
  })

  map("n", "<leader>gg", "<cmd>Neogit<cr>", { desc = "Neogit" })
  map("n", "<leader>gc", "<cmd>Neogit commit<cr>", { desc = "Neogit Commit" })
end)

-------------------------------------------------------------------------------
-- Gitsigns (git gutter signs, hunk navigation/staging)
-------------------------------------------------------------------------------
pcall(function()
  require("gitsigns").setup({
    signs = {
      add = { text = "▎" },
      change = { text = "▎" },
      delete = { text = "" },
      topdelete = { text = "" },
      changedelete = { text = "▎" },
      untracked = { text = "▎" },
    },
    signs_staged = {
      add = { text = "▎" },
      change = { text = "▎" },
      delete = { text = "" },
      topdelete = { text = "" },
      changedelete = { text = "▎" },
    },
    on_attach = function(buf)
      local gs = require("gitsigns")
      local function bmap(mode, l, r, desc)
        vim.keymap.set(mode, l, r, { buffer = buf, desc = desc })
      end

      bmap("n", "]h", function() gs.nav_hunk("next") end, "Next Hunk")
      bmap("n", "[h", function() gs.nav_hunk("prev") end, "Prev Hunk")
      bmap("n", "]H", function() gs.nav_hunk("last") end, "Last Hunk")
      bmap("n", "[H", function() gs.nav_hunk("first") end, "First Hunk")

      bmap({ "n", "v" }, "<leader>ghs", gs.stage_hunk, "Stage Hunk")
      bmap({ "n", "v" }, "<leader>ghr", gs.reset_hunk, "Reset Hunk")
      bmap("n", "<leader>ghS", gs.stage_buffer, "Stage Buffer")
      bmap("n", "<leader>ghR", gs.reset_buffer, "Reset Buffer")
      bmap("n", "<leader>ghu", gs.undo_stage_hunk, "Undo Stage Hunk")
      bmap("n", "<leader>ghp", gs.preview_hunk_inline, "Preview Hunk Inline")
      bmap("n", "<leader>ghb", function() gs.blame_line({ full = true }) end, "Blame Line")
      bmap("n", "<leader>ghd", gs.diffthis, "Diff This")
      bmap("n", "<leader>ghD", function() gs.diffthis("~") end, "Diff This ~")

      bmap({ "o", "x" }, "ih", ":<C-U>Gitsigns select_hunk<cr>", "Select Hunk")
    end,
  })

  map("n", "<leader>gb", "<cmd>Gitsigns blame<cr>", { desc = "Git Blame (full)" })
end)
