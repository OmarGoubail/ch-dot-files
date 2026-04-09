-- Keymaps: LazyVim essentials + user customizations
local map = vim.keymap.set

-------------------------------------------------------------------------------
-- User custom: escape
-------------------------------------------------------------------------------
map("i", "jk", "<Esc>", { desc = "Escape" })
map("i", "kj", "<Esc>", { desc = "Escape" })

-------------------------------------------------------------------------------
-- Better movement (respect wrapped lines)
-------------------------------------------------------------------------------
map({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { desc = "Down", expr = true, silent = true })
map({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { desc = "Up", expr = true, silent = true })
map({ "n", "x" }, "<Down>", "v:count == 0 ? 'gj' : 'j'", { desc = "Down", expr = true, silent = true })
map({ "n", "x" }, "<Up>", "v:count == 0 ? 'gk' : 'k'", { desc = "Up", expr = true, silent = true })

-------------------------------------------------------------------------------
-- Move lines (Alt+j/k)
-------------------------------------------------------------------------------
map("n", "<A-j>", "<cmd>execute 'move .+' . v:count1<cr>==", { desc = "Move Down" })
map("n", "<A-k>", "<cmd>execute 'move .-' . (v:count1 + 1)<cr>==", { desc = "Move Up" })
map("i", "<A-j>", "<esc><cmd>m .+1<cr>==gi", { desc = "Move Down" })
map("i", "<A-k>", "<esc><cmd>m .-2<cr>==gi", { desc = "Move Up" })
map("v", "<A-j>", ":<C-u>execute \"'<,'>move '>+\" . v:count1<cr>gv=gv", { desc = "Move Down" })
map("v", "<A-k>", ":<C-u>execute \"'<,'>move '<-\" . (v:count1 + 1)<cr>gv=gv", { desc = "Move Up" })

-------------------------------------------------------------------------------
-- Buffers
-------------------------------------------------------------------------------
map("n", "<S-h>", "<cmd>bprevious<cr>", { desc = "Prev Buffer" })
map("n", "<S-l>", "<cmd>bnext<cr>", { desc = "Next Buffer" })
map("n", "[b", "<cmd>bprevious<cr>", { desc = "Prev Buffer" })
map("n", "]b", "<cmd>bnext<cr>", { desc = "Next Buffer" })
map("n", "<leader>bb", "<cmd>e #<cr>", { desc = "Switch to Other Buffer" })
map("n", "<leader>`", "<cmd>e #<cr>", { desc = "Switch to Other Buffer" })
map("n", "<leader>bd", function()
  Snacks.bufdelete()
end, { desc = "Delete Buffer" })
map("n", "<leader>bo", function()
  Snacks.bufdelete.other()
end, { desc = "Delete Other Buffers" })
map("n", "<leader>bD", "<cmd>bd<cr>", { desc = "Delete Buffer and Window" })

-------------------------------------------------------------------------------
-- Clear search / escape
-------------------------------------------------------------------------------
map({ "i", "n", "s" }, "<Esc>", function()
  vim.cmd("nohlsearch")
  return "<Esc>"
end, { expr = true, desc = "Escape and Clear hlsearch" })

-------------------------------------------------------------------------------
-- Consistent n/N direction
-------------------------------------------------------------------------------
map("n", "n", "'Nn'[v:searchforward].'zv'", { expr = true, desc = "Next Search Result" })
map("x", "n", "'Nn'[v:searchforward]", { expr = true, desc = "Next Search Result" })
map("o", "n", "'Nn'[v:searchforward]", { expr = true, desc = "Next Search Result" })
map("n", "N", "'nN'[v:searchforward].'zv'", { expr = true, desc = "Prev Search Result" })
map("x", "N", "'nN'[v:searchforward]", { expr = true, desc = "Prev Search Result" })
map("o", "N", "'nN'[v:searchforward]", { expr = true, desc = "Prev Search Result" })

-------------------------------------------------------------------------------
-- Undo break-points (in insert mode)
-------------------------------------------------------------------------------
map("i", ",", ",<c-g>u")
map("i", ".", ".<c-g>u")
map("i", ";", ";<c-g>u")

-------------------------------------------------------------------------------
-- Save
-------------------------------------------------------------------------------
map({ "i", "x", "n", "s" }, "<C-s>", "<cmd>w<cr><esc>", { desc = "Save File" })

-------------------------------------------------------------------------------
-- Better indenting (keep selection)
-------------------------------------------------------------------------------
map("v", "<", "<gv")
map("v", ">", ">gv")

-------------------------------------------------------------------------------
-- Commenting
-------------------------------------------------------------------------------
map("n", "gco", "o<esc>Vcx<esc><cmd>normal gcc<cr>fxa<bs>", { desc = "Add Comment Below" })
map("n", "gcO", "O<esc>Vcx<esc><cmd>normal gcc<cr>fxa<bs>", { desc = "Add Comment Above" })

-------------------------------------------------------------------------------
-- Code / LSP
-------------------------------------------------------------------------------
map("n", "<leader>K", "<cmd>norm! K<cr>", { desc = "Keywordprg" })
map("n", "<leader>cd", vim.diagnostic.open_float, { desc = "Line Diagnostics" })
map({ "n", "v" }, "<leader>cf", function()
  require("conform").format({ async = true, lsp_fallback = true })
end, { desc = "Format" })
map("n", "<leader>cr", vim.lsp.buf.rename, { desc = "Rename" })
map({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, { desc = "Code Action" })

-------------------------------------------------------------------------------
-- Diagnostics navigation
-------------------------------------------------------------------------------
map("n", "]d", function() vim.diagnostic.jump({ count = 1 }) end, { desc = "Next Diagnostic" })
map("n", "[d", function() vim.diagnostic.jump({ count = -1 }) end, { desc = "Prev Diagnostic" })
map("n", "]e", function() vim.diagnostic.jump({ count = 1, severity = vim.diagnostic.severity.ERROR }) end, { desc = "Next Error" })
map("n", "[e", function() vim.diagnostic.jump({ count = -1, severity = vim.diagnostic.severity.ERROR }) end, { desc = "Prev Error" })
map("n", "]w", function() vim.diagnostic.jump({ count = 1, severity = vim.diagnostic.severity.WARN }) end, { desc = "Next Warning" })
map("n", "[w", function() vim.diagnostic.jump({ count = -1, severity = vim.diagnostic.severity.WARN }) end, { desc = "Prev Warning" })

-------------------------------------------------------------------------------
-- Windows
-------------------------------------------------------------------------------
map("n", "<leader>-", "<C-W>s", { desc = "Split Below" })
map("n", "<leader>|", "<C-W>v", { desc = "Split Right" })
map("n", "<leader>wd", "<C-W>c", { desc = "Delete Window" })
map("n", "<leader>wm", function()
  Snacks.zen.zoom()
end, { desc = "Toggle Zoom" })

-------------------------------------------------------------------------------
-- Tabs
-------------------------------------------------------------------------------
map("n", "<leader><tab>l", "<cmd>tablast<cr>", { desc = "Last Tab" })
map("n", "<leader><tab>o", "<cmd>tabonly<cr>", { desc = "Close Other Tabs" })
map("n", "<leader><tab>f", "<cmd>tabfirst<cr>", { desc = "First Tab" })
map("n", "<leader><tab><tab>", "<cmd>tabnew<cr>", { desc = "New Tab" })
map("n", "<leader><tab>]", "<cmd>tabnext<cr>", { desc = "Next Tab" })
map("n", "<leader><tab>d", "<cmd>tabclose<cr>", { desc = "Close Tab" })
map("n", "<leader><tab>[", "<cmd>tabprevious<cr>", { desc = "Previous Tab" })

-------------------------------------------------------------------------------
-- Quickfix / location list
-------------------------------------------------------------------------------
map("n", "<leader>xl", "<cmd>lopen<cr>", { desc = "Location List" })
map("n", "<leader>xq", "<cmd>copen<cr>", { desc = "Quickfix List" })
map("n", "[q", "<cmd>cprev<cr>", { desc = "Previous Quickfix" })
map("n", "]q", "<cmd>cnext<cr>", { desc = "Next Quickfix" })

-------------------------------------------------------------------------------
-- Quit / new file
-------------------------------------------------------------------------------
map("n", "<leader>qq", "<cmd>qa<cr>", { desc = "Quit All" })
map("n", "<leader>fn", "<cmd>enew<cr>", { desc = "New File" })

-------------------------------------------------------------------------------
-- Toggle options (LazyVim <leader>u prefix)
-------------------------------------------------------------------------------
map("n", "<leader>uf", function()
  vim.g.autoformat = not vim.g.autoformat
  vim.notify("Autoformat: " .. (vim.g.autoformat and "on" or "off"))
end, { desc = "Toggle Auto Format" })

map("n", "<leader>us", function()
  vim.opt_local.spell = not vim.opt_local.spell:get()
end, { desc = "Toggle Spelling" })

map("n", "<leader>uw", function()
  vim.opt_local.wrap = not vim.opt_local.wrap:get()
end, { desc = "Toggle Word Wrap" })

map("n", "<leader>uL", function()
  vim.opt_local.relativenumber = not vim.opt_local.relativenumber:get()
end, { desc = "Toggle Relative Numbers" })

map("n", "<leader>ud", function()
  vim.diagnostic.enable(not vim.diagnostic.is_enabled())
end, { desc = "Toggle Diagnostics" })

map("n", "<leader>ul", function()
  vim.opt_local.number = not vim.opt_local.number:get()
end, { desc = "Toggle Line Numbers" })

map("n", "<leader>uc", function()
  local cl = vim.opt_local.conceallevel:get()
  vim.opt_local.conceallevel = cl == 0 and 2 or 0
end, { desc = "Toggle Conceal" })

map("n", "<leader>uT", function()
  if vim.b.ts_highlight then
    vim.treesitter.stop()
  else
    vim.treesitter.start()
  end
end, { desc = "Toggle Treesitter Highlight" })

map("n", "<leader>uh", function()
  vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
end, { desc = "Toggle Inlay Hints" })

-------------------------------------------------------------------------------
-- Inspect
-------------------------------------------------------------------------------
map("n", "<leader>ui", vim.show_pos, { desc = "Inspect Pos" })
map("n", "<leader>uI", "<cmd>InspectTree<cr>", { desc = "Inspect Tree" })

-------------------------------------------------------------------------------
-- Terminal
-------------------------------------------------------------------------------
map("n", "<leader>ft", "<cmd>terminal<cr>", { desc = "Terminal" })
map("t", "<C-/>", "<cmd>close<cr>", { desc = "Hide Terminal" })
map("t", "<Esc><Esc>", "<c-\\><c-n>", { desc = "Enter Normal Mode" })

-------------------------------------------------------------------------------
-- Redraw / clear
-------------------------------------------------------------------------------
map("n", "<leader>ur", "<cmd>nohlsearch<Bar>diffupdate<Bar>normal! <C-L><cr>", { desc = "Redraw / Clear" })
