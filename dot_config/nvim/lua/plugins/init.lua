-- Plugin loader: installs via vim.pack, then configures
-- On first launch, plugins are cloned. You may need to :restart after.

local function load(mod)
  local ok, err = pcall(require, mod)
  if not ok then
    vim.notify("Failed to load " .. mod .. ": " .. err, vim.log.levels.WARN)
  end
end

load("plugins.ui")
load("plugins.editor")
load("plugins.coding")
load("plugins.git")
load("plugins.tools")
load("plugins.lsp") -- LSP last: needs mason + treesitter loaded first
