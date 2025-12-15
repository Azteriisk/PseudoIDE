# PseudoIDE v0.1.1 - Initial Release 🚀

**Bridging the gap between thought and code.**

This is the first official release of **PseudoIDE**, a local AI-powered development environment that allows you to write in pseudocode and compile it to real, executable languages.

## 🌟 Key Features
*   **Pseudocode-to-Code**: Write in natural language, and let the local AI transcribe it to **Python**, **JavaScript**, **Go**, **Rust**, or **C/C++**.
*   **Local AI Inference**: Powered by **Qwen 2.5** running locally via `llama.cpp`. No internet required after initial model download.
*   **Integrated Playground**: Run your generated code instantly in the built-in terminal.
*   **Interactive Shell**: Supports standard input (stdin) for interactive programs.
*   **Project Management**: Persistent project workspaces saved to `~/PseudoIDE/projects`.
*   **Dual-Pane Editor**: Visualizes the translation from Logic -> Implementation.

## 🛠️ Fixes & Improvements
*   **Installer**: Standalone Windows installer (`.exe`) with auto-bootstrapping for WebView2.
*   **Silent Execution**: AI server and code execution now run silently in the background (no separate console windows).
*   **Go Support**: Fixed execution issues with Go binaries.
*   **Directory Structure**: Standardized workspace and testing grounds paths.

## 📦 Installation
1.  Download `PseudoIDE_0.1.1_x64-setup.exe`.
2.  Run the installer.
3.  **On First Launch**: The app will automatically download the required AI model (~4GB) and Inference Server. Please be patient during this one-time setup.

## 🤝 Requirements
*   Windows 10/11 x64
*   ~8GB RAM recommended for local model inference.
