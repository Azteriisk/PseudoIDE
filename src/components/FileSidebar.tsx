import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Folder, FileCode, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    children?: FileEntry[];
}

interface FileSidebarProps {
    onFileSelect: (path: string, name: string) => void;
    isOpen: boolean;
    refreshKey: number;
}

const FileTreeItem: React.FC<{ entry: FileEntry, onSelect: (path: string, name: string) => void, level: number }> = ({ entry, onSelect, level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleExpand = async () => {
        if (!entry.is_dir) {
            onSelect(entry.path, entry.name);
            return;
        }

        setIsExpanded(!isExpanded);

        if (!isExpanded && children.length === 0) {
            setIsLoading(true);
            try {
                const entries = await invoke<FileEntry[]>('list_directory', { path: entry.path });
                setChildren(entries);
            } catch (e) {
                console.error("Failed to load directory", e);
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div>
            <div
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-zinc-800 text-zinc-300 text-sm whitespace-nowrap overflow-hidden select-none`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleExpand}
            >
                {entry.is_dir && (
                    <span className="text-zinc-500">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                )}
                {!entry.is_dir && <span className="w-3.5" />} {/* Spacer */}

                {entry.is_dir ? <Folder size={14} className="text-blue-400" /> : <FileCode size={14} className="text-yellow-400" />}
                <span>{entry.name}</span>
            </div>

            {isExpanded && (
                <div>
                    {isLoading && <div className="pl-8 text-xs text-zinc-600">Loading...</div>}
                    {children.map(child => (
                        <FileTreeItem key={child.path} entry={child} onSelect={onSelect} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const FileSidebar: React.FC<FileSidebarProps> = ({ onFileSelect, isOpen, refreshKey }) => {
    const [rootFiles, setRootFiles] = useState<FileEntry[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadRoot = async () => {
        setRefreshing(true);
        try {
            // Empty path = use CWD from backend
            const entries = await invoke<FileEntry[]>('list_directory', { path: "" });
            setRootFiles(entries);
        } catch (e) {
            console.error("Failed to list files:", e);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadRoot();
        }
    }, [isOpen, refreshKey]);

    if (!isOpen) return null;

    return (
        <div className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-950 h-full">
            <div className="flex items-center justify-between p-3 border-b border-zinc-900">
                <span className="text-xs font-bold text-zinc-400">EXPLORER</span>
                <button onClick={loadRoot} className={`text-zinc-500 hover:text-white ${refreshing ? 'animate-spin' : ''}`}>
                    <RefreshCw size={12} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {rootFiles.map(file => (
                    <FileTreeItem key={file.path} entry={file} onSelect={onFileSelect} level={0} />
                ))}
            </div>
        </div>
    );
};

export default FileSidebar;
