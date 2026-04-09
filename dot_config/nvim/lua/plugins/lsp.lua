-- LSP: built-in Neovim 0.12 LSP + mason for installing servers

-------------------------------------------------------------------------------
-- Install LSP plugins
-------------------------------------------------------------------------------
vim.pack.add({
  { src = "https://github.com/mason-org/mason.nvim" },
})

-------------------------------------------------------------------------------
-- Mason
-------------------------------------------------------------------------------
pcall(function()
  require("mason").setup({
    ui = { border = "single" },
  })
  -- Add mason bin to PATH so vim.lsp.config can find installed servers
  -- Check both nvim-exp and shared nvim mason directories
  local mason_bin = vim.fn.stdpath("data") .. "/mason/bin"
  local shared_mason_bin = vim.fn.expand("~/.local/share/nvim/mason/bin")
  for _, bin_dir in ipairs({ mason_bin, shared_mason_bin }) do
    if not vim.env.PATH:find(bin_dir, 1, true) then
      vim.env.PATH = bin_dir .. ":" .. vim.env.PATH
    end
  end
end)

-------------------------------------------------------------------------------
-- Diagnostics config
-------------------------------------------------------------------------------
vim.diagnostic.config({
  virtual_text = {
    spacing = 4,
    prefix = "●",
  },
  severity_sort = true,
  underline = true,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = " ",
      [vim.diagnostic.severity.WARN] = " ",
      [vim.diagnostic.severity.HINT] = " ",
      [vim.diagnostic.severity.INFO] = " ",
    },
  },
  float = {
    border = "single",
    source = true,
  },
})

-------------------------------------------------------------------------------
-- LSP on_attach: keymaps + completion
-------------------------------------------------------------------------------
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(event)
    local buf = event.buf
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if not client then return end

    local function bmap(mode, lhs, rhs, desc)
      vim.keymap.set(mode, lhs, rhs, { buffer = buf, desc = desc })
    end

    -- Navigation
    bmap("n", "gd", vim.lsp.buf.definition, "Goto Definition")
    bmap("n", "gD", vim.lsp.buf.declaration, "Goto Declaration")
    bmap("n", "gr", vim.lsp.buf.references, "References")
    bmap("n", "gI", vim.lsp.buf.implementation, "Goto Implementation")
    bmap("n", "gy", vim.lsp.buf.type_definition, "Goto Type Definition")

    -- Info
    bmap("n", "K", vim.lsp.buf.hover, "Hover")
    bmap({ "n", "i" }, "<C-k>", vim.lsp.buf.signature_help, "Signature Help")

    -- Enable built-in LSP completion for this buffer
    if client:supports_method("textDocument/completion") then
      vim.lsp.completion.enable(true, client.id, buf, { autotrigger = true })
    end

    -- Manual completion trigger: <C-Space>
    bmap("i", "<C-Space>", "<C-x><C-o>", "Trigger Completion")

    -- Enable inlay hints if supported
    if client:supports_method("textDocument/inlayHint") then
      vim.lsp.inlay_hint.enable(true, { bufnr = buf })
    end

    -- Enable codelens if supported
    if client:supports_method("textDocument/codeLens") then
      vim.lsp.codelens.refresh({ bufnr = 0 })
      vim.api.nvim_create_autocmd({ "BufEnter", "InsertLeave" }, {
        buffer = buf,
        callback = function()
          vim.lsp.codelens.refresh({ bufnr = 0 })
        end,
      })
    end
  end,
})

-------------------------------------------------------------------------------
-- Server configs (Neovim 0.12 built-in vim.lsp.config)
-------------------------------------------------------------------------------

-- Global defaults: capabilities sent to ALL servers
vim.lsp.config("*", {
  capabilities = {
    textDocument = {
      completion = {
        completionItem = {
          snippetSupport = true,
          resolveSupport = {
            properties = { "documentation", "detail", "additionalTextEdits" },
          },
        },
      },
    },
  },
})

-- Lua
vim.lsp.config("lua_ls", {
  cmd = { "lua-language-server" },
  filetypes = { "lua" },
  root_markers = { ".luarc.json", ".luarc.jsonc", ".stylua.toml", "stylua.toml", ".git" },
  settings = {
    Lua = {
      workspace = { checkThirdParty = false },
      codeLens = { enable = true },
      completion = { callSnippet = "Replace" },
      hint = {
        enable = true,
        arrayIndex = "Disable",
        setType = false,
        paramName = "Disable",
      },
    },
  }, 
})

-- Expert (Elixir LSP)
vim.lsp.config("expert", {
  cmd = { os.getenv("HOME") .. "/.local/bin/expert_darwin_arm64", "--stdio" },
  filetypes = { "elixir", "eelixir", "heex" },
  root_markers = { "mix.exs", "mix.lock", ".git" },
  settings = {
    elixir = {
      dialyzerEnabled = true,
      enableTestLenses = true,
      suggestSpecs = true,
    },
  },
})

-- TypeScript
vim.lsp.config("ts_ls", {
  cmd = { "typescript-language-server", "--stdio" },
  filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
  root_markers = { "tsconfig.json", "jsconfig.json", "package.json", ".git" },
})

-- Tailwind CSS
vim.lsp.config("tailwindcss", {
  cmd = { "tailwindcss-language-server", "--stdio" },
  filetypes = { "html", "css", "elixir", "eelixir", "heex", "svelte", "astro", "typescriptreact", "javascriptreact" },
  root_markers = { "tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "assets/tailwind.config.js", ".git" },
  settings = {
    tailwindCSS = {
      includeLanguages = {
        elixir = "html-eex",
        eelixir = "html-eex",
        heex = "html-eex",
      },
    },
  },
})

-- Emmet
vim.lsp.config("emmet_ls", {
  cmd = { "emmet-ls", "--stdio" },
  filetypes = { "html", "heex", "elixir" },
  init_options = {
    html = { options = { ["bem.enabled"] = true } },
  },
})

-- JSON
vim.lsp.config("jsonls", {
  cmd = { "vscode-json-language-server", "--stdio" },
  filetypes = { "json", "jsonc" },
  root_markers = { ".git" },
})

-- Rust Analyzer
vim.lsp.config("rust_analyzer", {
  cmd = { "rust-analyzer" },
  filetypes = { "rust" },
  root_markers = { "Cargo.toml", "rust-project.json", ".git" },
  settings = {
    ["rust-analyzer"] = {
      check = { command = "clippy" },
    },
  },
})

-------------------------------------------------------------------------------
-- Enable all configured servers
-------------------------------------------------------------------------------
vim.lsp.enable({
  "lua_ls",
  "expert",
  "ts_ls",
  "tailwindcss",
  "emmet_ls",
  "jsonls",
  "rust_analyzer",
})
