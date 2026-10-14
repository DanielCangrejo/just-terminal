use std::path::Path;

use crate::session::persistence::ShellProfile;

// PowerShell prompt that emits OSC 7. TrimStart('/') keeps the URI well-formed for
// both "C:\dir" on Windows and "/home/dir" when pwsh runs on Linux or macOS.
// Kept on one line: multiline input makes Windows PowerShell show ">>" prompts.
const PS_OSC7_PROMPT: &str = r#"$function:prompt={$p=$ExecutionContext.SessionState.Path.CurrentLocation.Path;[Console]::Write([string][char]27+"]7;file://localhost/"+$p.Replace('\','/').TrimStart('/')+[string][char]7);"PS $p> "}"#;

#[cfg(unix)]
const FISH_OSC7_PROMPT: &str = r#"function __pse_osc7 --on-event fish_prompt; printf '\e]7;file://%s%s\a' $hostname (string replace -a '%' '%25' -- $PWD); end"#;

fn profile(name: &str, executable: &str, args: &[&str]) -> ShellProfile {
    ShellProfile {
        name: name.to_string(),
        executable: executable.to_string(),
        args: args.iter().map(|a| a.to_string()).collect(),
        env: None,
    }
}

fn powershell(name: &str, executable: &str) -> ShellProfile {
    profile(
        name,
        executable,
        &["-NoLogo", "-NoExit", "-Command", PS_OSC7_PROMPT],
    )
}

/// Shells available on this machine. The first entry is the default shell.
#[cfg(windows)]
pub fn detect(_integration_dir: &Path) -> Vec<ShellProfile> {
    let pwsh7 = r"C:\Program Files\PowerShell\7\pwsh.exe";
    let mut shells = Vec::new();
    if Path::new(pwsh7).exists() {
        shells.push(powershell("PowerShell 7", pwsh7));
    }
    shells.push(powershell(
        "PowerShell",
        r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
    ));
    shells.push(profile("CMD", r"C:\Windows\System32\cmd.exe", &[]));
    shells.push(profile("Git Bash", "bash.exe", &["--login", "-i"]));
    shells.push(profile("WSL", "wsl.exe", &[]));
    shells
}

/// Shells available on this machine. The first entry is the default shell:
/// the user's login shell ($SHELL), then any other known shell found on PATH.
#[cfg(unix)]
pub fn detect(integration_dir: &Path) -> Vec<ShellProfile> {
    use std::collections::HashSet;
    use std::path::PathBuf;

    let home = std::env::var("HOME").unwrap_or_default();
    let user_zdotdir = std::env::var("ZDOTDIR").unwrap_or(home);

    let candidates = std::env::var("SHELL")
        .ok()
        .map(PathBuf::from)
        .into_iter()
        .chain(
            ["zsh", "bash", "fish", "pwsh", "sh"]
                .iter()
                .filter_map(|name| find_in_path(name)),
        );

    let mut seen = HashSet::new();
    let mut shells: Vec<ShellProfile> = candidates
        .filter(|exe| is_executable(exe))
        .map(|exe| unix_profile(&exe, integration_dir, &user_zdotdir))
        .filter(|p| seen.insert(p.name.clone()))
        .collect();

    if shells.is_empty() {
        shells.push(profile("sh", "/bin/sh", &[]));
    }
    shells
}

#[cfg(unix)]
fn unix_profile(exe: &Path, integration_dir: &Path, user_zdotdir: &str) -> ShellProfile {
    let executable = exe.to_string_lossy();
    let name = exe
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| executable.to_string());

    match name.as_str() {
        "bash" => {
            let rcfile = integration_dir.join("bash").join("integration.bash");
            profile(
                "bash",
                &executable,
                &["--rcfile", &rcfile.to_string_lossy(), "-i"],
            )
        }
        "zsh" => {
            // macOS terminals conventionally start login shells (~/.zprofile sets PATH).
            let args: &[&str] = if cfg!(target_os = "macos") {
                &["-l", "-i"]
            } else {
                &["-i"]
            };
            let mut zsh = profile("zsh", &executable, args);
            zsh.env = Some(
                [
                    (
                        "ZDOTDIR".to_string(),
                        integration_dir.join("zsh").to_string_lossy().to_string(),
                    ),
                    ("PSE_USER_ZDOTDIR".to_string(), user_zdotdir.to_string()),
                ]
                .into_iter()
                .collect(),
            );
            zsh
        }
        "fish" => profile("fish", &executable, &["-i", "-C", FISH_OSC7_PROMPT]),
        "pwsh" => powershell("PowerShell", &executable),
        _ => profile(&name, &executable, &[]),
    }
}

#[cfg(unix)]
fn find_in_path(name: &str) -> Option<std::path::PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| is_executable(candidate))
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path)
        .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn test_bash_uses_integration_rcfile() {
        let p = unix_profile(Path::new("/bin/bash"), Path::new("/data/si"), "/home/u");
        assert_eq!(p.name, "bash");
        assert_eq!(p.args, vec!["--rcfile", "/data/si/bash/integration.bash", "-i"]);
    }

    #[test]
    fn test_zsh_points_zdotdir_at_integration_dir() {
        let p = unix_profile(Path::new("/usr/bin/zsh"), Path::new("/data/si"), "/home/u");
        let env = p.env.unwrap();
        assert_eq!(env["ZDOTDIR"], "/data/si/zsh");
        assert_eq!(env["PSE_USER_ZDOTDIR"], "/home/u");
    }

    #[test]
    fn test_unknown_shell_has_no_integration() {
        let p = unix_profile(Path::new("/usr/bin/nu"), Path::new("/data/si"), "/home/u");
        assert_eq!(p.name, "nu");
        assert!(p.args.is_empty());
        assert!(p.env.is_none());
    }

    #[test]
    fn test_detect_returns_unique_names() {
        let shells = detect(Path::new("/data/si"));
        assert!(!shells.is_empty());
        let mut names: Vec<_> = shells.iter().map(|s| s.name.clone()).collect();
        names.dedup();
        assert_eq!(names.len(), shells.len());
    }
}
