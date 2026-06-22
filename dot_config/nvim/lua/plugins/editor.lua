-- Editor: file tree, fuzzy finder, motions, navigation, search

local map = vim.keymap.set

-------------------------------------------------------------------------------
-- Install editor plugins
-------------------------------------------------------------------------------
vim.pack.add({
	{ src = "https://github.com/nvim-lua/plenary.nvim" },
	{ src = "https://github.com/stevearc/oil.nvim" },
	{ src = "https://github.com/dmtrKovalenko/fff.nvim" },
	{ src = "https://github.com/folke/flash.nvim" },
	{ src = "https://github.com/ThePrimeagen/harpoon", version = "harpoon2" },
	{ src = "https://github.com/folke/trouble.nvim" },
	{ src = "https://github.com/folke/todo-comments.nvim" },
	{ src = "https://github.com/MagicDuck/grug-far.nvim" },
	{ src = "https://github.com/folke/which-key.nvim" },
})

-------------------------------------------------------------------------------
-- fff.nvim: build binary on install/update and first startup
-------------------------------------------------------------------------------
vim.api.nvim_create_autocmd("User", {
	pattern = "PackChanged",
	callback = function()
		pcall(function()
			require("fff.download").download_or_build_binary()
		end)
	end,
})

vim.api.nvim_create_autocmd("VimEnter", {
	once = true,
	callback = function()
		pcall(function()
			-- ensure_downloaded checks if the binary exists on disk and only
			-- downloads when it's actually missing (unlike download_or_build_binary
			-- which always forces a re-download)
			require("fff.download").ensure_downloaded({}, function(success, err)
				if not success then
					vim.schedule(function()
						vim.notify("fff: " .. (err or "failed to ensure binary"), vim.log.levels.ERROR)
					end)
				end
			end)
		end)
	end,
})

-------------------------------------------------------------------------------
-- Oil.nvim (file explorer)
-------------------------------------------------------------------------------
pcall(function()
	require("oil").setup({
		default_file_explorer = true,
		watch_for_changes = true,
		view_options = {
			show_hidden = true,
		},
		float = {
			padding = 5,
			max_width = 90,
			max_height = 0.8,
			border = "rounded",
			win_options = { winblend = 0 },
		},
		keymaps = {
			-- Keep window navigation keys free
			["<C-h>"] = false,
			["<C-j>"] = false,
			["<C-k>"] = false,
			["<C-l>"] = false,

			-- Let global <C-s> save work in oil
			["<C-s>"] = false,

			-- Rebind refresh
			["<C-r>"] = "actions.refresh",

			-- Close oil and restore the previous buffer (close sidebar window entirely)
			["<C-c>"] = function()
				if vim.b.is_oil_sidebar and vim.fn.winnr("$") > 1 then
					vim.cmd("q")
				else
					require("oil.actions").close.callback()
				end
			end,
			["q"] = function()
				if vim.b.is_oil_sidebar and vim.fn.winnr("$") > 1 then
					vim.cmd("q")
				else
					require("oil.actions").close.callback()
				end
			end,
		},
	})

	map("n", "-", "<cmd>Oil<cr>", { desc = "Open parent directory" })
	map("n", "<leader>e", "<cmd>Oil<cr>", { desc = "Explorer (Oil)" })
	map("n", "<leader>fe", "<cmd>Oil<cr>", { desc = "Explorer (Oil)" })
	map("n", "<leader>E", "<cmd>Oil --float<cr>", { desc = "Explorer (Oil float)" })
	map("n", "<leader>se", function()
		vim.cmd("leftabove 40vsplit")
		require("oil").open()
		vim.b.is_oil_sidebar = true
	end, { desc = "Explorer (Oil sidebar)" })
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
