use serde::{Deserialize, Serialize};
use std::path::Path;

use std::fs;

#[derive(Serialize, Deserialize, Debug)]
pub struct ProjectData {
    pub name: String,
    pub description: String,
    pub intent: String,
    pub requirements: String,
}

#[tauri::command]
pub fn init_project(data: ProjectData, base_path: String) -> Result<String, String> {
    let project_path = Path::new(&base_path).join(&data.name);

    if project_path.exists() {
        return Err(format!(
            "Project directory already exists: {:?}",
            project_path
        ));
    }

    fs::create_dir_all(&project_path).map_err(|e| e.to_string())?;

    // Init git using CLI
    let output = std::process::Command::new("git")
        .arg("init")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git init: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git init failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Create README
    let readme_content = format!(
        "# {}\n\n{}\n\n## Intent\n{}\n\n## Requirements\n{}",
        data.name, data.description, data.intent, data.requirements
    );

    fs::write(project_path.join("README.md"), readme_content).map_err(|e| e.to_string())?;

    Ok(format!("Project initialized at {:?}", project_path))
}

use crate::execution::AppState;
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn list_directory(path: String, state: State<'_, AppState>) -> Result<Vec<FileEntry>, String> {
    let cwd = state.cwd.lock().map_err(|e| e.to_string())?;

    let target_path = if path.is_empty() {
        cwd.clone()
    } else {
        std::path::PathBuf::from(path)
    };

    let mut entries = fs::read_dir(&target_path)
        .map_err(|e| format!("Failed to read dir: {}", e))?
        .filter_map(|res| res.ok())
        .map(|dir_entry| {
            let path_buf = dir_entry.path();
            let is_dir = path_buf.is_dir();
            let name = dir_entry.file_name().to_string_lossy().to_string();
            // simple check to hide .git or other system files if we want, but keeping it raw for now
            FileEntry {
                name,
                path: path_buf.to_string_lossy().to_string(),
                is_dir,
            }
        })
        .collect::<Vec<_>>();

    // Sort: Directories first, then files
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else {
            b.is_dir.cmp(&a.is_dir)
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}
