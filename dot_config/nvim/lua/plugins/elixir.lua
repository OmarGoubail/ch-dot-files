return {
  {
    "emmanueltouzery/elixir-extras.nvim",
    lazy = true,
    ft = "elixir",
    dependencies = {
      "nvim-telescope/telescope.nvim",
    },
    keys = {
      {
        "<leader>ded",
        function()
          require("elixir-extras").elixir_view_docs({})
        end,
        desc = "Elixir View Docs",
      },
      {
        "<leader>dem",
        function()
          require("elixir-extras").elixir_view_docs({ include_mix_libs = true })
        end,
        desc = "Elixir View Docs (mix libs)",
      },
      {
        "<leader>dec",
        function()
          require("elixir-extras").module_complete()
        end,
        desc = "Elixir Module Complete",
      },
    },
    config = function()
      require("elixir-extras").setup_multiple_clause_gutter()
    end,
  },
}
