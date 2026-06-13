import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, CheckCircle2, Globe2, ShieldCheck, Zap } from 'lucide-react';

export const metadata = {
  title: 'TenderIQ - AI-Powered Tender Discovery & Bid Management',
  description: 'Win more government contracts with real-time tender matching, automated eligibility checks, and intelligent bid pipeline management.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-7xl z-50 border border-white/10 bg-slate-950/75 backdrop-blur-md rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all">
        <div className="px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">TenderIQ</span>
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link href="#features" className="text-slate-400 hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</Link>
            <Link href="/sign-in" className="px-4 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition-all">Sign In</Link>
            <Link href="/sign-up" className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-400 text-white transition-all shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] hover:shadow-[0_0_25px_-5px_rgba(99,102,241,0.7)]">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Real-time sync with eProcurement India & GeM
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Win Government Contracts <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Without the Chaos</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            AI-powered tender discovery, instant eligibility checks, and a smart pipeline to manage your bids from discovery to award.
          </p>
          
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/sign-up" className="group flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-all shadow-lg hover:shadow-indigo-500/25">
              Start Bidding Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#pricing" className="px-6 py-3 rounded-lg border border-white/10 hover:bg-white/5 font-medium transition-colors">
              View Pricing
            </Link>
          </div>

          {/* Hero Image Mockup */}
          <div className="mt-20 relative mx-auto max-w-5xl">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-2xl blur opacity-25"></div>
            <div className="relative rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-1.5 shadow-2xl overflow-hidden aspect-video">
               <div className="absolute inset-0 bg-slate-950 flex flex-col text-left">
                  {/* Fake Header */}
                  <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 gap-2 bg-slate-900/40">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                      </div>
                      <div className="h-4 w-px bg-white/10"></div>
                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 absolute"></span>
                        Live Dashboard (GeM & eProcurement India)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-24 bg-white/5 border border-white/10 rounded-md"></div>
                      <div className="h-6 w-6 rounded-full bg-indigo-500/20 border border-indigo-500/40"></div>
                    </div>
                  </div>
                  
                  {/* Fake UI Content */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Fake Sidebar */}
                    <div className="w-48 border-r border-white/5 bg-slate-900/20 p-4 space-y-3 hidden md:block">
                      <div className="h-7 bg-white/10 rounded-lg"></div>
                      <div className="h-7 bg-white/5 rounded-lg w-5/6"></div>
                      <div className="h-7 bg-white/5 rounded-lg w-4/5"></div>
                      <div className="h-7 bg-white/5 rounded-lg w-3/4"></div>
                      <div className="pt-4 border-t border-white/5 space-y-3">
                        <div className="h-6 bg-indigo-500/20 border border-indigo-500/30 rounded-lg"></div>
                      </div>
                    </div>

                    {/* Fake Dashboard Main View */}
                    <div className="flex-1 p-6 space-y-6 overflow-hidden">
                      {/* Stats cards */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Live Scraped Tenders</span>
                          <span className="text-lg md:text-2xl font-bold font-mono text-slate-200 mt-1 block">4,812</span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Eligible Bids</span>
                          <span className="text-lg md:text-2xl font-bold font-mono text-indigo-400 mt-1 block">17</span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/30">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Avg Match Score</span>
                          <span className="text-lg md:text-2xl font-bold font-mono text-emerald-400 mt-1 block">91.8%</span>
                        </div>
                      </div>

                      {/* Mock Tenders list */}
                      <div className="space-y-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Real-time Tender Discovery</span>
                        
                        <div className="space-y-2.5">
                          {/* Row 1 */}
                          <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                            <div className="space-y-1">
                              <span className="text-xs md:text-sm font-semibold text-slate-200 block">5G Telecomm Tower Expansion RFP</span>
                              <span className="text-[10px] text-slate-500 block">Bharat Sanchar Nigam Limited (BSNL)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">96% Match</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">Ready to Bid</span>
                            </div>
                          </div>

                          {/* Row 2 */}
                          <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                            <div className="space-y-1">
                              <span className="text-xs md:text-sm font-semibold text-slate-200 block">AI-Powered Traffic Analytics Platform</span>
                              <span className="text-[10px] text-slate-500 block">Delhi Municipal Corporation</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">91% Match</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">In Review</span>
                            </div>
                          </div>

                          {/* Row 3 */}
                          <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                            <div className="space-y-1">
                              <span className="text-xs md:text-sm font-semibold text-slate-200 block">Cloud Hosting & Migration Project</span>
                              <span className="text-[10px] text-slate-500 block">National Informatics Centre (NIC)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400">54% Match</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">Ineligible</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 bg-slate-900/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to win</h2>
            <p className="text-slate-400 text-lg">Stop manually reading 100-page PDFs. Our AI extracts requirements and matches them against your profile instantly.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                <Globe2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Live Portal Sync</h3>
              <p className="text-slate-400 leading-relaxed">
                Direct integration with GeM and eProcurement India. New tenders are pushed to your dashboard within minutes of publication.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Eligibility Engine</h3>
              <p className="text-slate-400 leading-relaxed">
                Upload your company certs once. Our AI reads tender docs and instantly calculates your Match Score out of 100.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Pipeline</h3>
              <p className="text-slate-400 leading-relaxed">
                Visual Kanban board for your bids. Track EMD deadlines, technical evaluation dates, and required compliance documents.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 text-lg">Select the tier that matches your business scale. All plans include GeM sync.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {/* Starter Plan */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 flex flex-col justify-between transition-all hover:translate-y-[-4px]">
              <div>
                <h3 className="text-xl font-bold mb-2 text-slate-100">Starter</h3>
                <p className="text-sm text-slate-400 mb-6">Perfect for small teams starting with government tenders.</p>
                <div className="mb-6 flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-100">₹1,999</span>
                    <span className="text-sm text-slate-500">/month</span>
                  </div>
                  <span className="text-xs text-slate-500">or ₹19,999/year (save ₹3,989)</span>
                </div>
                <div className="h-px bg-white/5 mb-6"></div>
                <ul className="space-y-3.5 mb-8 text-sm text-slate-400">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>5 Active Tender Trackers</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>AI Match Engine (Basic)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Email Alert Notifications</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>1 User Seat</span>
                  </li>
                </ul>
              </div>
              <Link href="/sign-up?plan=starter" className="w-full text-center py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-medium transition-all text-sm block">
                Start Free Trial
              </Link>
            </div>

            {/* Professional Plan */}
            <div className="p-8 rounded-2xl bg-gradient-to-b from-indigo-500/10 to-transparent border border-indigo-500/30 shadow-[0_0_50px_-12px_rgba(99,102,241,0.15)] flex flex-col justify-between relative transition-all hover:translate-y-[-4px]">
              <div className="absolute top-0 right-6 -translate-y-1/2 px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-md shadow-indigo-500/20">
                Recommended
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-slate-100">Professional</h3>
                <p className="text-sm text-slate-400 mb-6">Best for growing businesses with active bidding pipelines.</p>
                <div className="mb-6 flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-indigo-400">₹4,999</span>
                    <span className="text-sm text-slate-500">/month</span>
                  </div>
                  <span className="text-xs text-slate-500">or ₹49,999/year (save ₹9,989)</span>
                </div>
                <div className="h-px bg-white/5 mb-6"></div>
                <ul className="space-y-3.5 mb-8 text-sm text-slate-400">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="text-slate-200 font-medium">Unlimited Tender Tracking</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Advanced AI Match Engine</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Real-time WebSocket Sync</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Up to 5 User Seats</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Compliance Document Vault</span>
                  </li>
                </ul>
              </div>
              <Link href="/sign-up?plan=pro" className="w-full text-center py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-all text-sm block shadow-lg shadow-indigo-500/20">
                Upgrade to Pro
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 flex flex-col justify-between transition-all hover:translate-y-[-4px]">
              <div>
                <h3 className="text-xl font-bold mb-2 text-slate-100">Enterprise</h3>
                <p className="text-sm text-slate-400 mb-6">For large firms needing custom scrapers and API integrations.</p>
                <div className="mb-6 flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-100">₹14,999</span>
                    <span className="text-sm text-slate-500">/month</span>
                  </div>
                  <span className="text-xs text-slate-500">or ₹149,999/year (save ₹29,989)</span>
                </div>
                <div className="h-px bg-white/5 mb-6"></div>
                <ul className="space-y-3.5 mb-8 text-sm text-slate-400">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Custom Scrapers & Connectors</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Dedicated Account Manager</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Custom SLA & API Limits</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Unlimited User Seats</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Advanced RBAC & Auditing</span>
                  </li>
                </ul>
              </div>
              <Link href="/sign-up?plan=enterprise" className="w-full text-center py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-medium transition-all text-sm block">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span className="font-semibold text-slate-300">TenderIQ</span>
          </div>
          <p>© 2026 Skillaura Tech Solutions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
