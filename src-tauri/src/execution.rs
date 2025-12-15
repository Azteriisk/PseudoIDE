use std::io::Write;
use std::process::Command;

#[tauri::command]
pub async fn execute_code(
    language: String,
    code: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let cwd = state.cwd.lock().map_err(|e| e.to_string())?.clone();
    let ext: &str;
    let cmd: &str;
    let mut args: Vec<&str> = vec![];

    // Simple routing based on language
    match language.to_lowercase().as_str() {
        "python" => {
            ext = "py";
            cmd = "python";
        }
        "javascript" | "typescript" => {
            ext = "js";
            cmd = "node";
        }
        "c++" | "cpp" => {
            ext = "cpp";
            cmd = "g++"; // Requires separate compile/run steps
        }
        "c" => {
            ext = "c";
            cmd = "gcc";
        }
        "rust" => {
            ext = "rs";
            cmd = "rustc";
        }
        "go" | "golang" => {
            ext = "go";
            cmd = "go";
            args.push("run");
        }
        _ => return Err(format!("Unsupported language for execution: {}", language)),
    }

    // 1. Write current code to a file in CWD
    let file_name = format!("main.{}", ext);
    let file_path = cwd.join(&file_name);

    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(code.as_bytes()).map_err(|e| e.to_string())?;

    // 2. Execute
    let output = if language.to_lowercase() == "c++"
        || language.to_lowercase() == "cpp"
        || language.to_lowercase() == "c"
        || language.to_lowercase() == "rust"
    {
        // Compiled languages: Compile then Run
        #[cfg(target_os = "windows")]
        let exe_name = "main.exe";
        #[cfg(not(target_os = "windows"))]
        let exe_name = "main";

        let exe_path = cwd.join(exe_name);

        // Compile
        let compile_output = Command::new(cmd)
            .arg(&file_path)
            .arg("-o")
            .arg(&exe_path)
            .current_dir(&cwd) // Run compiler in CWD
            .output()
            .map_err(|e| format!("Failed to run compiler: {}", e))?;

        if !compile_output.status.success() {
            return Ok(String::from_utf8_lossy(&compile_output.stderr).to_string());
        }

        // Run
        Command::new(&exe_path)
            .current_dir(&cwd)
            .output()
            .map_err(|e| format!("Failed to run executable: {}", e))?
    } else {
        // Interpreted languages (Python, Node, Go Run)
        // For Go run, we simply pass the filename
        // Python/Node also take the filename
        args.push(file_name.as_str());

        Command::new(cmd)
            .args(&args)
            .current_dir(&cwd)
            .output()
            .map_err(|e| format!("Failed to execute command: {}", e))?
    };

    // 3. Collect Output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stderr.is_empty() {
        Ok(format!("{}\n{}", stdout, stderr))
    } else {
        Ok(stdout.to_string())
    }
}

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub cwd: Mutex<PathBuf>,
}

#[tauri::command]
pub async fn run_terminal_command(
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut cwd = state.cwd.lock().map_err(|e| e.to_string())?;

    // Handle "cd" command manually
    let trimmed = command.trim();
    if trimmed.starts_with("cd ") || trimmed == "cd" {
        let path_str = if trimmed == "cd" {
            // Default to Home if just "cd" (or could be nothing, but let's say home)
            // On Windows, USERPROFILE. On Unix, HOME.
            dirs::home_dir()
                .unwrap_or(PathBuf::from("."))
                .to_string_lossy()
                .to_string()
        } else {
            trimmed[3..].trim().to_string()
        };

        let new_path = if path_str == "~" {
            dirs::home_dir().unwrap_or(PathBuf::from("."))
        } else {
            cwd.join(&path_str)
        };

        // Canonicalize to resolve .. and symlinks
        match std::fs::canonicalize(&new_path) {
            Ok(p) => {
                *cwd = p;
                return Ok(String::new()); // No output for successful cd
            }
            Err(e) => {
                return Ok(format!("cd: {}: {}", path_str, e));
            }
        }
    }

    // Execute command in the current CWD
    #[cfg(target_os = "windows")]
    let (shell, arg) = ("powershell", "-NoProfile");
    #[cfg(not(target_os = "windows"))]
    let (shell, arg) = ("sh", "-c");

    // Construct command
    // Windows PowerShell: powershell -NoProfile -Command "Get-Location"
    // Unix: sh -c "pwd"

    let mut cmd = Command::new(shell);

    #[cfg(target_os = "windows")]
    cmd.args(&[arg, "-Command", &command]);

    #[cfg(not(target_os = "windows"))]
    cmd.args(&[arg, &command]);

    let output = cmd
        .current_dir(&*cwd)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stderr.is_empty() {
        Ok(format!("{}\n{}", stdout, stderr))
    } else {
        Ok(stdout.to_string())
    }
}

#[tauri::command]
pub fn change_working_directory(
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut cwd = state.cwd.lock().map_err(|e| e.to_string())?;
    let new_path = PathBuf::from(&path);

    if !new_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    // Validate it's a directory
    if !new_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    *cwd = new_path;
    Ok("CWD Updated".to_string())
}

#[tauri::command]
pub fn ensure_testing_grounds(state: State<'_, AppState>) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let tg_path = home.join("PseudoIDE_Testing_Grounds");

    if !tg_path.exists() {
        std::fs::create_dir_all(&tg_path).map_err(|e| e.to_string())?;
    }

    // Set CWD to this valid path
    let mut cwd = state.cwd.lock().map_err(|e| e.to_string())?;
    *cwd = tg_path.clone();

    Ok(tg_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String, state: State<'_, AppState>) -> Result<(), String> {
    let cwd = state.cwd.lock().map_err(|e| e.to_string())?;
    let file_path = if std::path::Path::new(&path).is_absolute() {
        std::path::PathBuf::from(&path)
    } else {
        cwd.join(&path)
    };

    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}
