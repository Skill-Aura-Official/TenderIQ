import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Shield, Users, Mail, Clipboard, Key, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

interface TeamWorkspaceProps {
  api: any;
  currentUser: any;
}

export default function TeamWorkspace({ api, currentUser }: TeamWorkspaceProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState('contributor');
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const res = await api.getTeamMembers();
      setMembers(res || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setInviting(true);
    try {
      const res = await api.inviteTeamMember(emailInput.trim(), roleInput);
      toast.success("Colleague invited successfully!");
      setEmailInput('');
      
      // Store the invite URL so the admin can manually copy it if they don't have SMTP configured!
      if (res.inviteUrl) {
        setLastInviteLink(res.inviteUrl);
      }
      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to send invitation. Check plan seat limits.");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await api.updateTeamMemberRole(userId, newRole);
      toast.success("Role updated successfully");
      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member from your organization workspace?")) return;
    try {
      await api.removeTeamMember(userId);
      toast.success("Member removed from workspace");
      loadMembers();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove member");
    }
  };

  const handleCopyLink = () => {
    if (lastInviteLink) {
      navigator.clipboard.writeText(lastInviteLink);
      toast.success("Invitation link copied to clipboard!");
    }
  };

  // Seating analytics
  const subTier = currentUser?.subscriptionTier || 'free';
  const seatLimit = subTier === 'enterprise' ? 5 : subTier === 'enterprise_plus' ? 100 : 1;
  const seatsUsed = members.length;
  const percentageUsed = Math.min((seatsUsed / seatLimit) * 100, 100);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
        <div className="h-32 bg-slate-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview & Seats Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Seats gauge card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between md:col-span-2">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-800">Organization Seats Allocation</h3>
            <p className="text-xs text-slate-500">Add or manage team members and permissions on your workspace.</p>
          </div>
          
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>{seatsUsed} of {seatLimit === 100 ? 'Unlimited' : `${seatLimit} Seats`} used</span>
              <span>{Math.round(percentageUsed)}% Capacity</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${percentageUsed >= 90 ? 'bg-critical' : percentageUsed >= 70 ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${percentageUsed}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Upgrade Box / Notice */}
        <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-sm flex flex-col justify-between text-white">
          <div className="space-y-1">
            <div className="text-xs text-violet-400 font-bold uppercase tracking-wider">Plan Level: {subTier.toUpperCase()}</div>
            <h4 className="font-bold text-sm">Enterprise Multi-Seat Workspaces</h4>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            Upgrade to Enterprise to unlock up to 5 seats. Get access to shared document vaults and collaborative tender proposal pipelines.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Members Management Table */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Workspace Members</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Member Details</th>
                  <th className="px-6 py-3">Role Badge</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((m) => {
                  const isCurrent = m.id === currentUser?.userId;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 flex items-center">
                          {m.email} {isCurrent && <span className="ml-1.5 px-1 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded font-semibold">You</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Joined {new Date(m.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          m.role === 'tender_manager' ? 'bg-blue-100 text-blue-700' :
                          m.role === 'contributor' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-650'
                        }`}>
                          {m.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {/* Role switcher for admins */}
                        {!isCurrent && currentUser?.role === 'admin' && (
                          <>
                            <select 
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                              className="p-1 text-[10px] border border-slate-200 rounded font-semibold text-slate-600 bg-white"
                            >
                              <option value="admin">Admin</option>
                              <option value="tender_manager">Manager</option>
                              <option value="contributor">Contributor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button 
                              onClick={() => handleRemoveMember(m.id)}
                              className="text-critical hover:text-red-700 font-bold ml-3"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite Form / Code preview */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Invite Colleague</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Colleague Email</label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-450" />
                  <input 
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@company.com"
                    className="pl-9 w-full border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Assigned Workspace Role</label>
                <select 
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2 text-xs"
                >
                  <option value="tender_manager">Tender Manager</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <button 
                type="submit"
                disabled={inviting || seatLimit <= 1}
                className="w-full py-2 bg-primary hover:bg-primary-hover disabled:bg-slate-200 disabled:text-slate-450 text-white font-bold rounded text-xs transition"
              >
                {inviting ? 'Sending Invite...' : 'Generate Invitation'}
              </button>
            </form>

            {/* Link Copy Widget */}
            {lastInviteLink && (
              <div className="border border-green-200 bg-green-50/50 rounded-lg p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-green-700 block uppercase tracking-wide">Invite Generated!</span>
                <p className="text-[10px] text-slate-500">Copy this link and share it directly for immediate sandbox registration:</p>
                <div className="flex items-center space-x-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={lastInviteLink} 
                    className="flex-1 text-[9px] bg-white border border-green-150 rounded px-2 py-1 text-slate-700 truncate select-all"
                  />
                  <button onClick={handleCopyLink} className="p-1 hover:bg-green-100 rounded text-green-700">
                    <Clipboard className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permissions Matrix display */}
      <div className="space-y-4 pt-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center">
          <Key className="h-4 w-4 mr-2 text-primary" /> Workspace Role Permissions Matrix
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">System Scope Capability</th>
                <th className="px-6 py-3">Admin</th>
                <th className="px-6 py-3">Tender Manager</th>
                <th className="px-6 py-3">Contributor</th>
                <th className="px-6 py-3">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-650">
              <tr>
                <td className="px-6 py-3.5 font-semibold text-slate-900">Manage Billing & Settings</td>
                <td className="px-6 py-3.5 text-purple-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-slate-400">✗ No</td>
                <td className="px-6 py-3.5 text-slate-400">✗ No</td>
                <td className="px-6 py-3.5 text-slate-400">✗ No</td>
              </tr>
              <tr className="bg-slate-50/30">
                <td className="px-6 py-3.5 font-semibold text-slate-900">Invite & Remove Members</td>
                <td className="px-6 py-3.5 text-purple-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-blue-600 font-bold">✓ Add Only</td>
                <td className="px-6 py-3.5 text-slate-400">✗ No</td>
                <td className="px-6 py-3.5 text-slate-400">✗ No</td>
              </tr>
              <tr>
                <td className="px-6 py-3.5 font-semibold text-slate-900">Upload Compliance Docs (Vault)</td>
                <td className="px-6 py-3.5 text-purple-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-blue-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-green-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-slate-400">✗ No</td>
              </tr>
              <tr className="bg-slate-50/30">
                <td className="px-6 py-3.5 font-semibold text-slate-900">Draft Proposals with AI Copilot</td>
                <td className="px-6 py-3.5 text-purple-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-blue-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-green-600 font-bold">✓ Full</td>
                <td className="px-6 py-3.5 text-slate-400">✗ No</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
