use anyhow::Result;
use std::fs;
use std::path::{Path, PathBuf};

// Startup scripts that make POSIX shells report their CWD via OSC 7.
// Embedded at compile time and written to the app data dir on launch, so the
// installed app never depends on files next to the binary.
const SCRIPTS: &[(&str, &str)] = &[
    (
        "bash/integration.bash",
        include_str!("../../shell-integration/bash/integration.bash"),
    ),
    (
        "zsh/.zshenv",
        include_str!("../../shell-integration/zsh/.zshenv"),
    ),
    (
        "zsh/.zprofile",
        include_str!("../../shell-integration/zsh/.zprofile"),
    ),
    (
        "zsh/.zshrc",
        include_str!("../../shell-integration/zsh/.zshrc"),
    ),
    (
        "zsh/.zlogin",
        include_str!("../../shell-integration/zsh/.zlogin"),
    ),
];

/// Writes the shell integration scripts under `app_data_dir` and returns their root.
/// Files are rewritten on every launch so an app update always ships fresh scripts.
pub fn install(app_data_dir: &Path) -> Result<PathBuf> {
    let root = app_data_dir.join("shell-integration");
    for (relative, contents) in SCRIPTS {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&path, contents)?;
    }
    Ok(root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_install_writes_all_scripts() {
        let dir = TempDir::new().unwrap();
        let root = install(dir.path()).unwrap();
        for (relative, contents) in SCRIPTS {
            assert_eq!(fs::read_to_string(root.join(relative)).unwrap(), *contents);
        }
    }
}
