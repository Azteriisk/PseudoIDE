import React, { useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ChatBoxProps {
    pseudocode: string;
    generatedCode: string;
    generatedLanguage: string;
    setGeneratedCode: (code: string) => void;
    setGeneratedLanguage: (lang: string) => void;
    bottomOffset?: number;
}

const ChatBox: React.FC<ChatBoxProps> = ({
    pseudocode,
    generatedCode,
    generatedLanguage,
    setGeneratedCode,
    setGeneratedLanguage,
    bottomOffset = 16
}) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Hello! I am ready to help you convert your pseudocode to code.' }
    ]);
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(true);
    const [isThinking, setIsThinking] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input
        };

        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);
        setInput('');
        setIsThinking(true);

        try {
            // Inject context as a system message at the start of the history for the LLM
            const historyForBackend = [
                { role: 'system', content: `Current Editor Context:\n\nPSEUDOCODE:\n${pseudocode}\n\nGENERATED CODE (${generatedLanguage}):\n${generatedCode}\n\nUser Question: ${input}` },
                ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
            ];

            const response = await invoke<string>('chat_inference', {
                history: historyForBackend
            });

            // Parse response for code blocks
            let finalContent = response;
            // Updated regex to handle languages like c++, c#, etc.
            // Updated regex to handle languages like c++, c#, etc. and potential whitespace
            const codeBlockRegex = /```\s*([a-zA-Z0-9+#-]*)\s*\n([\s\S]*?)```/;
            const match = response.match(codeBlockRegex);

            if (match) {
                let langField = match[1].trim().toLowerCase();
                const codeContent = match[2];

                // Heuristic Detection if lang tag is missing
                if (!langField) {
                    if (codeContent.includes('package main') && codeContent.includes('func main')) langField = 'go';
                    else if (codeContent.includes('#include') && codeContent.includes('int main')) langField = 'c++'; // or c
                    else if (codeContent.includes('fn main') && codeContent.includes('println!')) langField = 'rust';
                    else if (codeContent.includes('def ') && codeContent.includes(':')) langField = 'python';
                    else if (codeContent.includes('console.log') || codeContent.includes('const ') || codeContent.includes('let ')) langField = 'javascript';
                }

                // Normalize language for App state
                if (langField === 'go' || langField === 'golang') langField = 'Go';
                else if (langField === 'py' || langField === 'python') langField = 'Python';
                else if (langField === 'js' || langField === 'javascript') langField = 'JavaScript';
                else if (langField === 'ts' || langField === 'typescript') langField = 'TypeScript';
                else if (langField === 'rs' || langField === 'rust') langField = 'Rust';
                else if (langField === 'cpp' || langField === 'c++') langField = 'C++';
                else if (langField === 'c') langField = 'C';
                else if (langField) {
                    // Fallback capitalize
                    langField = langField.charAt(0).toUpperCase() + langField.slice(1);
                }

                // Update editor
                setGeneratedCode(codeContent);
                if (langField) {
                    setGeneratedLanguage(langField);
                }

                // Remove code from chat message
                finalContent = response.replace(codeBlockRegex, '').trim();
                // If the message was JUST the code, replace it with a confirmation
                if (!finalContent) {
                    finalContent = "I've updated the editor with the requested code.";
                }
            }

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: finalContent
            }]);
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Error communicating with AI: ' + e
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{ bottom: `${bottomOffset}px`, right: '1rem' }}
                className="fixed flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all duration-200 z-50"
            >
                <MessageSquare size={24} />
            </button>
        );
    }

    return (
        <div
            style={{ bottom: `${bottomOffset}px`, right: '1rem' }}
            className="fixed flex h-[500px] w-80 flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl transition-all duration-200 z-50"
        >
            <div className="flex items-center justify-between border-b border-zinc-800 p-3">
                <h3 className="font-semibold text-white">Assistant</h3>
                <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
                    <span className="sr-only">Close</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 text-zinc-200'
                                }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-800 text-zinc-400 text-xs rounded-lg px-3 py-2 animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
            </div>

            <div className="border-t border-zinc-800 p-3">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask a question..."
                        disabled={isThinking}
                        className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isThinking}
                        className="flex items-center justify-center rounded bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatBox;
