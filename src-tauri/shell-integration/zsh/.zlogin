__pse_source_user .zlogin

# .zlogin is the last startup file of a login shell: restore the user's ZDOTDIR.
ZDOTDIR="$PSE_USER_ZDOTDIR"
unset PSE_USER_ZDOTDIR
unfunction __pse_source_user
