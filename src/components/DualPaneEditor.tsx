import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import CodeEditor from './CodeEditor';

interface DualPaneEditorProps {
    pseudocode: string;
    setPseudocode: (val: string) => void;
    generatedCode: string;
    setGeneratedCode: (val: string) => void;
    generatedLanguage: string;
    setGeneratedLanguage: (val: string) => void;
    onRunOptions?: {
        onRun: () => void;
        isRunning: boolean;
    };
}

const DualPaneEditor: React.FC<DualPaneEditorProps> = ({
    pseudocode,
    setPseudocode,
    generatedCode,
    setGeneratedCode,
    generatedLanguage
}) => {

    // Local state moved to parent

    return (
        <div className="h-screen w-full bg-zinc-900 p-4 text-white pt-2">
            {/* Header Removed - Moved to App Toolbar */}

            <div className="h-full rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden">
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={50} minSize={20}>
                        <div className="flex h-full flex-col">
                            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Pseudocode
                            </div>
                            <div className="flex-1">
                                <CodeEditor
                                    language="markdown"
                                    value={pseudocode}
                                    onChange={(val) => setPseudocode(val || '')}
                                />
                            </div>
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-blue-500 transition-colors" />

                    <Panel defaultSize={50} minSize={20}>
                        <div className="flex h-full flex-col">
                            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                {generatedLanguage} (Generated)
                            </div>
                            <div className="flex-1">
                                <CodeEditor
                                    language={generatedLanguage.toLowerCase()}
                                    value={generatedCode}
                                    onChange={(val) => setGeneratedCode(val || '')}
                                />
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

export default DualPaneEditor;
