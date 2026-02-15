'use client';

import { useEffect, useState, useRef, forwardRef } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { Plus, Link as LinkIcon, FileText, Upload, Trash2, UserPlus } from 'lucide-react';

interface Source {
    id: string;
    title: string;
    url?: string;
    fileUrl?: string;
    createdAt: string;
}

/** For text files: character offsets and selected text, so we can highlight and link annotations */
interface AnnotationPosition {
    startOffset?: number;
    endOffset?: number;
    selectedText?: string;
}

interface Annotation {
    id: string;
    sourceId: string;
    userId: string;
    content: string;
    position: AnnotationPosition | null;
    createdAt: string;
    user?: { id: string; name: string };
}

interface Vault {
    id: string;
    name: string;
    description: string;
    users: any[];
}

interface VaultMember {
    userId: string;
    name: string;
    email: string;
    role: string;
    joinedAt: string;
}

/** Renders .txt content with annotation highlights; selection is captured by parent via ref + onMouseUp */
const TextFileViewer = forwardRef<HTMLDivElement, {
    content: string;
    annotations: Annotation[];
    onMouseUp: () => void;
}>(({ content, annotations, onMouseUp }, ref) => {
    const withPosition = annotations
        .filter((a): a is Annotation & { position: AnnotationPosition } => {
            const p = a.position as AnnotationPosition | null;
            return p != null && typeof p.startOffset === 'number' && typeof p.endOffset === 'number';
        })
        .sort((a, b) => (a.position.startOffset ?? 0) - (b.position.startOffset ?? 0));

    const segments: Array<{ type: 'text' | 'highlight'; start: number; end: number; annotationId?: string }> = [];
    let last = 0;
    for (const a of withPosition) {
        const start = a.position.startOffset!;
        const end = Math.min(a.position.endOffset!, content.length);
        if (start > last) segments.push({ type: 'text', start: last, end: start });
        if (end > start) segments.push({ type: 'highlight', start, end, annotationId: a.id });
        last = Math.max(last, end);
    }
    if (last < content.length) segments.push({ type: 'text', start: last, end: content.length });

    return (
        <div
            ref={ref}
            onMouseUp={onMouseUp}
            className="p-4 text-sm font-mono whitespace-pre-wrap select-text bg-white min-h-full text-gray-900"
        >
            {segments.map((seg, i) =>
                seg.type === 'text' ? (
                    <span key={i}>{content.slice(seg.start, seg.end)}</span>
                ) : (
                    <mark key={i} className="bg-amber-200/80 rounded px-0.5" data-annotation-id={seg.annotationId}>
                        {content.slice(seg.start, seg.end)}
                    </mark>
                )
            )}
        </div>
    );
});
TextFileViewer.displayName = 'TextFileViewer';

export default function VaultPage() {
    const params = useParams();
    const vaultId = params.id as string;
    const { user } = useAuth();
    const [vault, setVault] = useState<Vault | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [activeSource, setActiveSource] = useState<Source | null>(null);

    // Create Source State
    const [showAddSource, setShowAddSource] = useState(false);
    const [sourceUrl, setSourceUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    const [activeUsers, setActiveUsers] = useState<any[]>([]);

    // Presigned URL for viewing private S3 PDFs (avoids Access Denied)
    const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
    const [pdfViewError, setPdfViewError] = useState<string | null>(null);

    // Annotations for the active source
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [annotationNote, setAnnotationNote] = useState('');
    const [addingAnnotation, setAddingAnnotation] = useState(false);
    /** When user selects text in a .txt file, we store it so "Annotate selection" can use it */
    const [pendingSelection, setPendingSelection] = useState<{ startOffset: number; endOffset: number; selectedText: string } | null>(null);

    // Text file content (for .txt sources we fetch and render so we can select + highlight)
    const [textFileContent, setTextFileContent] = useState<string | null>(null);
    const [textFileLoading, setTextFileLoading] = useState(false);
    const [textFileError, setTextFileError] = useState<string | null>(null);

    // Share vault: members list + invite by email
    const [showSharePanel, setShowSharePanel] = useState(false);
    const [members, setMembers] = useState<VaultMember[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'VIEWER' | 'CONTRIBUTOR'>('VIEWER');
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviting, setInviting] = useState(false);

    const textViewerRef = useRef<HTMLDivElement>(null);

    const socket = getSocket();

    const isTextFile = (source: Source | null) =>
        !!source?.fileUrl && (source.title?.toLowerCase().endsWith('.txt') || source.fileUrl.toLowerCase().includes('.txt'));

    // When viewing a PDF source, fetch a temporary presigned view URL
    useEffect(() => {
        if (!activeSource?.fileUrl) {
            setPdfViewUrl(null);
            setPdfViewError(null);
            return;
        }
        let cancelled = false;
        setPdfViewError(null);
        api.post<{ viewUrl: string }>('/upload/view-url', { fileUrl: activeSource.fileUrl })
            .then(({ data }) => {
                if (!cancelled) setPdfViewUrl(data.viewUrl);
            })
            .catch(() => {
                if (!cancelled) {
                    setPdfViewUrl(null);
                    setPdfViewError('Could not load PDF');
                }
            });
        return () => { cancelled = true; };
    }, [activeSource?.fileUrl]);

    // For .txt files: fetch raw content so we can render selectable text and link annotations
    useEffect(() => {
        if (!activeSource?.fileUrl || !isTextFile(activeSource)) {
            setTextFileContent(null);
            setTextFileError(null);
            return;
        }
        let cancelled = false;
        setTextFileLoading(true);
        setTextFileError(null);
        setTextFileContent(null);
        api.post<{ viewUrl: string }>('/upload/view-url', { fileUrl: activeSource.fileUrl })
            .then(({ data }) => fetch(data.viewUrl))
            .then((r) => (cancelled ? null : r.text()))
            .then((text) => {
                if (!cancelled) setTextFileContent(text ?? '');
            })
            .catch(() => {
                if (!cancelled) setTextFileError('Could not load text file');
            })
            .finally(() => {
                if (!cancelled) setTextFileLoading(false);
            });
        return () => { cancelled = true; };
    }, [activeSource?.id, activeSource?.fileUrl]);

    // Fetch annotations when active source changes; clear selection when switching source
    useEffect(() => {
        setPendingSelection(null);
        if (!activeSource?.id) {
            setAnnotations([]);
            return;
        }
        api.get<Annotation[]>(`/annotations?sourceId=${activeSource.id}`)
            .then(({ data }) => setAnnotations(data))
            .catch(() => setAnnotations([]));
    }, [activeSource?.id]);

    // Fetch vault members when Share panel is opened
    useEffect(() => {
        if (!showSharePanel || !vaultId) return;
        api.get<VaultMember[]>(`/vaults/${vaultId}/members`)
            .then(({ data }) => setMembers(data))
            .catch(() => setMembers([]));
    }, [showSharePanel, vaultId]);

    useEffect(() => {
        if (user && vaultId) {
            fetchVaultDetails();
            fetchSources();

            // Socket Connection
            socket.connect();
            socket.emit('join_vault', vaultId, user);

            socket.on('source_added', (newSource: Source) => {
                setSources((prev) => [newSource, ...prev]);
            });

            // Presence Events
            socket.on('user_joined', (newUser: any) => {
                console.log('User joined:', newUser);
                setActiveUsers((prev) => {
                    if (prev.find(u => u.id === newUser.id)) return prev;
                    return [...prev, newUser];
                });
            });

            socket.on('user_left', (leftUser: any) => {
                console.log('User left:', leftUser);
                setActiveUsers((prev) => prev.filter(u => u.id !== leftUser.id));
            });

            return () => {
                socket.emit('leave_vault', vaultId, user);
                socket.off('source_added');
                socket.off('user_joined');
                socket.off('user_left');
                socket.disconnect();
            };
        }
    }, [vaultId, user]);

    const fetchVaultDetails = async () => {
        try {
            // We might need a specific endpoint for single vault details or just filter from getVaults
            // For now, assuming we can get the vault details from the list or a new endpoint. 
            // Let's use the list for now if strictly following previous implementation, 
            // but ideally we need GET /api/vaults/:id. 
            // Since I didn't implement GET /:id, I'll fetch all and find (inefficient but works for hackathon)
            // OR better, I'll rely on the sources call to confirm access and just show the ID for now if name isn't critical immediately,
            // BUT for a good UX we need the name.
            // Let's just quick-add a GET /:id endpoint on the backend if needed, or just fetch all.
            // Fetching all for now.
            const { data } = await api.get('/vaults');
            const v = data.find((v: any) => v.id === vaultId);
            if (v) setVault(v);
        } catch (e) {
            console.error("Failed to fetch vault", e);
        }
    };

    const fetchSources = async () => {
        try {
            const { data } = await api.get(`/sources?vaultId=${vaultId}`);
            setSources(data);
            if (data.length > 0) setActiveSource(data[0]);
        } catch (error) {
            console.error('Failed to fetch sources', error);
        }
    };

    const handleAddAnnotation = async (e: React.FormEvent, positionOverride?: { startOffset: number; endOffset: number; selectedText: string } | null) => {
        e.preventDefault();
        if (!activeSource?.id || !annotationNote.trim()) return;
        setAddingAnnotation(true);
        const position = positionOverride ?? null;
        try {
            await api.post('/annotations', {
                sourceId: activeSource.id,
                content: annotationNote.trim(),
                position: position ?? undefined,
            });
            setAnnotationNote('');
            setPendingSelection(null);
            const { data } = await api.get<Annotation[]>(`/annotations?sourceId=${activeSource.id}`);
            setAnnotations(data);
        } catch (error) {
            console.error('Failed to add annotation', error);
        } finally {
            setAddingAnnotation(false);
        }
    };

    /** Get character offset of (node, offset) within container (walk text nodes in order) */
    const getGlobalOffset = (container: Node, targetNode: Node, targetOffset: number): number => {
        let index = 0;
        const walk = (node: Node): boolean => {
            if (node === targetNode) {
                index += targetOffset;
                return true;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                index += (node.textContent?.length ?? 0);
                return false;
            }
            for (let i = 0; i < node.childNodes.length; i++) {
                if (walk(node.childNodes[i])) return true;
            }
            return false;
        };
        walk(container);
        return index;
    };

    /** Capture current selection in the text viewer into pendingSelection (for "Annotate selection") */
    const captureSelection = () => {
        const sel = window.getSelection();
        const container = textViewerRef.current;
        if (!sel || sel.isCollapsed || !container || !container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) {
            setPendingSelection(null);
            return;
        }
        const start = getGlobalOffset(container, sel.anchorNode!, sel.anchorOffset);
        const end = getGlobalOffset(container, sel.focusNode!, sel.focusOffset);
        const [startOffset, endOffset] = start <= end ? [start, end] : [end, start];
        const selectedText = sel.toString().trim();
        if (!selectedText) {
            setPendingSelection(null);
            return;
        }
        setPendingSelection({ startOffset, endOffset, selectedText });
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !vaultId) return;
        setInviteError(null);
        setInviting(true);
        try {
            await api.post(`/vaults/${vaultId}/invite`, {
                email: inviteEmail.trim(),
                role: inviteRole,
            });
            const { data } = await api.get<VaultMember[]>(`/vaults/${vaultId}/members`);
            setMembers(data);
            setInviteEmail('');
        } catch (err) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                : null;
            setInviteError(msg || 'Failed to invite');
        } finally {
            setInviting(false);
        }
    };

    const handleAddUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/sources', {
                vaultId,
                url: sourceUrl,
            });
            setSourceUrl('');
            setShowAddSource(false);
        } catch (error) {
            console.error('Failed to add source', error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // 1. Get Presigned URL
            const { data: presignData } = await api.post('/upload/presigned-url', {
                fileName: file.name,
                fileType: file.type,
            });

            if (!presignData?.uploadUrl || !presignData?.fileUrl) {
                throw new Error('Server did not return upload URL');
            }

            // 2. Upload to S3
            const putRes = await fetch(presignData.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type,
                },
            });

            if (!putRes.ok) {
                const text = await putRes.text();
                throw new Error(`S3 upload failed (${putRes.status}): ${text || putRes.statusText}`);
            }

            // 3. Create Source in Backend
            const { data: newSource } = await api.post('/sources', {
                vaultId,
                title: file.name,
                fileUrl: presignData.fileUrl,
            });

            setShowAddSource(false);
            // Refresh list but ensure we stay on the new source
            await fetchSources();
            setActiveSource(newSource);
        } catch (err) {
            const ax = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string; hint?: string } } }) : null;
            let msg = ax?.response?.data?.error ?? ax?.response?.data?.hint ?? (err instanceof Error ? err.message : 'Upload failed');
            // "Failed to fetch" usually means network/CORS – often S3 CORS for the PUT
            if (typeof msg === 'string' && (msg.includes('fetch') || msg === 'Network Error')) {
                msg = 'Network error. (1) Ensure the server is running. (2) If the app loaded, add CORS on your S3 bucket for this site (see server/S3-CORS.md).';
            }
            console.error('Upload failed', err);
            alert(msg);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex h-screen bg-white">
            {/* Share vault modal */}
            {showSharePanel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSharePanel(false)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">Share vault</h3>
                            <button type="button" onClick={() => setShowSharePanel(false)} className="text-gray-500 hover:text-gray-700 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <p className="text-sm text-gray-600 mb-4">Invite others by email. They must already have an account.</p>
                            <form onSubmit={handleInvite} className="flex flex-col gap-2 mb-6">
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => { setInviteEmail(e.target.value); setInviteError(null); }}
                                    placeholder="colleague@example.com"
                                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    style={{ color: '#000' }}
                                />
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value as 'VIEWER' | 'CONTRIBUTOR')}
                                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                    style={{ color: '#000' }}
                                >
                                    <option value="VIEWER">Can view only</option>
                                    <option value="CONTRIBUTOR">Can add sources & annotate</option>
                                </select>
                                {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
                                <button type="submit" disabled={inviting || !inviteEmail.trim()} className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
                                    {inviting ? 'Inviting…' : 'Invite'}
                                </button>
                            </form>
                            <h4 className="text-sm font-medium text-gray-800 mb-2">Members</h4>
                            <ul className="space-y-2">
                                {members.map((m) => (
                                    <li key={m.userId} className="text-sm flex justify-between items-center py-1.5 border-b border-gray-100">
                                        <span className="text-gray-900">{m.name}</span>
                                        <span className="text-xs text-gray-500 uppercase">{m.role}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar: Sources */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="font-bold text-lg text-gray-800 truncate">{vault?.name || 'Vault'}</h2>
                    <p className="text-xs text-gray-500 truncate mb-2">{vault?.description}</p>

                    {/* Active Users */}
                    <div className="flex -space-x-2 overflow-hidden">
                        {activeUsers.map((u, i) => (
                            <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-blue-500 flex items-center justify-center text-xs text-white font-bold" title={u.name}>
                                {u.name?.charAt(0).toUpperCase()}
                            </div>
                        ))}
                        {activeUsers.length === 0 && <span className="text-xs text-gray-400">No other users</span>}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowSharePanel(true)}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        <UserPlus size={14} /> Share vault
                    </button>
                </div>

                <div className="p-2">
                    <button
                        onClick={() => setShowAddSource(!showAddSource)}
                        className="w-full flex items-center justify-center p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    >
                        <Plus size={16} className="mr-2" /> Add Source
                    </button>
                </div>

                {showAddSource && (
                    <div className="p-3 bg-white border-b border-gray-200 shadow-inner animate-in slide-in-from-top-2">
                        <form onSubmit={handleAddUrl} className="mb-3">
                            <div className="flex">
                                <input
                                    type="url"
                                    placeholder="https://example.com"
                                    className="flex-1 text-sm border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500 px-2 py-1 border"
                                    value={sourceUrl}
                                    onChange={e => setSourceUrl(e.target.value)}
                                    required
                                />
                                <button type="submit" className="bg-blue-500 text-white px-3 rounded-r-md hover:bg-blue-600">
                                    <LinkIcon size={14} />
                                </button>
                            </div>
                        </form>
                        <div className="relative border-t border-gray-200 pt-3 text-center">
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                            <label
                                htmlFor="file-upload"
                                className={`flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 cursor-pointer ${uploading ? 'opacity-50' : ''}`}
                            >
                                <Upload size={16} className="mr-2" />
                                {uploading ? 'Uploading...' : 'Upload PDF'}
                            </label>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sources.map(source => (
                        <div
                            key={source.id}
                            onClick={() => setActiveSource(source)}
                            className={`p-3 rounded-md cursor-pointer flex items-center transition ${activeSource?.id === source.id ? 'bg-blue-100 text-blue-900 shadow-sm' : 'hover:bg-gray-200 text-gray-700'}`}
                        >
                            {source.fileUrl ? <FileText size={18} className="mr-3 flex-shrink-0" /> : <LinkIcon size={18} className="mr-3 flex-shrink-0" />}
                            <div className="truncate text-sm font-medium">{source.title || source.url}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content: Viewer */}
            <div className="flex-1 flex flex-col bg-gray-100">
                {activeSource ? (
                    <div className="flex-1 p-4 h-full">
                        <div className="bg-white rounded-lg shadow-md h-full flex flex-col overflow-hidden">
                            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h3 className="font-medium text-gray-800 truncate">{activeSource.title}</h3>
                                <a href={activeSource.fileUrl ? (pdfViewUrl || activeSource.fileUrl) : (activeSource.url || '#')} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline">
                                    Open Original
                                </a>
                            </div>
                            <div className="flex-1 bg-gray-200 relative overflow-auto">
                                {isTextFile(activeSource) ? (
                                    textFileError ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-red-600 bg-white/90">
                                            {textFileError}
                                        </div>
                                    ) : textFileLoading ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                            Loading…
                                        </div>
                                    ) : textFileContent !== null ? (
                                        <TextFileViewer
                                            ref={textViewerRef}
                                            content={textFileContent}
                                            annotations={annotations}
                                            onMouseUp={captureSelection}
                                        />
                                    ) : null
                                ) : activeSource.fileUrl ? (
                                    pdfViewError ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-red-600 bg-white/90">
                                            {pdfViewError}
                                        </div>
                                    ) : pdfViewUrl ? (
                                        <iframe
                                            src={pdfViewUrl}
                                            className="w-full h-full border-none"
                                            title="PDF Viewer"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                            Loading PDF…
                                        </div>
                                    )
                                ) : (
                                    <iframe
                                        src={activeSource.url}
                                        className="w-full h-full border-none"
                                        title="Web Viewer"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <FileText size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Select a source to view</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Sidebar: Annotations */}
            <div className="w-72 border-l border-gray-200 bg-white p-4 flex flex-col min-h-0">
                <h3 className="font-bold text-gray-800 mb-4">Annotations</h3>
                {activeSource ? (
                    <>
                        {isTextFile(activeSource) && (
                            <p className="text-xs text-gray-500 mb-2">Select text in the file, then add your note below to link the note to that selection.</p>
                        )}
                        {pendingSelection && (
                            <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                                <span className="font-medium">Selected:</span> &quot;{pendingSelection.selectedText.slice(0, 40)}{pendingSelection.selectedText.length > 40 ? '…' : ''}&quot;
                            </div>
                        )}
                        <form onSubmit={(e) => handleAddAnnotation(e, pendingSelection ?? undefined)} className="mb-4 flex flex-col gap-2">
                            <textarea
                                value={annotationNote}
                                onChange={(e) => setAnnotationNote(e.target.value)}
                                placeholder={pendingSelection ? 'Add a note for the selected text…' : 'Add a note or comment…'}
                                className="w-full text-sm border border-gray-300 rounded-md p-2 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                                style={{ color: '#000' }}
                                rows={3}
                                disabled={addingAnnotation}
                            />
                            <button
                                type="submit"
                                disabled={addingAnnotation || !annotationNote.trim()}
                                className="w-full py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {addingAnnotation ? 'Adding…' : pendingSelection ? 'Annotate selection' : 'Add note'}
                            </button>
                        </form>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {annotations.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No notes yet. Add one above.</p>
                            ) : (
                                annotations.map((a) => (
                                    <div key={a.id} className="text-sm p-3 bg-gray-50 rounded-md border border-gray-100">
                                        {(a.position as AnnotationPosition | null)?.selectedText && (
                                            <p className="text-xs text-amber-700 mb-1 font-medium">&quot;{(a.position as AnnotationPosition).selectedText}&quot;</p>
                                        )}
                                        <p className="text-gray-800 whitespace-pre-wrap">{a.content}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {a.user?.name ?? 'Someone'} · {new Date(a.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-gray-400 italic">Select a source to view and add notes.</p>
                )}
            </div>
        </div>
    );
}
