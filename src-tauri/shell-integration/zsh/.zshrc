__pse_source_user .zshrc

# Report the CWD to the terminal as OSC 7 on every prompt.
# '%' is percent-encoded because the frontend decodes the path as a URI.
__pse_osc7() {
  printf '\033]7;file://%s%s\007' "${HOST:-localhost}" "${PWD//\%/%25}"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __pse_osc7

# Non-login shells read no more startup files: restore the user's ZDOTDIR now.
if [[ ! -o login ]]; then
  ZDOTDIR="$PSE_USER_ZDOTDIR"
  unset PSE_USER_ZDOTDIR
  unfunction __pse_source_user
fi
