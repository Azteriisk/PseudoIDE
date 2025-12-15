import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface SetupModalProps {
    isOpen: boolean;
    onComplete: () => void;
}

const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onComplete }) => {
    const [status, setStatus] = useState<'idle' | 'downloading_model' | 'downloading_server' | 'loading' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        const unlisten = listen<number>('model-download-progress', (event) => {
            setProgress(event.payload);
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [isOpen]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const startSetup = async () => {
        setStatus('downloading_model');
        setError('');
        setProgress(0);
        setLogs([]);

        try {
            addLog("Starting setup...");

            // 1. Download Model
            addLog("Downloading Qwen2.5-Coder-7B (this may take a while)...");
            const modelRes = await invoke<string>('download_model');
            addLog(modelRes);
            setProgress(100);

            // 2. Download Server
            setStatus('downloading_server');
            addLog("Downloading llama-server...");
            const serverRes = await invoke<string>('download_server');
            addLog(serverRes);

            // 3. Load Model
            setStatus('loading');
            addLog("Starting inference server...");
            const loadRes = await invoke<string>('load_model');
            addLog(loadRes);

            addLog("Setup complete!");
            setTimeout(onComplete, 1000);
        } catch (e: any) {
            console.error(e);
            setError(e.toString());
            setStatus('error');
            addLog(`Error: ${e}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-white">First Run Setup</h2>
                    <p className="text-zinc-400">We need to download the LLM and server binary to run locally.</p>
                </div>

                <div className="mb-6 space-y-4 rounded bg-zinc-950 p-4 font-mono text-xs text-zinc-300 h-48 overflow-y-auto border border-zinc-800">
                    {logs.map((log, i) => (
                        <div key={i}>{log}</div>
                    ))}
                    {logs.length === 0 && <div className="text-zinc-600">Logs will appear here...</div>}
                </div>

                {status === 'downloading_model' && (
                    <div className="mb-6">
                        <div className="mb-2 flex justify-between text-sm text-zinc-400">
                            <span>Downloading Model...</span>
                            <span>{progress.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="mb-6 flex items-center gap-2 rounded bg-red-900/20 p-4 text-red-400 border border-red-900/50">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex justify-center">
                    {status === 'idle' || status === 'error' ? (
                        <button
                            onClick={startSetup}
                            className="flex items-center gap-2 rounded bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                        >
                            <Download size={20} />
                            Start Download & Setup
                        </button>
                    ) : (
                        <button disabled className="flex items-center gap-2 rounded bg-zinc-800 px-6 py-3 font-semibold text-zinc-400 cursor-not-allowed">
                            <Loader2 size={20} className="animate-spin" />
                            Setting up...
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SetupModal;
