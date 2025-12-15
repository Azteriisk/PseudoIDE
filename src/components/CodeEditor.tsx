import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
    language: string;
    value: string;
    onChange?: (value: string | undefined) => void;
    readOnly?: boolean;
    theme?: 'vs-dark' | 'light';
}

const CodeEditor: React.FC<CodeEditorProps> = ({
    language,
    value,
    onChange,
    readOnly = false,
    theme = 'vs-dark',
}) => {
    const handleEditorDidMount: OnMount = (editor) => {
        // Configure editor settings here if needed
        editor.updateOptions({
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            padding: { top: 16, bottom: 16 },
        });
    };

    return (
        <div className="h-full w-full overflow-hidden rounded-md border border-gray-700 bg-[#1e1e1e]">
            <Editor
                height="100%"
                defaultLanguage={language}
                language={language}
                value={value}
                theme={theme}
                onChange={onChange}
                onMount={handleEditorDidMount}
                options={{
                    readOnly,
                    wordWrap: 'on',
                    automaticLayout: true,
                }}
            />
        </div>
    );
};

export default CodeEditor;
