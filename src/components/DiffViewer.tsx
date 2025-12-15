import React from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface DiffViewerProps {
    original: string;
    modified: string;
    language: string;
    theme?: 'vs-dark' | 'light';
}

const DiffViewer: React.FC<DiffViewerProps> = ({
    original,
    modified,
    language,
    theme = 'vs-dark',
}) => {
    return (
        <div className="h-full w-full overflow-hidden rounded-md border border-gray-700 bg-[#1e1e1e]">
            <DiffEditor
                height="100%"
                language={language}
                original={original}
                modified={modified}
                theme={theme}
                options={{
                    readOnly: true,
                    renderSideBySide: true,
                }}
            />
        </div>
    );
};

export default DiffViewer;
