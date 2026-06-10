'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Users, FileText, Database } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AdminOverviewPage() {
  const { isLoaded, getToken } = useAuth();
  const api = useMemo(() => createApiClient(getToken), [getToken]);
  
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      api.getAdminMetrics()
        .then(data => {
          setMetrics(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load metrics:', err);
          toast.error('Failed to load metrics');
          setLoading(false);
        });
    }
  }, [isLoaded, api]);

  if (loading || !metrics) {
    return <div className="p-8 text-slate-400">Loading metrics...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time metrics for the TenderIQ platform.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-sm">Total Users</h3>
          </div>
          <p className="text-3xl font-extrabold text-white">{metrics.totalUsers}</p>
        </div>

        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <Activity className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-sm">Active Users (30d)</h3>
          </div>
          <p className="text-3xl font-extrabold text-white">{metrics.activeUsers30d}</p>
        </div>

        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <FileText className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-sm">Active Tenders</h3>
          </div>
          <p className="text-3xl font-extrabold text-white">{metrics.activeTenders}</p>
        </div>

        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <Database className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-sm">Today's Fetched</h3>
          </div>
          <p className="text-3xl font-extrabold text-white">{metrics.todayFetched}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 min-h-[300px]">
          <h3 className="font-semibold text-white mb-4">Recent Scraper Runs (GeM & eProcure)</h3>
          <div className="space-y-4">
             {metrics.recentScrapes?.map((scrape: any) => (
               <div key={scrape.id} className="flex justify-between items-center text-sm p-3 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-300">{scrape.name}</span>
                  <span className={`flex items-center gap-1 ${scrape.status === 'Success' ? 'text-green-400' : 'text-yellow-400'}`}>
                    ● {scrape.status}
                  </span>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
