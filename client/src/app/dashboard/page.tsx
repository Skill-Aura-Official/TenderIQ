'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '@clerk/nextjs';
import { useTranslation } from '../../providers/LanguageProvider';
import { 
  Briefcase, 
  Search, 
  Bell, 
  Settings as SettingsIcon, 
  FolderOpen, 
  Layers, 
  Compass, 
  LayoutDashboard, 
  LogOut, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Upload, 
  Download, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  ChevronDown,
  Info,
  Calendar,
  DollarSign,
  Wifi,
  WifiOff,
  Shield,
  Gift,
  Sparkles,
  Users
} from 'lucide-react';
import { createApiClient } from '../../lib/api';
import { useRealtime } from '../../lib/useRealtime';
import toast from 'react-hot-toast';
import CopilotPanel from '../../components/CopilotPanel';
import L1RateCard from '../../components/L1RateCard';
import TeamWorkspace from '../../components/TeamWorkspace';
import ReferralBanner from '../../components/ReferralBanner';

// Categories mapping
const CATEGORY_NAMES: Record<string, string> = {
  it_services: 'IT Services & Software',
  software_development: 'Software Development',
  cloud: 'Cloud & Infrastructure',
  civil_works: 'Civil Infrastructure',
  construction: 'Building Construction',
  marketing: 'Marketing & Campaigns',
  public_relations: 'Public Relations',
  digital: 'Digital Campaigning',
  electronics: 'Electronics Supply',
  hardware: 'Hardware Installation'
};

// State mapping
const STATE_NAMES: Record<string, string> = {
  ALL: 'All India',
  DL: 'Delhi',
  HR: 'Haryana',
  UP: 'Uttar Pradesh',
  MH: 'Maharashtra',
  KA: 'Karnataka',
  TN: 'Tamil Nadu',
  GJ: 'Gujarat'
};

export default function TenderIQApp() {
  const { isLoaded, userId, getToken, signOut } = useAuth();
  const { user } = useUser();
  const { t, locale, setLocale } = useTranslation();

  // Create the API client bound to Clerk's token getter
  const api = useMemo(() => createApiClient(getToken), [getToken]);

  // Navigation & State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'discover' | 'pipeline' | 'vault' | 'settings' | 'team' | 'referrals'>('dashboard');
  
  // App Core Data State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tenders, setTenders] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  
  // Filtering & UI controls
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [portalFilter, setPortalFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [showCopilot, setShowCopilot] = useState(false);
  const [lastFetchedKey, setLastFetchedKey] = useState('');

  // Fetch translated details when selected tender ID or locale changes
  useEffect(() => {
    if (selectedTender && selectedTender.id) {
      const fetchKey = `${selectedTender.id}:${locale}`;
      if (lastFetchedKey !== fetchKey) {
        const fetchDetails = async () => {
          try {
            const details = await api.getTender(selectedTender.id, locale);
            setLastFetchedKey(fetchKey);
            setSelectedTender(details);
          } catch (err: any) {
            console.error("Failed to load translated tender details:", err.message);
          }
        };
        fetchDetails();
      }
    }
  }, [locale, selectedTender?.id, lastFetchedKey, api]);
  
  // Onboarding Wizard State
  const [onboardingStep, setOnboardingStep] = useState<number>(0); // 0 means finished or not started
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingProfile, setOnboardingProfile] = useState({
    companyName: '',
    gstNumber: '',
    panNumber: '',
    msmeRegistered: false,
    incorporationYear: 2023,
    maxEmdCapacity: 200000,
    operatingStates: ['MH'],
    services: [] as string[],
    certifications: [] as string[],
    minTenderValue: 100000
  });

  const [serviceTagInput, setServiceTagInput] = useState('');
  const [isSimulatingMatches, setIsSimulatingMatches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customIngestTitle, setCustomIngestTitle] = useState('');
  const [customIngestValue, setCustomIngestValue] = useState(5000000);
  const [customIngestState, setCustomIngestState] = useState('MH');

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      // 0. Fetch User Info
      const me = await api.getMe().catch(() => null);
      if (me) {
        setCurrentUser(me);
      }

      // 1. Fetch Profile
      const prof = await api.getProfile().catch(() => null);
      if (!prof) {
        setIsOnboarding(true);
        setOnboardingStep(1); // Start onboarding step 1
        setLoading(false);
        return;
      } else {
        setProfile(prof);
        setOnboardingProfile(prof);
      }

      // 2. Fetch Tenders
      const tendResponse = await api.getTenders();
      setTenders(tendResponse.data || []);

      // 3. Fetch Pipeline
      const pipe = await api.getPipeline().catch(() => []);
      setPipeline(pipe || []);

      // 4. Fetch Vault
      const docs = await api.getDocuments().catch(() => []);
      setVaultDocs(docs || []);

      // In a real app we'd fetch alerts from the server.
      // Keeping it empty to adhere strictly to the "no static data" rule.
      setAlerts([]);

    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load data from server.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Load Initial Data
  useEffect(() => {
    if (isLoaded && userId) {
      loadAllData();
    }
  }, [isLoaded, userId, loadAllData]);

  // Real-time updates subscription
  const handleRealtimeEvent = useCallback((event: { type: string; payload: any }) => {
    console.log('Real-time event received:', event.type);
    
    // For now, any relevant event triggers a full refresh to guarantee consistency.
    // We could optimize this later by updating specific state slices.
    if (['tender_created', 'tender_assigned', 'pipeline_updated', 'vault_updated'].includes(event.type)) {
      loadAllData();
    }
  }, [loadAllData]);
  
  const { isConnected: isRealtimeConnected } = useRealtime(handleRealtimeEvent, !isOnboarding && !!profile);

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  // Onboarding Wizard Handlers
  const handleOnboardingSubmit = async () => {
    setIsSimulatingMatches(true);
    setOnboardingStep(5); // Show loading generator screen

    setTimeout(async () => {
      try {
        const userEmail = user?.primaryEmailAddress?.emailAddress || '';
        if (!userEmail) {
          throw new Error('No primary email found for your Clerk account.');
        }

        // 1. Onboard the user (creates user and org records in DB)
        await api.onboard({
          email: userEmail,
          orgName: onboardingProfile.companyName || 'My Organization'
        });

        // 2. Save the company profile details (succeeds now because requireAuth succeeds)
        await api.saveProfile(onboardingProfile);
        
        // 3. Retrieve the synced profile
        const prof = await api.getProfile();
        setProfile(prof);
        
        // Refresh tenders and pipeline
        const tendResponse = await api.getTenders();
        setTenders(tendResponse.data || []);
        
        setIsOnboarding(false);
        setOnboardingStep(0);
        setActiveTab('dashboard');
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to save profile. Please try again.');
        // Revert to Step 4 so they can retry
        setOnboardingStep(4);
      } finally {
        setIsSimulatingMatches(false);
      }
    }, 3000); // 3-second matching animation
  };

  // Pipeline Kanban Actions
  const handlePipelineMove = async (tenderId: string, targetStage: string) => {
    try {
      // Optimistic update
      setPipeline(prev => 
        prev.map(p => p.tenderId === tenderId ? { ...p, stage: targetStage } : p)
      );
      await api.updatePipelineStage(tenderId, targetStage);
    } catch (e: any) {
      console.error("Failed pipeline stage shift:", e);
      toast.error('Failed to update stage.');
      // Rollback
      const pipe = await api.getPipeline().catch(() => []);
      setPipeline(pipe || []);
    }
  };

  const handleAddToPipeline = async (tenderId: string) => {
    try {
      await api.addToPipeline(tenderId, 'discovered');
      const pipe = await api.getPipeline();
      setPipeline(pipe);
      toast.success('Added to pipeline!');
      // Close modal
      if (selectedTender?.id === tenderId) {
        setSelectedTender(null);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to add to pipeline.');
    }
  };

  const handleDismissTender = (tenderId: string) => {
    // Client-side dismiss: hides the tender from the current view
    setTenders(prev => prev.filter(t => t.id !== tenderId));
    setSelectedTender(null);
  };

  const handleRemoveFromPipeline = async (tenderId: string) => {
    try {
      await api.removeFromPipeline(tenderId);
      setPipeline(prev => prev.filter(p => p.tenderId !== tenderId));
    } catch (e) {
      console.error(e);
    }
  };

  // Document Vault Upload
  const handleVaultUpload = async (docType: string, filename: string) => {
    try {
      const { uploadUrl, gcsKey } = await api.getUploadUrl(filename, docType);
      
      // Upload to cloud storage
      await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: gcsKey })
      });

      // Confirm DB record
      await api.confirmUpload({
        gcsKey,
        docType,
        displayName: filename,
        fileSize: 154000,
        mimeType: 'application/pdf'
      });

      // Reload profile & data to update checkmarks
      await loadAllData();
      toast.success('Document uploaded successfully!');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to upload document.');
    }
  };

  // Search & Filtered Tenders list
  const getFilteredTenders = () => {
    return tenders.filter(t => {
      // Free Text
      const searchMatch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.issuingAuthority.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.portalTenderId.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Dropdown Filters
      const categoryMatch = !categoryFilter || t.categoryCodes.includes(categoryFilter);
      const stateMatch = !stateFilter || t.stateCodes.includes(stateFilter) || t.stateCodes.includes('ALL');
      const portalMatch = !portalFilter || t.portalSlug === portalFilter;
      
      const scoreMatch = !scoreFilter || (() => {
        if (scoreFilter === 'excellent') return t.matchScore >= 90;
        if (scoreFilter === 'good') return t.matchScore >= 70 && t.matchScore < 90;
        if (scoreFilter === 'moderate') return t.matchScore >= 50 && t.matchScore < 70;
        if (scoreFilter === 'poor') return t.matchScore < 50;
        return true;
      })();

      return searchMatch && categoryMatch && stateMatch && portalMatch && scoreMatch;
    });
  };

  // Seed Ingestion Trigger Simulation
  const handleTriggerSimIngest = async () => {
    if (!customIngestTitle) return;
    try {
      setLoading(true);

      const ingPayload = {
        title: customIngestTitle,
        issuingAuthority: 'Ministry of Defence, Government of India',
        portalSlug: 'gem',
        submissionDeadline: Date.now() + 15 * 24 * 60 * 60 * 1000, // 15 days in future
        estimatedValue: customIngestValue,
        categoryCodes: ['software_development', 'it_services'],
        stateCodes: [customIngestState],
        requiredDocuments: ['iso_9001', 'msme'],
        eligibilityCriteria: [
          { criterion: 'incorporation_years', value: '3', required: true },
          { criterion: 'certification', value: 'ISO_9001', required: true }
        ],
        summaryStatus: 'completed',
        aiSummary: {
          description: `This is an AI-generated summary of the procurement tender "${customIngestTitle}" issued by the Ministry of Defence.`
        }
      };

      await api.createTender(ingPayload);
      toast.success('Simulated tender ingested successfully!');
      setCustomIngestTitle('');
      await loadAllData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to ingest simulated tender.');
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting values in Indian format (Lakh, Crore)
  const formatINR = (value: number | null) => {
    if (value === null || value === undefined) return 'Not Disclosed';
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} Lakh`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  // KPI calculations
  const kpiSavedTenders = pipeline.filter(p => p.stage === 'discovered' || p.stage === 'under_review').length;
  const kpiPreparing = pipeline.filter(p => p.stage === 'preparing').length;
  const kpiSubmitted = pipeline.filter(p => p.stage === 'submitted').length;
  const kpiNewToday = tenders.filter(t => t.matchScore >= 70).length; // High matches count

  if (!isLoaded || !userId) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading session...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 2. ONBOARDING WIZARD */}
      {isOnboarding && (
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            
            {/* Steps indicator */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <span className="font-bold text-lg text-slate-800">Setup your Company Profile</span>
              <span className="text-sm font-medium text-slate-500">Step {onboardingStep} of 4</span>
            </div>

            {/* Step 1: Welcome & Setup Intro */}
            {onboardingStep === 1 && (
              <div className="p-8 space-y-6">
                <div className="max-w-xl">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome to TenderIQ!</h1>
                  <p className="mt-2 text-slate-650">We will help you instantly scan hundreds of government websites and calculate your eligibility score for any contract automatically.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <div className="p-4 border border-slate-200 rounded-lg">
                    <Compass className="text-primary h-6 w-6 mb-2" />
                    <h3 className="font-bold text-sm text-slate-900">Discover Faster</h3>
                    <p className="text-xs text-slate-550 mt-1">Cross-portal scans delivered straight to your command center.</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-lg">
                    <CheckCircle className="text-success h-6 w-6 mb-2" />
                    <h3 className="font-bold text-sm text-slate-900">Qualify Instantly</h3>
                    <p className="text-xs text-slate-550 mt-1">AI analyses PDF requirements against your documents.</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-lg">
                    <Clock className="text-warning h-6 w-6 mb-2" />
                    <h3 className="font-bold text-sm text-slate-900">Track Deadlines</h3>
                    <p className="text-xs text-slate-550 mt-1">Real-time alerts for corrigendum and calendar events.</p>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={() => setOnboardingStep(2)}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Company Profile setup */}
            {onboardingStep === 2 && (
              <div className="p-8 space-y-6">
                <h2 className="text-lg font-bold text-slate-900">Company Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Company Legal Name</label>
                    <input 
                      type="text" 
                      value={onboardingProfile.companyName}
                      onChange={(e) => setOnboardingProfile(prev => ({ ...prev, companyName: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md sm:text-sm"
                      placeholder="e.g. Acme Tech Solutions"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Incorporation Year</label>
                    <input 
                      type="number" 
                      value={onboardingProfile.incorporationYear}
                      onChange={(e) => setOnboardingProfile(prev => ({ ...prev, incorporationYear: parseInt(e.target.value, 10) }))}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">GSTIN Number</label>
                    <input 
                      type="text" 
                      value={onboardingProfile.gstNumber}
                      onChange={(e) => setOnboardingProfile(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md sm:text-sm"
                      placeholder="27AADCS1234F1Z5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">PAN Number</label>
                    <input 
                      type="text" 
                      value={onboardingProfile.panNumber}
                      onChange={(e) => setOnboardingProfile(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md sm:text-sm"
                      placeholder="AADCS1234F"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
                  <input 
                    type="checkbox" 
                    id="msme-checkbox"
                    checked={onboardingProfile.msmeRegistered}
                    onChange={(e) => setOnboardingProfile(prev => ({ ...prev, msmeRegistered: e.target.checked }))}
                    className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                  />
                  <label htmlFor="msme-checkbox" className="text-sm font-medium text-slate-900">
                    Our company is registered under MSME / Udyam portal
                  </label>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between">
                  <button 
                    onClick={() => setOnboardingStep(1)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setOnboardingStep(3)}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Preferences */}
            {onboardingStep === 3 && (
              <div className="p-8 space-y-6">
                <h2 className="text-lg font-bold text-slate-900">Tender Preferences</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Services Provided (Keywords for Match Engine)</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <input 
                        type="text" 
                        value={serviceTagInput}
                        onChange={(e) => setServiceTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && serviceTagInput) {
                            setOnboardingProfile(prev => ({
                              ...prev,
                              services: [...prev.services, serviceTagInput.trim().toLowerCase()]
                            }));
                            setServiceTagInput('');
                          }
                        }}
                        className="flex-1 min-w-0 block w-full px-3 py-2 border border-slate-300 rounded-l-md sm:text-sm"
                        placeholder="e.g. software development, HVAC, catering"
                      />
                      <button 
                        onClick={() => {
                          if (serviceTagInput) {
                            setOnboardingProfile(prev => ({
                              ...prev,
                              services: [...prev.services, serviceTagInput.trim().toLowerCase()]
                            }));
                            setServiceTagInput('');
                          }
                        }}
                        className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-550 sm:text-sm font-medium hover:bg-slate-100"
                      >
                        Add
                      </button>
                    </div>
                    {/* Tags render */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {onboardingProfile.services.map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => setOnboardingProfile(prev => ({ ...prev, services: prev.services.filter(s => s !== tag) }))}
                            className="flex-shrink-0 ml-1.5 inline-flex text-slate-400 hover:text-slate-650"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Max EMD Capacity (INR)
                        <span className="ml-2 text-slate-400 cursor-help" title="This is typically 2% of the tender value. E.g., if you can afford ₹2L EMD, you can bid on tenders up to ₹1Cr.">
                          <Info className="inline h-4 w-4" />
                        </span>
                      </label>
                      <input 
                        type="number" 
                        value={onboardingProfile.maxEmdCapacity}
                        onChange={(e) => setOnboardingProfile(prev => ({ ...prev, maxEmdCapacity: parseInt(e.target.value, 10) || 0 }))}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Minimum Tender Value Preference (INR)</label>
                      <input 
                        type="number" 
                        value={onboardingProfile.minTenderValue}
                        onChange={(e) => setOnboardingProfile(prev => ({ ...prev, minTenderValue: parseInt(e.target.value, 10) }))}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between">
                  <button 
                    onClick={() => setOnboardingStep(2)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setOnboardingStep(4)}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Documents Upload */}
            {onboardingStep === 4 && (
              <div className="p-8 space-y-6">
                <h2 className="text-lg font-bold text-slate-900">Upload Compliance Documents</h2>
                <p className="text-sm text-slate-550">Upload key documents to enable immediate verification checkmarks and boost your match scores.</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FolderOpen className="text-slate-450 h-5 w-5" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">ISO 9001 Certificate</div>
                        <div className="text-xs text-slate-500">PDF, Max 5MB</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleVaultUpload('iso_9001', 'ISO_9001_Certificate.pdf')}
                      className="px-3 py-1 bg-slate-100 text-slate-800 rounded hover:bg-slate-200 text-xs font-semibold"
                    >
                      Upload Mock PDF
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FolderOpen className="text-slate-450 h-5 w-5" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">MSME Udyam Registration</div>
                        <div className="text-xs text-slate-500">PDF, Max 5MB</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleVaultUpload('msme', 'Udyam_MSME_Registration.pdf')}
                      className="px-3 py-1 bg-slate-100 text-slate-800 rounded hover:bg-slate-200 text-xs font-semibold"
                    >
                      Upload Mock PDF
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between">
                  <button 
                    onClick={() => setOnboardingStep(3)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleOnboardingSubmit}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover"
                  >
                    Generate Matches
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Matching Animation */}
            {onboardingStep === 5 && (
              <div className="p-12 flex flex-col items-center justify-center space-y-6">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold text-slate-900">Comparing Profile against Active Tenders...</h2>
                  <p className="text-sm text-slate-550">Running qualification models, EMD exemptions checks, and location audits.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. APPLICATION DESKTOP INTERFACE */}
      {!isOnboarding && (
        <div className="flex-1 flex overflow-hidden">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
            <div className="h-16 flex items-center px-6 border-b border-slate-800 text-white font-bold text-xl tracking-tight">
              Tender<span className="text-primary font-extrabold">IQ</span>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <LayoutDashboard className="mr-3 h-5 w-5" />
                {t('dashboard')}
              </button>
              <button 
                onClick={() => setActiveTab('discover')}
                className={`w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'discover' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <Compass className="mr-3 h-5 w-5" />
                {t('discover')}
              </button>
              <button 
                onClick={() => setActiveTab('pipeline')}
                className={`w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'pipeline' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <Layers className="mr-3 h-5 w-5" />
                {t('pipeline')}
              </button>
              <button 
                onClick={() => setActiveTab('vault')}
                className={`w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'vault' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <FolderOpen className="mr-3 h-5 w-5" />
                {t('vault')}
              </button>
              <button 
                onClick={() => setActiveTab('team')}
                className={`w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'team' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <Users className="mr-3 h-5 w-5" />
                {t('team')}
              </button>
              <button 
                onClick={() => setActiveTab('referrals')}
                className={`w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'referrals' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <Gift className="mr-3 h-5 w-5" />
                {t('referrals')}
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md ${activeTab === 'settings' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <SettingsIcon className="mr-3 h-5 w-5" />
                {t('settings')}
              </button>
              {currentUser?.role === 'admin' && (
                <Link 
                  href="/admin"
                  className="w-full flex items-center px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                >
                  <Shield className="mr-3 h-5 w-5 text-indigo-400" />
                  Admin Portal
                </Link>
              )}
            </nav>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{profile?.companyName || 'Skillaura Tech'}</p>
                <p className="text-[10px] text-slate-500 truncate">{profile?.gstNumber || 'No GSTIN'}</p>
              </div>
              <button onClick={handleLogout} className="p-1 hover:bg-slate-800 rounded text-slate-450 hover:text-white">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </aside>

          {/* MAIN CONTAINER */}
          <main className="flex-1 flex flex-col overflow-y-auto">
            
            {/* TOP NAVIGATION */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white sm:text-sm"
                    placeholder={t('searchPlaceholder')}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {/* Language Selector Dropdown */}
                <div className="flex items-center space-x-1.5 border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 shadow-sm transition hover:bg-slate-100">
                  <span className="text-[10px] text-slate-500 font-bold tracking-tight uppercase">{t('language')}:</span>
                  <select 
                    value={locale} 
                    onChange={(e) => setLocale(e.target.value as any)}
                    className="text-xs border-none bg-transparent focus:ring-0 cursor-pointer font-extrabold text-slate-850 p-0"
                  >
                    <option value="en">{t('english')}</option>
                    <option value="hi">{t('hindi')}</option>
                    <option value="mr">{t('marathi')}</option>
                    <option value="ta">{t('tamil')}</option>
                  </select>
                </div>
                <div title={isRealtimeConnected ? "Live Connection Active" : "Reconnecting..."}>
                  {isRealtimeConnected ? (
                    <Wifi className="h-4 w-4 text-success" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-slate-400 animate-pulse" />
                  )}
                </div>
                <button className="p-2 text-slate-450 hover:bg-slate-100 rounded-full relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-critical ring-2 ring-white"></span>
                </button>
                <div className="h-8 w-8 rounded-full bg-primary-light text-primary font-bold flex items-center justify-center text-xs">
                  SL
                </div>
              </div>
            </header>

            {/* TAB CONTENTS */}
            <div className="flex-1 p-8 space-y-6">

              {/* A. DASHBOARD VIEW */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
                      <p className="text-sm text-slate-550">Overview of tender metrics and matched qualification scores.</p>
                    </div>
                  </div>

                  {/* KPI Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">High Matches Today</span>
                      <span className="text-3xl font-extrabold text-slate-900 mt-2">{kpiNewToday}</span>
                      <span className="text-xs text-success font-medium mt-1">≥70% Eligibility Match</span>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Saved Tenders</span>
                      <span className="text-3xl font-extrabold text-slate-900 mt-2">{kpiSavedTenders}</span>
                      <span className="text-xs text-slate-500 mt-1">In under-review pipeline</span>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Preparing Bids</span>
                      <span className="text-3xl font-extrabold text-slate-900 mt-2">{kpiPreparing}</span>
                      <span className="text-xs text-warning font-medium mt-1">Requires documents attachment</span>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Submitted Bids</span>
                      <span className="text-3xl font-extrabold text-slate-900 mt-2">{kpiSubmitted}</span>
                      <span className="text-xs text-success font-medium mt-1">Awaiting bid awards</span>
                    </div>
                  </div>

                  {/* Dashboard Split Sections */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Recommended Tenders List */}
                    <div className="lg:col-span-2 space-y-4">
                      <h3 className="font-bold text-base text-slate-900">AI Recommended Tenders</h3>
                      <div className="space-y-4">
                        {tenders.slice(0, 3).map((t) => {
                          const isSaved = pipeline.some(p => p.tenderId === t.id);
                          return (
                            <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition shadow-sm relative flex flex-col justify-between">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1 pr-12">
                                  <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      t.matchScore >= 90 ? 'bg-success-light text-success' :
                                      t.matchScore >= 70 ? 'bg-primary-light text-primary' : 'bg-warning-light text-warning'
                                    }`}>
                                      {t.matchScore}% Match
                                    </span>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                      {t.portalSlug.toUpperCase()}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-sm text-slate-900 hover:text-primary cursor-pointer line-clamp-1" onClick={() => setSelectedTender(t)}>
                                    {t.title}
                                  </h4>
                                  <p className="text-xs text-slate-550 line-clamp-1">{t.issuingAuthority}</p>
                                </div>
                              </div>

                              <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between items-center text-xs text-slate-550">
                                <div>
                                  Value: <span className="font-semibold text-slate-900">{formatINR(t.estimatedValue)}</span>
                                </div>
                                <div className="flex space-x-3">
                                  {!isSaved ? (
                                    <button 
                                      onClick={() => handleAddToPipeline(t.id)}
                                      className="px-3 py-1 bg-primary text-white rounded text-xs font-semibold"
                                    >
                                      Save
                                    </button>
                                  ) : (
                                    <span className="text-success font-semibold flex items-center"><Check className="h-3 w-3 mr-1"/> Saved</span>
                                  )}
                                  <button 
                                    onClick={() => setSelectedTender(t)}
                                    className="px-3 py-1 border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
                                  >
                                    Open
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right column sidebar metrics */}
                    <div className="space-y-6">
                      
                      {/* Deadlines list */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-warning" /> Upcoming Deadlines
                        </h4>
                        <div className="space-y-3">
                          {tenders.slice(0, 3).map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-2 text-xs">
                              <span className="truncate pr-4 text-slate-700 font-medium">{t.title}</span>
                              <span className="text-slate-500 font-bold shrink-0">June {5 + idx}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Alerts center */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center">
                          <Bell className="h-4 w-4 mr-2 text-primary" /> Recent Alerts
                        </h4>
                        <div className="space-y-3">
                          {alerts.map((al) => (
                            <div key={al.id} className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                              <p className="text-slate-700 font-medium">{al.text}</p>
                              <span className="text-[10px] text-slate-400 block">{al.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* B. DISCOVERY SEARCH & FILTERS VIEW */}
              {activeTab === 'discover' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tender Discovery</h1>
                    <p className="text-sm text-slate-550">Filter matches or search the global database.</p>
                  </div>

                  {/* Filters Bar */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">Category</label>
                      <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="mt-1 block w-full border-slate-200 sm:text-xs rounded-md"
                      >
                        <option value="">All Categories</option>
                        <option value="it_services">IT Services</option>
                        <option value="civil_works">Civil Works</option>
                        <option value="marketing">Marketing Campaign</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">State</label>
                      <select 
                        value={stateFilter}
                        onChange={(e) => setStateFilter(e.target.value)}
                        className="mt-1 block w-full border-slate-200 sm:text-xs rounded-md"
                      >
                        <option value="">All States</option>
                        <option value="MH">Maharashtra</option>
                        <option value="KA">Karnataka</option>
                        <option value="DL">Delhi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">Portal</label>
                      <select 
                        value={portalFilter}
                        onChange={(e) => setPortalFilter(e.target.value)}
                        className="mt-1 block w-full border-slate-200 sm:text-xs rounded-md"
                      >
                        <option value="">All Portals</option>
                        <option value="gem">GeM (Govt Marketplace)</option>
                        <option value="cppp">CPPP Portal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">Match Score</label>
                      <select 
                        value={scoreFilter}
                        onChange={(e) => setScoreFilter(e.target.value)}
                        className="mt-1 block w-full border-slate-200 sm:text-xs rounded-md"
                      >
                        <option value="">Any Score</option>
                        <option value="excellent">Excellent (90-100%)</option>
                        <option value="good">Good (70-89%)</option>
                        <option value="moderate">Moderate (50-69%)</option>
                        <option value="poor">Poor (0-49%)</option>
                      </select>
                    </div>
                  </div>

                  {/* Simulator Ingestion Drawer inside Discovery */}
                  <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow flex flex-col space-y-4">
                    <h3 className="font-bold text-sm flex items-center text-primary-light">
                      <Compass className="h-4 w-4 mr-2 text-primary" /> Simulate New Tender Ingestion (BullMQ Pipeline)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <input 
                        type="text" 
                        placeholder="Tender Title, e.g. ERP Implementation"
                        value={customIngestTitle}
                        onChange={(e) => setCustomIngestTitle(e.target.value)}
                        className="bg-slate-850 text-white px-3 py-1.5 rounded text-xs border border-slate-700"
                      />
                      <input 
                        type="number" 
                        placeholder="Tender Value (INR)"
                        value={customIngestValue}
                        onChange={(e) => setCustomIngestValue(parseInt(e.target.value, 10))}
                        className="bg-slate-850 text-white px-3 py-1.5 rounded text-xs border border-slate-700"
                      />
                      <select 
                        value={customIngestState} 
                        onChange={(e) => setCustomIngestState(e.target.value)}
                        className="bg-slate-850 text-white px-3 py-1.5 rounded text-xs border border-slate-700"
                      >
                        <option value="MH">Maharashtra (MH)</option>
                        <option value="KA">Karnataka (KA)</option>
                        <option value="DL">Delhi (DL)</option>
                      </select>
                      <button 
                        onClick={handleTriggerSimIngest}
                        className="bg-primary text-white rounded text-xs font-semibold px-4 py-1.5 hover:bg-primary-hover"
                      >
                        Ingest & Score
                      </button>
                    </div>
                  </div>

                  {/* Results list */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {getFilteredTenders().map(t => {
                      const isSaved = pipeline.some(p => p.tenderId === t.id);
                      return (
                        <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                              <span>{t.portalTenderId}</span>
                              <span className={`px-2 py-0.5 rounded ${
                                t.matchScore >= 90 ? 'bg-success-light text-success' :
                                t.matchScore >= 70 ? 'bg-primary-light text-primary' : 'bg-warning-light text-warning'
                              }`}>
                                {t.matchScore}% Match
                              </span>
                            </div>
                            <h3 className="font-bold text-sm text-slate-900 cursor-pointer hover:text-primary line-clamp-2" onClick={() => setSelectedTender(t)}>
                              {t.title}
                            </h3>
                            <p className="text-xs text-slate-550 line-clamp-1">{t.issuingAuthority}</p>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-550">
                            <div>
                              Value: <span className="font-bold text-slate-900">{formatINR(t.estimatedValue)}</span>
                            </div>
                            <div className="flex space-x-2">
                              {!isSaved ? (
                                <button 
                                  onClick={() => handleAddToPipeline(t.id)}
                                  className="px-2.5 py-1 bg-primary text-white rounded text-[11px] font-semibold"
                                >
                                  Save
                                </button>
                              ) : (
                                <span className="text-success font-semibold text-xs py-1"><Check className="h-3 w-3 inline mr-1"/> Saved</span>
                              )}
                              <button 
                                onClick={() => setSelectedTender(t)}
                                className="px-2.5 py-1 border border-slate-200 text-slate-700 rounded text-[11px] font-semibold hover:bg-slate-50"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* C. PIPELINE KANBAN BOARD */}
              {activeTab === 'pipeline' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bid Pipeline</h1>
                    <p className="text-sm text-slate-550">Drag and drop tenders or manage active proposals.</p>
                  </div>

                  {/* Kanban grid columns */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-x-auto pb-4">
                    {['discovered', 'preparing', 'submitted', 'won'].map((col) => {
                      const colEntries = pipeline.filter(p => p.stage === col);
                      return (
                        <div key={col} className="bg-slate-100 rounded-xl p-4 min-w-[260px] flex flex-col space-y-4">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
                            <span>{col.replace('_', ' ')}</span>
                            <span className="bg-slate-200 px-2 py-0.5 rounded-full">{colEntries.length}</span>
                          </div>

                          <div className="space-y-3 flex-1 overflow-y-auto min-h-[300px]">
                            {colEntries.map((item) => (
                              <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-2 hover:shadow transition relative group">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  item.tender.matchScore >= 90 ? 'bg-success-light text-success' : 'bg-primary-light text-primary'
                                }`}>
                                  {item.tender.matchScore}% Match
                                </span>
                                <h4 className="font-bold text-xs text-slate-900 line-clamp-2">{item.tender.title}</h4>
                                <p className="text-[10px] text-slate-500 line-clamp-1">{item.tender.issuingAuthority}</p>
                                
                                <div className="flex justify-between items-center pt-2 border-t border-slate-50 text-[10px]">
                                  <span className="font-semibold text-slate-800">{formatINR(item.tender.estimatedValue)}</span>
                                  <button onClick={() => setSelectedTender(item.tender)} className="text-primary hover:underline font-semibold">
                                    Details
                                  </button>
                                </div>

                                {/* Drag Simulation Selectors */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center space-x-1 bg-white p-1 rounded border shadow-sm">
                                  <select 
                                    value={col}
                                    onChange={(e) => handlePipelineMove(item.tenderId, e.target.value)}
                                    className="text-[9px] p-0.5 border-none focus:ring-0 cursor-pointer font-bold text-slate-600 uppercase"
                                  >
                                    <option value="discovered">Discovered</option>
                                    <option value="preparing">Preparing</option>
                                    <option value="submitted">Submitted</option>
                                    <option value="won">Won</option>
                                  </select>
                                  <button onClick={() => handleRemoveFromPipeline(item.tenderId)} className="text-critical p-0.5 hover:bg-slate-100 rounded">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* D. DOCUMENT VAULT */}
              {activeTab === 'vault' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Document Vault</h1>
                    <p className="text-sm text-slate-550">Store and link your company certificates for automated eligibility score matching.</p>
                  </div>

                  {/* Vault grid uploads */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3">Document Name</th>
                          <th className="px-6 py-3">Category</th>
                          <th className="px-6 py-3">Upload Date</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {vaultDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 font-semibold text-slate-900">{doc.displayName}</td>
                            <td className="px-6 py-4 font-semibold text-slate-500 uppercase">{doc.docType.replace('_', ' ')}</td>
                            <td className="px-6 py-4 text-slate-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 bg-success-light text-success font-bold rounded">
                                Verified
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button 
                                onClick={async () => {
                                  const { downloadUrl } = await api.getDownloadUrl(doc.id);
                                  window.open(downloadUrl, '_blank');
                                }}
                                className="text-primary hover:text-primary-hover font-semibold inline-flex items-center"
                              >
                                <Download className="h-3.5 w-3.5 mr-1" /> Download
                              </button>
                              <button 
                                onClick={async () => {
                                  await api.deleteDocument(doc.id);
                                  loadAllData();
                                }}
                                className="text-critical hover:text-red-700 font-semibold inline-flex items-center ml-3"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* File Upload Box */}
                  <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 flex flex-col items-center justify-center space-y-4">
                    <Upload className="h-10 w-10 text-slate-400" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-900">Upload a new compliance document</p>
                      <p className="text-xs text-slate-500 mt-1">Files are verified and linked to matching algorithms automatically</p>
                    </div>
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => handleVaultUpload('iso_9001', 'ISO_27001_Information_Security.pdf')}
                        className="px-4 py-2 bg-slate-100 text-slate-800 rounded hover:bg-slate-200 text-xs font-semibold"
                      >
                        Upload Mock ISO 27001
                      </button>
                      <button 
                        onClick={() => handleVaultUpload('experience', 'Completion_Certificate_NHAI.pdf')}
                        className="px-4 py-2 bg-slate-100 text-slate-800 rounded hover:bg-slate-200 text-xs font-semibold"
                      >
                        Upload Mock Completion Cert
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* E. SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
                    <p className="text-sm text-slate-550">Configure your matching options and profile parameter scopes.</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">Company Metadata</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase">GSTIN Number</label>
                        <input 
                          type="text" 
                          value={onboardingProfile.gstNumber}
                          onChange={(e) => setOnboardingProfile(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))}
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 sm:text-xs rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase">PAN Number</label>
                        <input 
                          type="text" 
                          value={onboardingProfile.panNumber}
                          onChange={(e) => setOnboardingProfile(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 sm:text-xs rounded-md"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={async () => {
                        setLoading(true);
                        await api.saveProfile(onboardingProfile);
                        await loadAllData();
                        alert("Settings successfully saved and match scores updated.");
                      }}
                      className="px-4 py-2 bg-primary text-white rounded text-xs font-semibold hover:bg-primary-hover"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              )}

              {/* F. TEAM WORKSPACE */}
              {activeTab === 'team' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Team Workspace</h1>
                    <p className="text-sm text-slate-550">Manage workspace seating allocations, member roles, and access settings.</p>
                  </div>
                  <TeamWorkspace api={api} currentUser={currentUser} />
                </div>
              )}

              {/* G. REFERRALS NETWORK */}
              {activeTab === 'referrals' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Referrals & Rewards</h1>
                    <p className="text-sm text-slate-550">Earn ₹500 discount credits for every colleague you onboard to TenderIQ.</p>
                  </div>
                  <ReferralBanner api={api} />
                </div>
              )}

            </div>
          </main>

          {/* 4. DETAIL PANEL / MODAL */}
          {selectedTender && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
              <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-in">
                
                {/* Header */}
                <div className="px-6 py-6 border-b border-slate-200 flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {selectedTender.portalSlug.toUpperCase()} — {selectedTender.portalTenderId}
                    </span>
                    <h2 className="font-bold text-lg text-slate-900">{selectedTender.title}</h2>
                    <p className="text-xs text-slate-550">{selectedTender.issuingAuthority}</p>
                  </div>
                  <button onClick={() => setSelectedTender(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-650">
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 space-y-8">
                    {/* Radial eligibility representation */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center space-x-6">
                    <div className="relative h-20 w-20 flex-shrink-0 flex items-center justify-center bg-white rounded-full border-4 border-primary">
                      <span className="font-extrabold text-lg text-primary">{selectedTender.matchScore}%</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{t('eligibilityMatch')}</h4>
                      <p className="text-xs text-slate-550 mt-1">This score evaluates operational experience, services provided, state boundaries, and document completeness.</p>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">{t('aiSummaryScope')}</h3>
                    <div className="text-xs text-slate-650 leading-relaxed space-y-2">
                      {selectedTender.aiSummary?.physicalWorkRequired && (
                        <div>
                          <strong>Work Required:</strong> {selectedTender.aiSummary.physicalWorkRequired}
                        </div>
                      )}
                      {selectedTender.aiSummary?.preQualificationCriteria && (
                        <div>
                          <strong>Prequalification:</strong> {selectedTender.aiSummary.preQualificationCriteria}
                        </div>
                      )}
                      {selectedTender.aiSummary?.description && (
                        <div>{selectedTender.aiSummary.description}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                      <div className="bg-slate-50 p-3 rounded">
                        <span className="text-slate-550 block">{t('emdAmount')}</span>
                        <span className="font-semibold text-slate-800">{formatINR(selectedTender.emdAmount)}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded">
                        <span className="text-slate-550 block">{t('estimatedValue')}</span>
                        <span className="font-semibold text-slate-800">{formatINR(selectedTender.estimatedValue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* L1 Rate Intelligence Card */}
                  <L1RateCard 
                    tenderId={selectedTender.id}
                    api={api}
                    userTier={currentUser?.subscriptionTier || 'free'}
                    category={(() => {
                      try {
                        const cats = JSON.parse(selectedTender.categoryCodes || '[]');
                        return cats[0] || 'civil_works';
                      } catch (e) {
                        return 'civil_works';
                      }
                    })()}
                    state={(() => {
                      try {
                        const states = JSON.parse(selectedTender.stateCodes || '[]');
                        return states[0] || 'MH';
                      } catch (e) {
                        return 'MH';
                      }
                    })()}
                    estimatedValue={Number(selectedTender.estimatedValue || 0)}
                  />

                  {/* Match vs Missing Breakdown */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">{t('criteriaGapAnalysis')}</h3>
                    <div className="space-y-3">
                      {selectedTender.breakdown?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-start text-xs p-3 border border-slate-150 rounded-lg">
                          <div className="flex items-start space-x-2.5">
                            {item.matched ? (
                              <CheckCircle className="text-success h-4 w-4 mt-0.5 shrink-0" />
                            ) : (
                              <AlertTriangle className="text-warning h-4 w-4 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <div className="font-bold text-slate-850">{item.criterion}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{item.details}</div>
                            </div>
                          </div>
                          <span className="font-bold text-slate-700">{item.points} / {item.maxPoints} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Footer buttons */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <button 
                    onClick={() => handleDismissTender(selectedTender.id)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-100"
                  >
                    {t('dismiss')}
                  </button>
                  <div className="space-x-3 flex items-center">
                    <button 
                      onClick={() => setShowCopilot(true)}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-750 text-white rounded text-xs font-semibold inline-flex items-center shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" /> {t('aiBidCopilot')}
                    </button>
                    <button 
                      onClick={() => window.open(selectedTender.sourceUrl, '_blank')}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-100 inline-flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> {t('originalPortal')}
                    </button>
                    {pipeline.some(p => p.tenderId === selectedTender.id) ? (
                      <span className="inline-block px-4 py-2 bg-success text-white rounded text-xs font-semibold">
                        Saved in Pipeline
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleAddToPipeline(selectedTender.id)}
                        className="px-4 py-2 bg-primary text-white rounded text-xs font-semibold hover:bg-primary-hover"
                      >
                        {t('saveToPipeline')}
                      </button>
                    )}
                  </div>
                </div>

              </div>
              
              {/* Slide-out AI Bid Copilot panel side-by-side with detail panel */}
              {showCopilot && (
                <CopilotPanel 
                  tenderId={selectedTender.id}
                  api={api}
                  userTier={currentUser?.subscriptionTier || 'free'}
                  onClose={() => setShowCopilot(false)}
                />
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
