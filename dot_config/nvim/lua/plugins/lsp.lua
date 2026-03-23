return {
  "neovim/nvim-lspconfig",
  opts = {
    servers = {
      -- Configure expert-ls (the new official Elixir LSP)
      expert = {
        cmd = { "/Users/omargoubail/.local/bin/expert_darwin_arm64", "--stdio" },
        settings = {
          elixir = {
            dialyzerEnabled = true,
            enableTestLenses = true,
            suggestSpecs = true,
          },
        },
      },
      tailwindcss = {
        filetypes = { "html", "elixir", "eelixir", "heex" },
        root_dir = function(fname)
          return require("lspconfig.util").root_pattern(
            "assets/tailwind.config.js",
            "assets/tailwind.config.ts",
            "assets/css/app.css"
          )(fname) or require("lspconfig.util").root_pattern("tailwind.config.js", "tailwind.config.ts")(
            fname
          )
        end,
        init_options = {
          userLanguages = {
            elixir = "html-eex",
            eelixir = "html-eex",
            heex = "html-eex",
          },
        },
        settings = {
          tailwindCSS = {
            experimental = {
              classRegex = {
                'class[:]\\s*"([^"]*)"',
                "class[:]\\s*'([^']*)'",
              },
            },
          },
        },
      },
      emmet_ls = {
        filetypes = {
          "heex",
          "elixir",
        },
        init_options = {
          html = {
            options = {
              -- For possible options, see: https://github.com/emmetio/emmet/blob/master/src/config.ts#L79-L26
              ["bem.enabled"] = true,
            },
          },
        },
      },
    },
    -- Setup functions to enable expert and disable elixirls
    setup = {
      expert = function(_, opts)
        -- Enable expert LSP for Neovim 0.11+
        if vim.fn.has("nvim-0.11") == 1 then
          vim.lsp.enable("expert", true)
        end
        require("lspconfig").expert.setup(opts)
        return true
      end,
      elixirls = function()
        -- Disable elixirls completely
        if vim.fn.has("nvim-0.11") == 1 then
          vim.lsp.enable("elixirls", false)
        end
        return true
      end,
    },
  },
}
