const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Core request function that automatically attaches the Clerk session token
 * to every API call. No static tokens, no localStorage — fully real-time.
 */
async function request(path: string, options: RequestInit = {}, getToken?: () => Promise<string | null>) {
  const headers = new Headers(options.headers || {});

  // Get the Clerk session token if a getToken function is provided
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (e) {
      console.warn("Failed to get auth token", e);
    }
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    // Ensure real-time: never cache API responses
    cache: 'no-store',
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Creates an API client instance bound to a Clerk session token getter.
 * Usage in components:
 *   const { getToken } = useAuth();
 *   const apiClient = createApiClient(getToken);
 *   const tenders = await apiClient.getTenders();
 */
export function createApiClient(getToken: () => Promise<string | null>) {
  return {
    // Auth
    async syncUser() {
      const res = await request('/auth/sync', { method: 'POST' }, getToken);
      return res.data;
    },

    async onboard(data: { email: string; orgName?: string; orgId?: string }) {
      const res = await request('/auth/onboard', {
        method: 'POST',
        body: JSON.stringify(data),
      }, getToken);
      return res.data;
    },

    async getMe() {
      const res = await request('/auth/me', {}, getToken);
      return res.data;
    },

    // Profile
    async getProfile() {
      const res = await request('/users/me/profile', {}, getToken);
      return res.data;
    },

    async saveProfile(profileData: any) {
      const res = await request('/users/me/profile', {
        method: 'POST',
        body: JSON.stringify(profileData),
      }, getToken);
      return res.data;
    },

    async getScoreStatus() {
      const res = await request('/users/me/score-status', {}, getToken);
      return res.data;
    },

    // Tenders
    async getTenders(filters: Record<string, string> = {}) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.set(key, val);
      });
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await request(`/tenders${queryString}`, {}, getToken);
      return res;
    },

    async getTender(id: string, lang?: string) {
      const queryString = lang ? `?lang=${lang}` : '';
      const res = await request(`/tenders/${id}${queryString}`, {}, getToken);
      return res.data;
    },

    async createTender(data: any) {
      const res = await request('/tenders', {
        method: 'POST',
        body: JSON.stringify(data),
      }, getToken);
      return res.data;
    },

    async assignTender(tenderId: string, targetUserId: string) {
      const res = await request(`/tenders/${tenderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }, getToken);
      return res.data;
    },

    // Pipeline
    async getPipeline() {
      const res = await request('/pipeline', {}, getToken);
      return res.data;
    },

    async addToPipeline(tenderId: string, stage?: string) {
      const res = await request('/pipeline', {
        method: 'POST',
        body: JSON.stringify({ tenderId, stage }),
      }, getToken);
      return res.data;
    },

    async updatePipelineStage(tenderId: string, stage: string) {
      const res = await request(`/pipeline/${tenderId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      }, getToken);
      return res.data;
    },

    async updatePipelineNotes(tenderId: string, notes: string) {
      const res = await request(`/pipeline/${tenderId}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      }, getToken);
      return res.data;
    },

    async removeFromPipeline(tenderId: string) {
      const res = await request(`/pipeline/${tenderId}`, {
        method: 'DELETE',
      }, getToken);
      return res.data;
    },

    // Vault
    async getDocuments() {
      const res = await request('/vault/documents', {}, getToken);
      return res.data;
    },

    async getUploadUrl(filename: string, docType: string) {
      const res = await request('/vault/upload-url', {
        method: 'POST',
        body: JSON.stringify({ filename, docType }),
      }, getToken);
      return res.data;
    },

    async confirmUpload(data: { gcsKey: string; docType: string; displayName: string; fileSize?: number; mimeType?: string }) {
      const res = await request('/vault/documents', {
        method: 'POST',
        body: JSON.stringify(data),
      }, getToken);
      return res.data;
    },

    async deleteDocument(id: string) {
      const res = await request(`/vault/documents/${id}`, {
        method: 'DELETE',
      }, getToken);
      return res.data;
    },

    async getDownloadUrl(id: string) {
      const res = await request(`/vault/documents/${id}/download-url`, {}, getToken);
      return res.data;
    },

    async getAdminMetrics() {
      const res = await request('/admin/metrics', {}, getToken);
      return res.data;
    },

    // Copilot
    async getConversations() {
      const res = await request('/copilot/conversations', {}, getToken);
      return res.data;
    },

    async getConversation(id: string) {
      const res = await request(`/copilot/conversations/${id}`, {}, getToken);
      return res.data;
    },

    async generateProposal(tenderId: string, conversationId: string, title?: string) {
      const res = await request('/copilot/generate-proposal', {
        method: 'POST',
        body: JSON.stringify({ tenderId, conversationId, title }),
      }, getToken);
      return res.data;
    },

    async exportProposal(proposalId: string) {
      // Return raw response since we need the blob/msword output for downloading
      const token = getToken ? await getToken() : null;
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('Content-Type', 'application/json');

      const response = await fetch(`${API_BASE}/copilot/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ proposalId }),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      return response.blob();
    },

    // L1 Intelligence
    async getL1Rates(category: string, state: string) {
      const res = await request(`/intelligence/l1-rates?category=${category}&state=${state}`, {}, getToken);
      return res.data;
    },

    async getSimilarResults(tenderId: string) {
      const res = await request(`/intelligence/tender/${tenderId}/similar-results`, {}, getToken);
      return res.data;
    },

    async getCompetitors(category?: string, state?: string) {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (state) params.set('state', state);
      const res = await request(`/intelligence/competitors?${params.toString()}`, {}, getToken);
      return res.data;
    },

    async getMarketReport() {
      const res = await request('/intelligence/market-report', {}, getToken);
      return res.data;
    },

    // Team Workspace
    async getTeamMembers() {
      const res = await request('/team/members', {}, getToken);
      return res.data;
    },

    async inviteTeamMember(email: string, role: string) {
      const res = await request('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }, getToken);
      return res.data;
    },

    async acceptInvitation(token: string) {
      const res = await request(`/team/invite/${token}/accept`, {
        method: 'POST',
      }, getToken);
      return res.data;
    },

    async updateTeamMemberRole(userId: string, role: string) {
      const res = await request(`/team/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }, getToken);
      return res.data;
    },

    async removeTeamMember(userId: string) {
      const res = await request(`/team/members/${userId}`, {
        method: 'DELETE',
      }, getToken);
      return res.data;
    },

    // Referral Engine
    async generateReferralCode(referredEmail: string) {
      const res = await request('/referral/generate', {
        method: 'POST',
        body: JSON.stringify({ referredEmail }),
      }, getToken);
      return res.data;
    },

    async getReferralStats() {
      const res = await request('/referral/stats', {}, getToken);
      return res.data;
    },

    async trackReferral(referralCode: string) {
      const res = await request('/referral/track', {
        method: 'POST',
        body: JSON.stringify({ referralCode }),
      }, getToken);
      return res.data;
    },
  };
}

// Legacy named export for backward compatibility during migration
export const api = {
  _deprecated: true as const,
  message: 'Use createApiClient(getToken) instead. See client/src/lib/api.ts for usage.',
};
