-- Editor: file tree, fuzzy finder, motions, navigation, search

local map = vim.keymap.set

-------------------------------------------------------------------------------
-- Install editor plugins
-------------------------------------------------------------------------------
vim.pack.add({
	{ src = "https://github.com/nvim-lua/plenary.nvim" },
	{ src = "https://github.com/MunifTanjim/nui.nvim" },
	{ src = "https://github.com/nvim-neo-tree/neo-tree.nvim" },
	{ src = "https://github.com/dmtrKovalenko/fff.nvim" },
	{ src = "https://github.com/folke/flash.nvim" },
	{ src = "https://github.com/ThePrimeagen/harpoon", version = "harpoon2" },
	{ src = "https://github.com/folke/trouble.nvim" },
	{ src = "https://github.com/folke/todo-comments.nvim" },
	{ src = "https://github.com/MagicDuck/grug-far.nvim" },
	{ src = "https://github.com/folke/which-key.nvim" },
})

-------------------------------------------------------------------------------
-- fff.nvim: build binary on install/update
-------------------------------------------------------------------------------
vim.api.nvim_create_autocmd("User", {
	pattern = "PackChanged",
	callback = function()
		pcall(function()
			require("fff.download").download_or_build_binary()
		end)
	end,
})

-------------------------------------------------------------------------------
-- Neo-tree
-------------------------------------------------------------------------------
pcall(function()
	require("neo-tree").setup({
		sources = { "filesystem", "buffers", "git_status" },
		filesystem = {
			follow_current_file = { enabled = true },
			use_libuv_file_watcher = true,
			filtered_items = {
				hide_dotfiles = false,
				hide_gitignored = false,
			},
		},
		window = {
			position = "left",
			width = 30,
			mappings = {
				["<space>"] = "none",
				-- Pass through to smart-splits instead of neo-tree handling these
				["<C-h>"] = "none",
				["<C-j>"] = "none",
				["<C-k>"] = "none",
				["<C-l>"] = "none",
			},
		},
		default_component_configs = {
			indent = {
				with_expanders = true,
				expander_collapsed = "▸",
				expander_expanded = "▾",
			},
		},
	})
	map("n", "<leader>e", "<cmd>Neotree toggle<cr>", { desc = "Explorer" })
	map("n", "<leader>fe", "<cmd>Neotree toggle<cr>", { desc = "Explorer" })
	map("n", "<leader>ge", "<cmd>Neotree git_status<cr>", { desc = "Git Explorer" })
	map("n", "<leader>be", "<cmd>Neotree buffers<cr>", { desc = "Buffer Explorer" })
end)

-------------------------------------------------------------------------------
-- fff.nvim (fast fuzzy finder)
-------------------------------------------------------------------------------
pcall(function()
	require("fff").setup({})

	map("n", "<leader>ff", function()
		require("fff").find_files()
	end, { desc = "Find Files" })
	map("n", "<leader><space>", function()
		require("fff").find_files()
	end, { desc = "Find Files" })
	map("n", "<leader>sg", function()
		require("fff").live_grep()
	end, { desc = "Live Grep" })
	map("n", "<leader>/", function()
		require("fff").live_grep()
	end, { desc = "Live Grep" })
end)

-------------------------------------------------------------------------------
-- Flash.nvim (motions)
-------------------------------------------------------------------------------
pcall(function()
	require("flash").setup()

	map({ "n", "x", "o" }, "s", function()
		require("flash").jump()
	end, { desc = "Flash" })
	map({ "n", "x", "o" }, "S", function()
		require("flash").treesitter()
	end, { desc = "Flash Treesitter" })
	map("o", "r", function()
		require("flash").remote()
	end, { desc = "Remote Flash" })
	map({ "o", "x" }, "R", function()
		require("flash").treesitter_search()
	end, { desc = "Treesitter Search" })
	map("c", "<c-s>", function()
		require("flash").toggle()
	end, { desc = "Toggle Flash Search" })
end)

-------------------------------------------------------------------------------
-- Harpoon 2
-------------------------------------------------------------------------------
pcall(function()
	local harpoon = require("harpoon")
	harpoon:setup()

	map("n", "<leader>ha", function()
		harpoon:list():add()
	end, { desc = "Harpoon Add" })
	map("n", "<leader>hh", function()
		harpoon.ui:toggle_quick_menu(harpoon:list())
	end, { desc = "Harpoon Menu" })
	map("n", "<leader>1", function()
		harpoon:list():select(1)
	end, { desc = "Harpoon 1" })
	map("n", "<leader>2", function()
		harpoon:list():select(2)
	end, { desc = "Harpoon 2" })
	map("n", "<leader>3", function()
		harpoon:list():select(3)
	end, { desc = "Harpoon 3" })
	map("n", "<leader>4", function()
		harpoon:list():select(4)
	end, { desc = "Harpoon 4" })
	map("n", "<leader>5", function()
		harpoon:list():select(5)
	end, { desc = "Harpoon 5" })
end)

-------------------------------------------------------------------------------
-- Trouble.nvim (diagnostics panel)
-------------------------------------------------------------------------------
pcall(function()
	require("trouble").setup({
		modes = {
			lsp = { win = { position = "right" } },
		},
	})

	map("n", "<leader>xx", "<cmd>Trouble diagnostics toggle<cr>", { desc = "Diagnostics (Trouble)" })
	map(
		"n",
		"<leader>xX",
		"<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
		{ desc = "Buffer Diagnostics (Trouble)" }
	)
	map("n", "<leader>cS", "<cmd>Trouble lsp toggle<cr>", { desc = "LSP References (Trouble)" })
	map("n", "<leader>xL", "<cmd>Trouble loclist toggle<cr>", { desc = "Location List (Trouble)" })
	map("n", "<leader>xQ", "<cmd>Trouble qflist toggle<cr>", { desc = "Quickfix List (Trouble)" })
end)

-------------------------------------------------------------------------------
-- Todo Comments
-------------------------------------------------------------------------------
pcall(function()
	require("todo-comments").setup()

	map("n", "]t", function()
		require("todo-comments").jump_next()
	end, { desc = "Next Todo" })
	map("n", "[t", function()
		require("todo-comments").jump_prev()
	end, { desc = "Prev Todo" })
	map("n", "<leader>xt", "<cmd>Trouble todo toggle<cr>", { desc = "Todos (Trouble)" })
	map(
		"n",
		"<leader>xT",
		"<cmd>Trouble todo toggle filter={tag={TODO,FIX,FIXME}}<cr>",
		{ desc = "Todo/Fix/Fixme (Trouble)" }
	)
end)

-------------------------------------------------------------------------------
-- Grug-far (search and replace)
-------------------------------------------------------------------------------
pcall(function()
	require("grug-far").setup({ headerMaxWidth = 80 })

	map("n", "<leader>sr", function()
		require("grug-far").open({ prefills = { paths = vim.fn.expand("%") } })
	end, { desc = "Search and Replace (file)" })
	map("n", "<leader>sR", function()
		require("grug-far").open()
	end, { desc = "Search and Replace (project)" })
end)

-------------------------------------------------------------------------------
-- Which-key
-------------------------------------------------------------------------------
pcall(function()
	require("which-key").setup({
		preset = "helix",
		delay = 300,
		icons = { mappings = true },
	})
	require("which-key").add({
		{ "<leader>b", group = "buffer" },
		{ "<leader>c", group = "code" },
		{ "<leader>f", group = "file/find" },
		{ "<leader>g", group = "git" },
		{ "<leader>h", group = "harpoon" },
		{ "<leader>s", group = "search" },
		{ "<leader>u", group = "ui/toggle" },
		{ "<leader>w", group = "windows" },
		{ "<leader>x", group = "diagnostics/quickfix" },
		{ "<leader><tab>", group = "tabs" },
	})
end)
