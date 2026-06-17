import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertTriangle, TrendingDown, Users, CheckCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface L1RateCardProps {
  tenderId: string;
  api: any;
  userTier: string;
  category: string;
  state: string;
  estimatedValue: number;
}

export default function L1RateCard({ tenderId, api, userTier, category, state, estimatedValue }: L1RateCardProps) {
  const [loading, setLoading] = useState(true);
  const [similarResults, setSimilarResults] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    loadIntelligenceData();
  }, [tenderId, category, state]);

  const loadIntelligenceData = async () => {
    try {
      setLoading(true);
      
      // Load similar results
      const res = await api.getSimilarResults(tenderId);
      setSimilarResults(res.data || []);
      setIsLocked(res.isTrialPreview);

      // Load aggregated L1 rates if Pro+
      if (userTier === 'pro' || userTier === 'enterprise') {
        const stats = await api.getL1Rates(category || 'civil_works', state || 'MH');
        setAnalytics(stats);
      } else {
        // Mock averages for visual gauge display under paywall
        setAnalytics({
          avgL1Rate: 88.5,
          medianL1Rate: 88.0,
          minL1Rate: 81.0,
          maxL1Rate: 94.0,
          sampleSize: 12,
          trend: 'highly_competitive'
        });
      }
    } catch (e: any) {
      console.warn("Failed to load pricing intelligence:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatINR = (value: number | null) => {
    if (value === null || value === undefined) return 'LOCKED';
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} Lakh`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-20 bg-slate-100 rounded-lg"></div>
      </div>
    );
  }

  // Calculate recommended bid range based on average L1 rate (e.g. 88%)
  const avgRate = analytics?.avgL1Rate || 88.5;
  const recommendedMin = estimatedValue * ((avgRate - 3.5) / 100);
  const recommendedMax = estimatedValue * ((avgRate + 1.5) / 100);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* Card Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-sm text-slate-900">Pricing & L1 Rate Intelligence</h3>
        </div>
        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
          Market-based Bid Guidance
        </span>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6">
        
        {/* Recommended Bid Pricing Block */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Recommended Bid Range</span>
            <div className="text-xl font-extrabold text-slate-900 flex items-center">
              {isLocked ? (
                <span className="flex items-center text-slate-500 font-semibold text-sm">
                  <Lock className="h-3.5 w-3.5 mr-1" /> Upgrade to Pro to view Range
                </span>
              ) : (
                `${formatINR(recommendedMin)} - ${formatINR(recommendedMax)}`
              )}
            </div>
            <p className="text-[10px] text-slate-500">Calculated based on average L1 award rate of {avgRate}% in {state || 'MH'}</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center space-x-4 shrink-0">
            <div className="text-center bg-white border border-slate-200/80 rounded-lg px-3 py-1.5 shadow-sm">
              <span className="text-[9px] text-slate-400 block font-semibold uppercase">Avg L1 Rate</span>
              <span className="font-extrabold text-slate-800 text-sm">{avgRate}%</span>
            </div>
            <div className="text-center bg-white border border-slate-200/80 rounded-lg px-3 py-1.5 shadow-sm">
              <span className="text-[9px] text-slate-400 block font-semibold uppercase">Avg Bidders</span>
              <span className="font-extrabold text-slate-800 text-sm flex items-center justify-center">
                <Users className="h-3.5 w-3.5 mr-1 text-slate-500" /> {isLocked ? "5-8" : "6.2"}
              </span>
            </div>
          </div>
        </div>

        {/* Similar Historical Awards Table */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs text-slate-800">Similar Historical Contract Awards</h4>
            {isLocked && (
              <span className="text-[10px] text-warning font-semibold flex items-center">
                <Lock className="h-3 w-3 mr-1" /> Partial results locked
              </span>
            )}
          </div>

          <div className="border border-slate-150 rounded-lg overflow-hidden text-xs">
            <table className="min-w-full divide-y divide-slate-150 text-left">
              <thead className="bg-slate-550/5 text-slate-500 font-bold">
                <tr>
                  <th className="px-4 py-2">Winner Name</th>
                  <th className="px-4 py-2">Award Date</th>
                  <th className="px-4 py-2">Award Amount</th>
                  <th className="px-4 py-2 text-right">L1 Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {similarResults.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {res.winnerName || 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-550">
                      {new Date(res.awardDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {res.isLocked ? (
                        <span className="bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                          ₹ *.* Lakh
                        </span>
                      ) : (
                        formatINR(res.awardedAmount)
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-extrabold text-primary">
                      {res.isLocked ? (
                        <span className="text-slate-400 font-bold">*.*%</span>
                      ) : (
                        `${res.l1Rate}%`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paywall Banner for free/starter tiers */}
        {isLocked && (
          <div className="border border-violet-200 bg-violet-50/50 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-start space-x-3">
              <Lock className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs text-slate-900">Unlock L1 Pricing Insights & Competitor Lists</h5>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Gain visibility into exact L1 awarded figures, competitor win percentages, and specific bidding discount margins.
                </p>
              </div>
            </div>
            <button 
              onClick={() => toast.success("Redirecting to billing plans...")}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-750 text-white rounded text-xs font-bold transition flex items-center space-x-1 whitespace-nowrap"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
