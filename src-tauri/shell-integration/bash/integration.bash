# PSExplorer shell integration for bash.
# Loaded via `bash --rcfile <this file> -i`, which replaces ~/.bashrc, so the
# user's own startup file is sourced first to keep their environment intact.

if [ -f "$HOME/.bashrc" ]; then
  . "$HOME/.bashrc"
fi

# Report the CWD to the terminal as OSC 7 on every prompt.
# '%' is percent-encoded because the frontend decodes the path as a URI.
__pse_osc7() {
  printf '\033]7;file://%s%s\007' "${HOSTNAME:-localhost}" "${PWD//%/%25}"
}

if [[ ";${PROMPT_COMMAND:-};" != *";__pse_osc7;"* ]]; then
  PROMPT_COMMAND="__pse_osc7${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
