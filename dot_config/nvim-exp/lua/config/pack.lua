-- Pack management commands
-- vim.pack handles install automatically on startup.
-- These commands give you the rest of the workflow.

-- :PackUpdate - update all plugins
vim.api.nvim_create_user_command("PackUpdate", function()
  vim.pack.update()
end, { desc = "Update all plugins" })

-- :PackUpdateLock - restore exact versions from lockfile
vim.api.nvim_create_user_command("PackUpdateLock", function()
  vim.pack.update({ target = "lockfile" })
end, { desc = "Restore plugins to lockfile versions" })

-- :PackStatus - show all installed plugins
vim.api.nvim_create_user_command("PackStatus", function()
  local plugins = vim.pack.get()
  local lines = { "Installed plugins (" .. #plugins .. "):", "" }
  table.sort(plugins, function(a, b) return a.spec.name < b.spec.name end)
  for _, p in ipairs(plugins) do
    local rev = p.rev and p.rev:sub(1, 8) or "unknown"
    local active = p.active and "+" or "-"
    table.insert(lines, string.format("  %s %-30s %s", active, p.spec.name, rev))
  end
  table.insert(lines, "")
  table.insert(lines, "(+) active  (-) inactive")
  vim.notify(table.concat(lines, "\n"), vim.log.levels.INFO)
end, { desc = "Show installed plugins" })

-- :PackClean - remove plugins not in current config
vim.api.nvim_create_user_command("PackClean", function()
  local registered = {}
  for _, p in ipairs(vim.pack.get()) do
    registered[p.spec.name] = true
  end

  local pack_dir = vim.fn.stdpath("data") .. "/site/pack/core/opt"
  local handle = vim.uv.fs_scandir(pack_dir)
  if not handle then
    vim.notify("No plugins directory found", vim.log.levels.WARN)
    return
  end

  local orphans = {}
  while true do
    local name, typ = vim.uv.fs_scandir_next(handle)
    if not name then break end
    if typ == "directory" and not registered[name] then
      table.insert(orphans, name)
    end
  end

  if #orphans == 0 then
    vim.notify("No orphaned plugins found", vim.log.levels.INFO)
    return
  end

  local msg = "Remove " .. #orphans .. " orphaned plugin(s)?\n\n"
  for _, name in ipairs(orphans) do
    msg = msg .. "  - " .. name .. "\n"
  end

  vim.ui.input({ prompt = msg .. "\nType 'yes' to confirm: " }, function(input)
    if input == "yes" then
      for _, name in ipairs(orphans) do
        local path = pack_dir .. "/" .. name
        vim.fn.delete(path, "rf")
        vim.notify("Removed: " .. name)
      end
    else
      vim.notify("Cancelled", vim.log.levels.INFO)
    end
  end)
end, { desc = "Remove plugins not in config" })

-- Keymap
vim.keymap.set("n", "<leader>pu", "<cmd>PackUpdate<cr>", { desc = "Update Plugins" })
vim.keymap.set("n", "<leader>ps", "<cmd>PackStatus<cr>", { desc = "Plugin Status" })
vim.keymap.set("n", "<leader>pc", "<cmd>PackClean<cr>", { desc = "Clean Unused Plugins" })
vim.keymap.set("n", "<leader>pl", "<cmd>PackUpdateLock<cr>", { desc = "Restore from Lockfile" })

-- Register which-key group
pcall(function()
  require("which-key").add({
    { "<leader>p", group = "plugins" },
  })
end)
