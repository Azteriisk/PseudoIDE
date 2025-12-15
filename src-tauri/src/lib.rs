// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod commands;
pub mod execution;
mod llm;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(llm::LLMState {
            server_process: Mutex::new(None),
        })
        .manage(execution::AppState {
            cwd: Mutex::new(
                std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")),
            ),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::init_project,
            commands::list_directory,
            commands::read_file,
            llm::download_model,
            llm::download_server,
            llm::load_model,
            llm::generate_code,
            llm::chat_inference,
            execution::execute_code,
            execution::run_terminal_command,
            execution::change_working_directory,
            execution::ensure_testing_grounds,
            execution::write_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<llm::LLMState>();
                let mut process = state.server_process.lock().unwrap();
                if let Some(mut child) = process.take() {
                    let _ = child.kill();
                }
            }
        });
}
