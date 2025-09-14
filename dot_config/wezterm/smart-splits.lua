-- ==============================================
-- SMART-SPLITS.NVIM INTEGRATION
-- ==============================================
-- This file provides seamless navigation between Neovim splits and WezTerm panes
-- Requires: smart-splits.nvim plugin in Neovim

local wezterm = require("wezterm")

local M = {}

-- Function to detect if current pane is running Neovim
-- This is the recommended approach if you're NOT lazy-loading smart-splits.nvim
local function is_vim(pane)
  return pane:get_user_vars().IS_NVIM == 'true'
end

-- Direction key mappings
local direction_keys = {
  Left = 'h', Down = 'j', Up = 'k', Right = 'l',
  h = 'Left', j = 'Down', k = 'Up', l = 'Right',
}

-- Create smart navigation function
-- This handles both movement and resizing, seamlessly switching between Neovim and WezTerm
local function smart_split_nav(resize_or_move, key)
  return {
    key = key,
    mods = resize_or_move == 'resize' and 'ALT' or 'CTRL',
    action = wezterm.action_callback(function(win, pane)
      if is_vim(pane) then
        -- If we're in Neovim, send the key to Neovim to handle
        win:perform_action({
          SendKey = { 
            key = key, 
            mods = resize_or_move == 'resize' and 'ALT' or 'CTRL' 
          },
        }, pane)
      else
        -- If we're not in Neovim, handle it with WezTerm
        if resize_or_move == 'resize' then
          win:perform_action({ 
            AdjustPaneSize = { direction_keys[key], 3 } 
          }, pane)
        else
          win:perform_action({ 
            ActivatePaneDirection = direction_keys[key] 
          }, pane)
        end
      end
    end),
  }
end

-- Function to get smart-splits key bindings
function M.get_smart_splits_keys()
  return {
    -- Movement between panes/splits (Ctrl + hjkl)
    smart_split_nav('move', 'h'),
    smart_split_nav('move', 'j'),
    smart_split_nav('move', 'k'),
    smart_split_nav('move', 'l'),
    
    -- Resizing panes/splits (Alt + hjkl)
    smart_split_nav('resize', 'h'),
    smart_split_nav('resize', 'j'),
    smart_split_nav('resize', 'k'),
    smart_split_nav('resize', 'l'),
  }
end

-- Alternative: If you want to use arrow keys for resizing instead
function M.get_smart_splits_keys_with_arrows()
  local keys = {
    -- Movement between panes/splits (Ctrl + hjkl)
    smart_split_nav('move', 'h'),
    smart_split_nav('move', 'j'),
    smart_split_nav('move', 'k'),
    smart_split_nav('move', 'l'),
  }
  
  -- Add arrow keys for resizing
  local resize_keys = {
    { key = 'LeftArrow', direction = 'Left' },
    { key = 'DownArrow', direction = 'Down' },
    { key = 'UpArrow', direction = 'Up' },
    { key = 'RightArrow', direction = 'Right' },
  }
  
  for _, resize_key in ipairs(resize_keys) do
    table.insert(keys, {
      key = resize_key.key,
      mods = 'ALT',
      action = wezterm.action_callback(function(win, pane)
        if is_vim(pane) then
          win:perform_action({
            SendKey = { key = resize_key.key, mods = 'ALT' },
          }, pane)
        else
          win:perform_action({
            AdjustPaneSize = { resize_key.direction, 3 }
          }, pane)
        end
      end),
    })
  end
  
  return keys
end

return M