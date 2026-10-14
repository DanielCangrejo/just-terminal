# PSExplorer shell integration for zsh.
# zsh is started with ZDOTDIR pointing at this directory. Each startup file here
# sources the user's real one (from PSE_USER_ZDOTDIR) and then hands ZDOTDIR back
# to this directory so zsh keeps loading our files in order.

__pse_source_user() {
  local pse_dir="$ZDOTDIR"
  ZDOTDIR="$PSE_USER_ZDOTDIR"
  if [[ -f "$ZDOTDIR/$1" ]]; then
    . "$ZDOTDIR/$1"
  fi
  # The user's file may have changed ZDOTDIR; honour it for the remaining files.
  PSE_USER_ZDOTDIR="$ZDOTDIR"
  ZDOTDIR="$pse_dir"
}

__pse_source_user .zshenv
