import React, { useState, useEffect } from 'react';
import { Gift, Mail, Share2, Clipboard, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReferralBannerProps {
  api: any;
}

export default function ReferralBanner({ api }: ReferralBannerProps) {
  const [emailInput, setEmailInput] = useState('');
  const [stats, setStats] = useState<any>({
    totalSent: 0,
    pending: 0,
    signedUp: 0,
    converted: 0,
    earnedAmountInRupees: 0,
    referralsList: []
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastReferralCode, setLastReferralCode] = useState<string | null>(null);

  useEffect(() => {
    loadReferralStats();
  }, []);

  const loadReferralStats = async () => {
    try {
      setLoading(true);
      const res = await api.getReferralStats();
      if (res) {
        setStats(res);
      }
    } catch (e: any) {
      console.warn("Failed to load referral stats:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setGenerating(true);
    try {
      const res = await api.generateReferralCode(emailInput.trim());
      toast.success("Referral invitation created!");
      setLastReferralCode(res.referralCode);
      setEmailInput('');
      loadReferralStats();
    } catch (e: any) {
      toast.error(e.message || "Failed to create referral code");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = (code: string) => {
    const link = `http://localhost:3000/signup?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral signup link copied!");
  };

  const shareWhatsApp = (code: string) => {
    const text = encodeURIComponent(
      `Hey! I've been using TenderIQ to qualify for and win government contracts using AI Copilots. Use my link to sign up and get ₹500 credit immediately: http://localhost:3000/signup?ref=${code}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
        <div className="h-24 bg-slate-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Rewards stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 rounded-xl text-white shadow flex flex-col justify-between md:col-span-2">
          <div className="space-y-2">
            <div className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase w-max tracking-wide">
              Referral Program
            </div>
            <h3 className="font-extrabold text-lg">Refer a Colleague, Earn ₹500 Credit</h3>
            <p className="text-[10px] text-indigo-200 leading-relaxed">
              Introduce other contractors, consultants, or companies to TenderIQ. When they sign up and start a trial, you both receive a ₹500 credit directly applied to your next monthly bill!
            </p>
          </div>
          <div className="text-2xl font-extrabold mt-6">
            ₹{stats.earnedAmountInRupees.toLocaleString('en-IN')} Earned
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sign-ups Active</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-2">{stats.signedUp}</span>
          <span className="text-[10px] text-slate-500 mt-1">Pending subscription conversions</span>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Converted & Rewarded</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-2">{stats.converted}</span>
          <span className="text-[10px] text-success font-medium mt-1">Credits applied successfully</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Referral Form */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Share with Colleague</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <form onSubmit={handleGenerateCode} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Colleague Email</label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-450" />
                  <input 
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="partner@construction-co.com"
                    className="pl-9 w-full border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={generating}
                className="w-full py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded text-xs transition"
              >
                {generating ? 'Creating Link...' : 'Generate Sharing Invite'}
              </button>
            </form>

            {/* Generated widget */}
            {lastReferralCode && (
              <div className="border border-violet-100 bg-violet-50/30 rounded-lg p-4 space-y-3">
                <span className="text-[10px] font-bold text-violet-600 block uppercase tracking-wide">Invite Code Created</span>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleCopyLink(lastReferralCode)}
                    className="flex-1 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded text-[10px] flex items-center justify-center space-x-1 transition shadow-xs"
                  >
                    <Clipboard className="h-3 w-3" />
                    <span>Copy Link</span>
                  </button>
                  
                  <button 
                    onClick={() => shareWhatsApp(lastReferralCode)}
                    className="flex-1 py-1.5 bg-success hover:bg-green-600 text-white font-bold rounded text-[10px] flex items-center justify-center space-x-1 transition shadow-xs"
                  >
                    <Share2 className="h-3 w-3" />
                    <span>Share WhatsApp</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Referral Network History</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {stats.referralsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                You haven't referred any colleagues yet. Invite people to earn credits!
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-550/5 font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Invited Colleague</th>
                    <th className="px-6 py-3">Link Status</th>
                    <th className="px-6 py-3 text-right">Referral Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-750">
                  {stats.referralsList.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <span className="font-bold">{r.referredEmail}</span>
                        <div className="text-[9px] text-slate-400 mt-0.5">Created {new Date(r.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase space-x-1 ${
                          r.status === 'rewarded' || r.status === 'converted' ? 'bg-success-light text-success' :
                          r.status === 'signed_up' ? 'bg-blue-150 text-blue-800' : 'bg-slate-100 text-slate-650'
                        }`}>
                          {r.status === 'rewarded' || r.status === 'converted' ? (
                            <>
                              <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                              <span>Rewarded (₹500 Credit)</span>
                            </>
                          ) : r.status === 'signed_up' ? (
                            <span>Signed Up</span>
                          ) : (
                            <>
                              <Clock className="h-2.5 w-2.5 mr-0.5" />
                              <span>Pending Signup</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleCopyLink(r.referralCode)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-500 hover:text-slate-800 transition"
                        >
                          {r.referralCode}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
