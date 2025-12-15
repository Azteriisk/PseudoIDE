import React, { useEffect, useRef, useState } from 'react';
import { X, Terminal as TerminalIcon, ChevronUp, ChevronDown } from 'lucide-react';

interface TerminalPanelProps {
    isOpen: boolean;
    onClose: () => void;
    output: string;
    setOutput: (out: string) => void;
    isRunning: boolean;
    height: number;
    setHeight: (h: number) => void;
    isCollapsed: boolean;
    setIsCollapsed: (c: boolean) => void;
    onCommand: (cmd: string) => Promise<void>;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({
    isOpen,
    onClose,
    output,
    setOutput,
    isRunning,
    height,
    setHeight,
    isCollapsed,
    setIsCollapsed,
    onCommand
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [output]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing) {
                const newHeight = window.innerHeight - e.clientY;
                if (newHeight > 30 && newHeight < window.innerHeight - 100) {
                    setHeight(newHeight);
                }
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, setHeight]);

    if (!isOpen) return null;

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const cmd = inputValue.trim();
            if (!cmd) return;

            setCommandHistory(prev => [...prev, cmd]);
            setHistoryIndex(-1);
            setInputValue('');

            // Echo command
            setOutput(output + `\n$ ${cmd}\n`);

            await onCommand(cmd);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setInputValue(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
                if (historyIndex === commandHistory.length - 1) {
                    setHistoryIndex(-1);
                    setInputValue('');
                } else {
                    setHistoryIndex(newIndex);
                    setInputValue(commandHistory[newIndex]);
                }
            }
        }
    };

    return (
        <div
            style={{ height: isCollapsed ? '32px' : `${height}px` }}
            className={`fixed bottom-0 left-0 right-0 border-t border-zinc-700 bg-black font-mono text-sm text-zinc-300 shadow-2xl z-40 transition-all duration-75 ${isResizing ? 'transition-none select-none' : ''}`}
        >
            <div
                className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500/50 z-50"
                onMouseDown={handleMouseDown}
            />

            <div
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    setIsCollapsed(!isCollapsed);
                }}
                className="flex h-8 items-center justify-between bg-zinc-900 px-4 select-none cursor-pointer hover:bg-zinc-800"
            >
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                    <TerminalIcon size={14} />
                    <span>TERMINAL</span>
                    {isRunning && <span className="animate-pulse text-blue-400">• Running...</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button className="text-zinc-500 hover:text-zinc-300">
                        {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div
                className={`h-full overflow-y-auto p-4 pb-2 whitespace-pre-wrap ${isCollapsed ? 'hidden' : 'flex flex-col'}`}
                style={{ height: 'calc(100% - 32px)' }}
            >
                <div className="flex-1">
                    {output || <span className="text-zinc-600 italic">No output yet...</span>}
                    <div ref={bottomRef} />
                </div>
                <div className="flex items-center gap-2 border-t border-zinc-800 pt-2 mt-2">
                    <span className="text-blue-500">$</span>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-zinc-300 placeholder-zinc-700"
                        placeholder="Type a command..."
                        autoFocus
                    />
                </div>
            </div>
        </div>
    );
};

export default TerminalPanel;
