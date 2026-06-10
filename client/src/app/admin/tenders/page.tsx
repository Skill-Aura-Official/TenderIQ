'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '../../../lib/api';
import { FileText, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ManageTendersPage() {
  const { isLoaded, getToken } = useAuth();
  const api = useMemo(() => createApiClient(getToken), [getToken]);
  
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    issuingAuthority: '',
    portalSlug: 'eprocure-india',
    submissionDeadline: '',
    estimatedValue: ''
  });

  const loadTenders = () => {
    api.getTenders()
      .then(res => {
        setTenders(res.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load tenders:', err);
        toast.error('Failed to load tenders');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isLoaded) {
      loadTenders();
    }
  }, [isLoaded, api]);

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.issuingAuthority || !formData.submissionDeadline) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createTender({
        title: formData.title,
        issuingAuthority: formData.issuingAuthority,
        portalSlug: formData.portalSlug,
        submissionDeadline: new Date(formData.submissionDeadline).getTime(),
        estimatedValue: formData.estimatedValue ? parseInt(formData.estimatedValue, 10) : undefined,
      });
      toast.success('Tender created successfully');
      setIsModalOpen(false);
      loadTenders();
      setFormData({ title: '', issuingAuthority: '', portalSlug: 'eprocure-india', submissionDeadline: '', estimatedValue: '' });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to create tender');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Manage Tenders</h1>
          <p className="text-slate-400 text-sm mt-1">View and manage all active tenders across the organization.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Tender
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading tenders...</div>
        ) : tenders.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <FileText className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Tenders Found</h3>
            <p className="text-slate-400">Get started by creating a new tender.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {tenders.map((tender) => (
              <div key={tender.id} className="p-4 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">{tender.title}</h4>
                  <div className="flex gap-4 mt-1 text-sm text-slate-400">
                    <span>{tender.issuingAuthority || tender.authority}</span>
                    <span>•</span>
                    <span>₹{(tender.estimatedValue || tender.value || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">
                    {tender.portalSlug || tender.category}
                  </span>
                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                    tender.summaryStatus === 'open' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    tender.summaryStatus === 'closed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {(tender.summaryStatus || tender.status || 'unknown').toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Create New Tender</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTender} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" 
                  placeholder="e.g. IT Equipment Procurement"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Issuing Authority *</label>
                <input 
                  type="text" 
                  value={formData.issuingAuthority}
                  onChange={(e) => setFormData({...formData, issuingAuthority: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" 
                  placeholder="e.g. Ministry of Defense"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Portal Source *</label>
                  <select 
                    value={formData.portalSlug}
                    onChange={(e) => setFormData({...formData, portalSlug: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="eprocure-india">eProcure India</option>
                    <option value="gem">GeM Portal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Estimated Value (₹)</label>
                  <input 
                    type="number" 
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({...formData, estimatedValue: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" 
                    placeholder="500000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Submission Deadline *</label>
                <input 
                  type="datetime-local" 
                  value={formData.submissionDeadline}
                  onChange={(e) => setFormData({...formData, submissionDeadline: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" 
                  required
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-medium"
                >
                  {isSubmitting ? 'Creating...' : 'Create Tender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
