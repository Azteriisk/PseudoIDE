import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';

interface ProjectInitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: ProjectData) => void;
}

export interface ProjectData {
    name: string;
    description: string;
    intent: string;
    requirements: string;
}

const ProjectInitModal: React.FC<ProjectInitModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [formData, setFormData] = useState<ProjectData>({
        name: '',
        description: '',
        intent: '',
        requirements: '',
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                        <FolderPlus className="text-blue-500" />
                        New Project
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-300">Project Name *</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., MyAwesomeApp"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-300">Description</label>
                        <textarea
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            placeholder="What does this project do?"
                            rows={2}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-300">Intent</label>
                        <textarea
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            placeholder="Problem statement & audience"
                            rows={2}
                            value={formData.intent}
                            onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-300">Requirements</label>
                        <textarea
                            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            placeholder="Constraints (e.g., no external APIs)"
                            rows={2}
                            value={formData.requirements}
                            onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectInitModal;
