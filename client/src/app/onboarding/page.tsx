"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { createApiClient } from '@/lib/api';
import toast from 'react-hot-toast';
import { Building2, FileText, Globe2, Briefcase, IndianRupee, Award, ArrowRight, ShieldCheck } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: '',
    gstNumber: '',
    msmeRegistered: false,
    incorporationYear: new Date().getFullYear().toString(),
    operatingStates: '',
    servicesKeywords: '',
    pastClientTypes: '',
    maxTenderCapacity: '',
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const nextStep = () => {
    if (step === 1 && !formData.companyName) {
      toast.error('Company Name is required');
      return;
    }
    if (step === 2 && (!formData.operatingStates || !formData.servicesKeywords)) {
      toast.error('States and Keywords are required');
      return;
    }
    setStep(s => Math.min(s + 1, 3));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.maxTenderCapacity) {
      toast.error('Maximum Tender Capacity is required');
      return;
    }

    setLoading(true);

    try {
      const apiClient = createApiClient(getToken);
      
      const payload = {
        companyName: formData.companyName,
        gstNumber: formData.gstNumber,
        msmeRegistered: formData.msmeRegistered,
        incorporationYear: parseInt(formData.incorporationYear, 10),
        operatingStates: formData.operatingStates.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
        servicesKeywords: formData.servicesKeywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        pastClientTypes: formData.pastClientTypes.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        maxTenderCapacity: parseInt(formData.maxTenderCapacity, 10) || 0,
        certifications: [],
      };

      await apiClient.saveProfile(payload);
      toast.success('Profile completed successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin"></div>
          <p className="text-gray-400 mt-4 font-medium">Loading your secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#111827] to-[#0f172a] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white selection:bg-blue-500/30">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 animate-pulse"></div>
        
        <div className="relative bg-[#111318] border border-gray-800 py-10 px-6 shadow-2xl sm:rounded-2xl sm:px-12 backdrop-blur-xl overflow-hidden">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-800">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div className="text-center mb-10 mt-2">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <ShieldCheck className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Build your AI Match Profile
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Step {step} of 3: {step === 1 ? 'Company Basics' : step === 2 ? 'Operational Scope' : 'Financials & Experience'}
            </p>
          </div>

          <form className="space-y-8 relative" onSubmit={e => e.preventDefault()}>
            
            {/* STEP 1 */}
            <div className={`transition-all duration-500 ${step === 1 ? 'opacity-100 translate-x-0 relative' : 'opacity-0 -translate-x-full absolute pointer-events-none'}`}>
              <div className="space-y-6">
                <div>
                  <label htmlFor="companyName" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 mr-2 text-blue-400" /> Legal Company Name <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    id="companyName" name="companyName" type="text" required
                    value={formData.companyName} onChange={handleChange}
                    className="block w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-600"
                    placeholder="e.g. L&T Infrastructure Ltd."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="gstNumber" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                      <FileText className="w-4 h-4 mr-2 text-blue-400" /> GST Number
                    </label>
                    <input
                      id="gstNumber" name="gstNumber" type="text"
                      value={formData.gstNumber} onChange={handleChange}
                      className="block w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-600"
                      placeholder="27AADCB..."
                    />
                  </div>
                  <div>
                    <label htmlFor="incorporationYear" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                      <Award className="w-4 h-4 mr-2 text-blue-400" /> Incorporation Year
                    </label>
                    <input
                      id="incorporationYear" name="incorporationYear" type="number"
                      value={formData.incorporationYear} onChange={handleChange}
                      className="block w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-600"
                    />
                  </div>
                </div>

                <div className="flex items-center p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl hover:bg-blue-500/10 transition-colors cursor-pointer" onClick={() => setFormData(p => ({...p, msmeRegistered: !p.msmeRegistered}))}>
                  <div className="relative flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="msmeRegistered" name="msmeRegistered" type="checkbox"
                        checked={formData.msmeRegistered} readOnly
                        className="h-5 w-5 bg-[#0a0a0a] border-gray-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 pointer-events-none"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label className="font-medium text-white cursor-pointer">We are an MSME Registered Entity</label>
                      <p className="text-gray-400">Gets preference in EMD exemptions.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2 */}
            <div className={`transition-all duration-500 ${step === 2 ? 'opacity-100 translate-x-0 relative' : 'opacity-0 translate-x-full absolute pointer-events-none'}`}>
              <div className="space-y-6">
                <div>
                  <label htmlFor="operatingStates" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <Globe2 className="w-4 h-4 mr-2 text-blue-400" /> Operating States <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    id="operatingStates" name="operatingStates" type="text"
                    value={formData.operatingStates} onChange={handleChange}
                    className="block w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-600"
                    placeholder="e.g. MH, DL, KA"
                  />
                  <p className="mt-2 text-xs text-gray-400">Comma-separated standard 2-letter state codes.</p>
                </div>

                <div>
                  <label htmlFor="servicesKeywords" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <Briefcase className="w-4 h-4 mr-2 text-blue-400" /> Civil Services Keywords <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    id="servicesKeywords" name="servicesKeywords" rows={3}
                    value={formData.servicesKeywords} onChange={handleChange}
                    className="block w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-600 resize-none"
                    placeholder="road repair, highway construction, bridge maintenance, canal dredging..."
                  />
                  <p className="mt-2 text-xs text-gray-400">Crucial for AI matching. Be highly specific.</p>
                </div>
              </div>
            </div>

            {/* STEP 3 */}
            <div className={`transition-all duration-500 ${step === 3 ? 'opacity-100 translate-x-0 relative' : 'opacity-0 translate-x-full absolute pointer-events-none'}`}>
              <div className="space-y-6">
                <div>
                  <label htmlFor="pastClientTypes" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 mr-2 text-blue-400" /> Past Client Types
                  </label>
                  <input
                    id="pastClientTypes" name="pastClientTypes" type="text"
                    value={formData.pastClientTypes} onChange={handleChange}
                    className="block w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-600"
                    placeholder="government, psu, private sector"
                  />
                </div>

                <div>
                  <label htmlFor="maxTenderCapacity" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <IndianRupee className="w-4 h-4 mr-2 text-green-400" /> Max Tender Capacity (₹) <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    id="maxTenderCapacity" name="maxTenderCapacity" type="number"
                    value={formData.maxTenderCapacity} onChange={handleChange}
                    className="block w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all hover:border-gray-600 text-lg font-medium"
                    placeholder="50000000"
                  />
                  <p className="mt-2 text-xs text-gray-400">Maximum project value you are eligible to bid on based on PQ criteria.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-800">
              <button
                type="button"
                onClick={prevStep}
                className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                Back
              </button>
              
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center px-6 py-2.5 text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 shadow-lg shadow-blue-500/20"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center px-8 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:ring-4 focus:ring-blue-500/30 transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:opacity-50"
                >
                  {loading ? 'Finalizing Profile...' : 'Complete Registration'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
