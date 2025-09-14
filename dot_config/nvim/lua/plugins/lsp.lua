return {
  "neovim/nvim-lspconfig",
  opts = {
    servers = {
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
  },
}
