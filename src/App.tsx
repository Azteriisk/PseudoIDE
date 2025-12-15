import { useState, useEffect } from "react";
import DualPaneEditor from "./components/DualPaneEditor";
import ChatBox from "./components/ChatBox";
import SetupModal from "./components/SetupModal";
import FileSidebar from "./components/FileSidebar";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import { Menu, FolderOpen, FolderPlus, ArrowRightLeft, Play } from 'lucide-react';
import ProjectInitModal, { ProjectData } from './components/ProjectInitModal';

import TerminalPanel from "./components/TerminalPanel";

function App() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [pseudocode, setPseudocode] = useState<string>('// Write your pseudocode here...\n\nFUNCTION calculate_fibonacci(n):\n  IF n <= 1 RETURN n\n  RETURN calculate_fibonacci(n-1) + calculate_fibonacci(n-2)');
  const [generatedCode, setGeneratedCode] = useState<string>('# Generated Python code will appear here\n\ndef calculate_fibonacci(n):\n    if n <= 1:\n        return n\n    return calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2)');
  const [generatedLanguage, setGeneratedLanguage] = useState<string>('Python');

  // Sidebar State (starts collapsed as requested)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [projectName, setProjectName] = useState("Testing Grounds");

  // Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(true);

  useEffect(() => {
    checkStatus();
    initTestingGrounds();
  }, []);

  const initTestingGrounds = async () => {
    try {
      const path = await invoke<string>('ensure_testing_grounds');
      setTerminalOutput(prev => prev + `> Initialized Testing Grounds at: ${path}\n`);
      setSidebarRefreshKey(prev => prev + 1);
    } catch (e) {
      console.error("Failed to init testing grounds", e);
      setTerminalOutput(prev => prev + `> Error init testing grounds: ${e}\n`);
    }
  };

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Project Folder"
      });

      if (selected && typeof selected === 'string') {
        await invoke('change_working_directory', { path: selected });
        // Update UI
        setProjectName(selected.split(/[\\/]/).pop() || "Project");
        setSidebarRefreshKey(prev => prev + 1);
        setTerminalOutput(prev => prev + `> Switched to project: ${selected}\n`);
        // Auto-open sidebar on project open? Optional.
        setIsSidebarOpen(true);
      }
    } catch (e) {
      setTerminalOutput(prev => prev + `> Error opening project: ${e}\n`);
    }
  };

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      // Use pseudocode state
      const res = await invoke<{ language: string; code: string }>('generate_code', { prompt: pseudocode });
      setGeneratedCode(res.code);
      // Capitalize first letter strictly for display
      const displayLang = res.language.charAt(0).toUpperCase() + res.language.slice(1);
      setGeneratedLanguage(displayLang);
      setTerminalOutput(prev => prev + `> Transcribed to ${displayLang}\n`);
    } catch (e) {
      console.error(e);
      setTerminalOutput(prev => prev + `> Transcription failed: ${e}\n`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleProjectCreate = async (data: ProjectData) => {
    try {
      const basePath = 'C:/Users/thera/code/Antigravity/PseudoIDE/projects'; // TODO: make dynamic?
      await invoke('init_project', { data, basePath });
      setTerminalOutput(prev => prev + `> Project created: ${data.name}\n`);
      setIsProjectModalOpen(false);

      // Auto-switch to the new project
      const fullPath = `${basePath}/${data.name}`;
      await invoke('change_working_directory', { path: fullPath });

      // Update UI
      setProjectName(data.name);
      setSidebarRefreshKey(prev => prev + 1);
      setTerminalOutput(prev => prev + `> Switched to project: ${data.name}\n`);
      setIsSidebarOpen(true);

    } catch (e) {
      setTerminalOutput(prev => prev + `> Failed to create project: ${e}\n`);
    }
  };

  const checkStatus = async () => {
    try {
      await invoke("load_model");
    } catch (e) {
      // Detect model load failure silently or handle otherwise

      setIsSetupOpen(true);
    }
  };

  const handleRunCode = async () => {
    setIsTerminalOpen(true);
    setIsTerminalCollapsed(false); // Auto-expand on run
    setIsRunningCode(true);

    // Run-time Heuristic Check (Safety Net)
    let targetLanguage = generatedLanguage;
    if (generatedCode.includes('package main') && generatedCode.includes('func main')) targetLanguage = 'Go';
    else if (generatedCode.includes('#include') && generatedCode.includes('int main')) targetLanguage = 'C++';
    else if (generatedCode.includes('fn main') && generatedCode.includes('println!')) targetLanguage = 'Rust';
    else if (generatedCode.includes('def ') && generatedCode.includes(':')) targetLanguage = 'Python';

    // Update state if correction happened
    if (targetLanguage !== generatedLanguage) {
      setGeneratedLanguage(targetLanguage);
    }

    setTerminalOutput(prev => prev + `\n> Saving and Running ${targetLanguage}...\n`);

    try {
      // Save Pseudocode first
      await invoke('write_file', { path: "main.pseudo", content: pseudocode });

      // Execute (Backend will save generated code to main.[ext] and run it)
      const output = await invoke<string>('execute_code', { language: targetLanguage, code: generatedCode });
      setTerminalOutput(prev => prev + output + '\n> Done.\n');

      // Refresh sidebar to show new files
      setSidebarRefreshKey(prev => prev + 1);
    } catch (e) {
      setTerminalOutput(prev => prev + `> Error: ${e}\n`);
    } finally {
      setIsRunningCode(false);
    }
  };

  const handleTerminalCommand = async (cmd: string) => {
    try {
      const output = await invoke<string>('run_terminal_command', { command: cmd });
      setTerminalOutput(prev => prev + output + '\n');
    } catch (e) {
      setTerminalOutput(prev => prev + `Error: ${e}\n`);
    }
  };

  const handleFileSelect = async (path: string, name: string) => {
    try {
      const content = await invoke<string>('read_file', { path });

      if (name.endsWith('.pseudo') || name.endsWith('.txt')) {
        setPseudocode(content);
      } else {
        setGeneratedCode(content);
        // Simple extension mapping
        if (name.endsWith('.py')) setGeneratedLanguage('Python');
        else if (name.endsWith('.js')) setGeneratedLanguage('JavaScript');
        else if (name.endsWith('.ts')) setGeneratedLanguage('TypeScript');
        else if (name.endsWith('.rs')) setGeneratedLanguage('Rust');
        else if (name.endsWith('.cpp')) setGeneratedLanguage('C++');
        else if (name.endsWith('.c')) setGeneratedLanguage('C');
        else if (name.endsWith('.go')) setGeneratedLanguage('Go');
      }
    } catch (e) {
      console.error("Failed to read file", e);
      setTerminalOutput(prev => prev + `> Error reading file: ${e}\n`);
    }
  };

  // Calculate ChatBox offset
  const chatBottomOffset = isTerminalOpen
    ? (isTerminalCollapsed ? 32 + 16 : terminalHeight + 16)
    : 16;

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 flex flex-col">
      <SetupModal isOpen={isSetupOpen} onComplete={() => setIsSetupOpen(false)} />
      <ProjectInitModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSubmit={handleProjectCreate}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {isSidebarOpen && (
          <FileSidebar onFileSelect={handleFileSelect} isOpen={true} refreshKey={sidebarRefreshKey} />
        )}

        <div className="flex-1 flex flex-col min-w-0 bg-zinc-900">
          {/* Top Navigation Bar */}
          <div className="h-16 flex items-center px-4 gap-3 border-b border-black bg-zinc-950 select-none relative">
            {/* Left Group: Sidebar Toggle, New Project, Open Project */}
            <div className="flex items-center gap-2 z-10">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded transition-colors ${isSidebarOpen ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
                title={isSidebarOpen ? "Close Explorer" : "Open Explorer"}
              >
                <Menu size={18} />
              </button>

              <div className="h-6 w-px bg-zinc-800 mx-2" />

              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
                title="New Project"
              >
                <FolderPlus size={16} />
                <span>New Project</span>
              </button>

              <button
                onClick={handleOpenProject}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
                title="Open Project"
              >
                <FolderOpen size={16} />
                <span>Open Project</span>
              </button>
            </div>

            {/* Center Group: Project Name */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 font-medium shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                {projectName}
              </div>
            </div>

            {/* Right Group: Spacer + Actions */}
            <div className="flex-1" /> {/* Push right */}

            <div className="flex items-center gap-3 z-10">
              <button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <ArrowRightLeft size={16} className={isTranscribing ? "animate-spin" : ""} />
                <span>Transcribe</span>
              </button>

              <button
                onClick={handleRunCode}
                disabled={isRunningCode}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isRunningCode ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
                <span>Run</span>
              </button>
            </div>
          </div>

          <div className="flex-1 relative">
            <DualPaneEditor
              pseudocode={pseudocode}
              setPseudocode={setPseudocode}
              generatedCode={generatedCode}
              setGeneratedCode={setGeneratedCode}
              generatedLanguage={generatedLanguage}
              setGeneratedLanguage={setGeneratedLanguage}
              onRunOptions={{ onRun: handleRunCode, isRunning: isRunningCode }}
            />
          </div>
        </div>

        <ChatBox
          pseudocode={pseudocode}
          generatedCode={generatedCode}
          generatedLanguage={generatedLanguage}
          setGeneratedCode={setGeneratedCode}
          setGeneratedLanguage={setGeneratedLanguage}
          bottomOffset={chatBottomOffset}
        />
        <TerminalPanel
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
          output={terminalOutput}
          setOutput={setTerminalOutput}
          isRunning={isRunningCode}
          height={terminalHeight}
          setHeight={setTerminalHeight}
          isCollapsed={isTerminalCollapsed}
          setIsCollapsed={setIsTerminalCollapsed}
          onCommand={handleTerminalCommand}
        />
      </div>
    </div>
  );
}

export default App;
