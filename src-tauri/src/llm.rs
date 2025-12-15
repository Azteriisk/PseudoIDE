use futures_util::StreamExt;
use std::fs::File;
use std::io::Cursor;
use std::io::Write;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use zip::ZipArchive;

pub struct LLMState {
    pub server_process: Mutex<Option<Child>>,
}

const MODEL_URL: &str = "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q5_k_m.gguf";
const MODEL_FILENAME: &str = "qwen2.5-coder-7b-instruct-q5_k_m.gguf";
const SERVER_FILENAME: &str = "llama-server.exe";

#[tauri::command]
pub async fn download_model(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join(MODEL_FILENAME);

    if model_path.exists() {
        return Ok(format!("Model already exists at {:?}", model_path));
    }

    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::new();
    let res = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let total_size = res.content_length().unwrap_or(0);

    let mut file = File::create(&model_path).map_err(|e| e.to_string())?;
    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64) * 100.0;
            let _ = app.emit("model-download-progress", progress);
        }
    }

    Ok(format!("Model downloaded to {:?}", model_path))
}

#[tauri::command]
pub async fn download_server(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let _server_path = app_data_dir.join(SERVER_FILENAME);

    // Force re-download if it's a 0-byte file or we suspect it's wrong
    // if server_path.exists() {
    //     let metadata = std::fs::metadata(&server_path).map_err(|e| e.to_string())?;
    //     if metadata.len() > 0 {
    //          return Ok("Server already exists".to_string());
    //     }
    // }

    // Fetch latest release info
    let client = reqwest::Client::new();
    let release_url = "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest";
    let resp = client
        .get(release_url)
        .header("User-Agent", "PseudoIDE")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    // Find asset for Windows CPU (x64)
    let assets = json["assets"]
        .as_array()
        .ok_or_else(|| "No assets found".to_string())?;
    let asset = assets
        .iter()
        .find(|a| {
            let name = a["name"].as_str().unwrap_or("");
            name.contains("bin-win-cpu-x64") && name.ends_with(".zip")
        })
        .ok_or_else(|| "No suitable Windows binary found in latest release".to_string())?;

    let download_url = asset["browser_download_url"]
        .as_str()
        .ok_or_else(|| "No download URL".to_string())?;

    // Download zip
    let zip_resp = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let bytes = zip_resp.bytes().await.map_err(|e| e.to_string())?;

    // Extract
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;

    let mut found_server = false;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;

        if file.is_dir() {
            continue;
        }

        // Flatten: Extract filename only, ignoring directories in zip
        let file_name = PathBuf::from(file.name());
        let file_name = file_name.file_name().ok_or("Invalid file name")?;
        let outpath = app_data_dir.join(file_name);

        let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;

        if file.name().ends_with("llama-server.exe") {
            found_server = true;
        }
    }

    if !found_server {
        return Err("llama-server.exe not found in the downloaded zip".to_string());
    }

    Ok("Server downloaded and extracted".to_string())
}

#[tauri::command]
pub fn load_model(app: AppHandle, state: State<LLMState>) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join(MODEL_FILENAME);
    let server_path = app_data_dir.join(SERVER_FILENAME);
    let dll_path = app_data_dir.join("llama.dll");

    if !model_path.exists() {
        return Err("Model not found. Please download it.".to_string());
    }
    if !server_path.exists() {
        return Err("Server binary not found. Please download it.".to_string());
    }
    // Critical check: Ensure dependencies are present
    if !dll_path.exists() {
        return Err("Server dependencies (DLLs) not found. Please re-download.".to_string());
    }

    let mut state_proc = state.server_process.lock().unwrap();
    if state_proc.is_some() {
        return Ok("Server already running".to_string());
    }

    // Spawn server
    // llama-server.exe -m model.gguf --port 8080 -c 2048
    let log_path = app_data_dir.join("server.log");
    let log_file = File::create(&log_path).map_err(|e| e.to_string())?;
    let log_file_err = log_file.try_clone().map_err(|e| e.to_string())?;

    let mut command = Command::new(&server_path);
    command
        .arg("-m")
        .arg(&model_path)
        .arg("--port")
        .arg("8080")
        .arg("-c")
        .arg("2048")
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_err));

    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);

    let child = command
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    *state_proc = Some(child);

    Ok(format!(
        "Model loaded (Server started). Logs at {:?}",
        log_path
    ))
}

// Structs for data exchange
#[derive(serde::Serialize)]
pub struct GenerationResponse {
    language: String,
    code: String,
}

#[derive(serde::Deserialize)]
pub struct ChatMessage {
    role: String,
    content: String,
}

// Renaming to avoid conflict if needed, or just standardizing
#[tauri::command]
pub async fn chat_inference(history: Vec<ChatMessage>) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Construct Prompt from History
    let mut full_prompt = String::from("<|im_start|>system\nYou are an expert coding assistant for PseudoIDE. Help the user interactively. Be concise.\n<|im_end|>\n");

    for msg in history {
        full_prompt.push_str(&format!(
            "<|im_start|>{}\n{}\n<|im_end|>\n",
            msg.role, msg.content
        ));
    }
    full_prompt.push_str("<|im_start|>assistant\n");

    let body = serde_json::json!({
        "prompt": full_prompt,
        "n_predict": 512,
        "temperature": 0.7,
        "stop": ["<|im_end|>"]
    });

    let body_str = serde_json::to_string(&body).map_err(|e| e.to_string())?;

    let res = client
        .post("http://127.0.0.1:8080/completion")
        .header("Content-Type", "application/json")
        .body(body_str)
        .send()
        .await
        .map_err(|e| format!("Failed to contact server: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Server error: {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let content = json["content"].as_str().unwrap_or("").to_string();

    Ok(content)
}

#[tauri::command]
pub async fn generate_code(prompt: String) -> Result<GenerationResponse, String> {
    let client = reqwest::Client::new();

    // Construct ChatML prompt for Qwen
    let full_prompt = format!(
        "<|im_start|>system\nYou are an expert coding assistant. Your task is to transcribe the given pseudocode into valid, runnable code in the most appropriate language.\nAnalyze the syntax and style to infer the target language (e.g., Python, JavaScript, Rust).\nOutput result in the format:\n```language\ncode\n```\n<|im_end|>\n<|im_start|>user\n{}\n<|im_end|>\n<|im_start|>assistant\n",
        prompt
    );

    let body = serde_json::json!({
        "prompt": full_prompt,
        "n_predict": 512,
        "temperature": 0.2,
        "stop": ["<|im_end|>"]
    });

    let body_str = serde_json::to_string(&body).map_err(|e| e.to_string())?;

    let res = client
        .post("http://127.0.0.1:8080/completion")
        .header("Content-Type", "application/json")
        .body(body_str)
        .send()
        .await
        .map_err(|e| format!("Failed to contact server: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Server error: {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let content = json["content"].as_str().unwrap_or("").to_string();

    // Parse language and code from content
    // Expected format: ```language\ncode\n```
    let mut language = "text".to_string();
    let mut code = content.clone();

    if let Some(start) = content.find("```") {
        if let Some(end) = content[start + 3..].find("```") {
            let block = &content[start + 3..start + 3 + end];
            if let Some(newline) = block.find('\n') {
                let lang_cand = block[..newline].trim();
                if !lang_cand.is_empty() {
                    language = lang_cand.to_string();
                }
                code = block[newline + 1..].trim().to_string();
            } else {
                code = block.trim().to_string();
            }
        }
    }

    Ok(GenerationResponse { language, code })
}
