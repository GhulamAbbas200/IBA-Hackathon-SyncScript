'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Plus, Folder, LogOut } from 'lucide-react';
import Link from 'next/link';

interface Vault {
    id: string;
    name: string;
    description: string;
    createdAt: string;
}

export default function Dashboard() {
    const { user, logout, isLoading } = useAuth();
    const [vaults, setVaults] = useState<Vault[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newVaultName, setNewVaultName] = useState('');
    const [newVaultDesc, setNewVaultDesc] = useState('');

    useEffect(() => {
        if (user) {
            fetchVaults();
        }
    }, [user]);

    const fetchVaults = async () => {
        try {
            const { data } = await api.get('/vaults');
            setVaults(data);
        } catch (error) {
            console.error('Failed to fetch vaults', error);
        }
    };

    const handleCreateVault = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/vaults', {
                name: newVaultName,
                description: newVaultDesc,
            });
            setVaults([...vaults, data]);
            setShowCreate(false);
            setNewVaultName('');
            setNewVaultDesc('');
        } catch (error) {
            console.error('Failed to create vault', error);
        }
    };

    if (isLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-900">SyncScript Dashboard</h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-600">Welcome, {user?.name}</span>
                        <button
                            onClick={logout}
                            className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                            title="Logout"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800">Your Knowledge Vaults</h2>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={20} className="mr-2" />
                        New Vault
                    </button>
                </div>

                {/* Create Vault Form */}
                {showCreate && (
                    <div className="mb-8 bg-white p-6 rounded-lg shadow-md border border-gray-100">
                        <h3 className="text-lg font-medium mb-4">Create New Vault</h3>
                        <form onSubmit={handleCreateVault} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Vault Name</label>
                                <input
                                    type="text"
                                    value={newVaultName}
                                    onChange={(e) => setNewVaultName(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    style={{ color: '#000' }}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    value={newVaultDesc}
                                    onChange={(e) => setNewVaultDesc(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    style={{ color: '#000' }}
                                    rows={2}
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Vault Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vaults.map((vault) => (
                        <Link
                            key={vault.id}
                            href={`/vault/${vault.id}`}
                            className="block bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition">
                                    <Folder className="text-blue-600" size={24} />
                                </div>
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition">
                                {vault.name}
                            </h3>
                            <p className="mt-2 text-gray-600 text-sm line-clamp-2">
                                {vault.description || "No description provided."}
                            </p>
                            <div className="mt-4 flex items-center text-xs text-gray-500">
                                Created: {new Date(vault.createdAt).toLocaleDateString()}
                            </div>
                        </Link>
                    ))}

                    {vaults.length === 0 && !isLoading && (
                        <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            <p>No vaults found. Create one to get started!</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
