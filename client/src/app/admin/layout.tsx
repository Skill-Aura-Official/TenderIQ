'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import Link from 'next/link';
import { UserButton, useAuth } from '@clerk/nextjs';
import { createApiClient } from '../../lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, getToken } = useAuth();
  const api = useMemo(() => createApiClient(getToken), [getToken]);
  
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      api.getMe()
        .then(user => {
          setRole(user?.role || 'viewer');
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch user in admin layout:', err);
          setRole('viewer');
          setLoading(false);
        });
    }
  }, [isLoaded, api]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-slate-400">Verifying authorization...</span>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6 text-red-500">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 max-w-md mb-8">
          You do not have administrative permissions to view this control panel.
        </p>
        <Link 
          href="/dashboard" 
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/25"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-red-500 w-6 h-6" />
          <span className="font-bold text-lg tracking-tight">TenderIQ Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">Exit to App</Link>
          <UserButton />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-2">
          <Link href="/admin" className="block px-4 py-2 rounded bg-slate-800 text-slate-100 font-medium text-sm">
            Overview Metrics
          </Link>
          <Link href="/admin/scrapers" className="block px-4 py-2 rounded text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 font-medium text-sm transition-colors">
            Scraper Logs
          </Link>
          <Link href="/admin/tenders" className="block px-4 py-2 rounded text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 font-medium text-sm transition-colors">
            Manage Tenders
          </Link>
        </aside>
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
