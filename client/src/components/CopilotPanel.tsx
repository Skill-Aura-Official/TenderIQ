import React, { useState, useEffect, useRef } from 'react';
import { Send, FileText, Download, Sparkles, History, X, ChevronRight, CornerDownRight, MessageSquare, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface CopilotPanelProps {
  tenderId: string;
  api: any;
  userTier: string;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function CopilotPanel({ tenderId, api, userTier, onClose }: CopilotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [draftingProposal, setDraftingProposal] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadConversations();
  }, [tenderId]);

  const loadConversations = async () => {
    try {
      const list = await api.getConversations();
      const tenderConvs = list.filter((c: any) => c.tenderId === tenderId);
      setConversations(tenderConvs);
      if (tenderConvs.length > 0) {
        // Load the latest conversation automatically
        loadConversationDetail(tenderConvs[0].id);
      }
    } catch (e) {
      console.warn("Failed to load conversations:", e);
    }
  };

  const loadConversationDetail = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.getConversation(id);
      setConversationId(detail.id);
      setMessages(detail.messages.map((m: any) => ({
        role: m.role,
        content: m.content
      })));
      setShowHistory(false);
    } catch (e: any) {
      toast.error("Failed to load conversation history");
    } finally {
      setLoading(false);
    }
  };

  const handleStartNew = () => {
    setConversationId(null);
    setMessages([]);
    setGeneratedProposal(null);
    setShowHistory(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:5000/api/v1/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await api.syncUser().then(() => api.getMe().then(() => 'token_placeholder'))}` // Handled by API request interceptor in production
        },
        body: JSON.stringify({
          tenderId,
          conversationId,
          message: userMsg
        })
      });

      // Simple implementation of custom fetch auth forwarding
      if (!response.ok) {
        throw new Error(response.status === 403 ? "UPGRADE_REQUIRED" : "Failed to connect to AI server");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';

      // Set up streaming placeholder
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let buffer = '';
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.metadata) {
                setConversationId(parsed.metadata.conversationId);
              }
              if (parsed.content) {
                assistantResponse += parsed.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantResponse
                  };
                  return updated;
                });
              }
            } catch (e) {
              // Ignore partial chunk parsing errors
            }
          }
        }
      }
    } catch (err: any) {
      if (err.message === "UPGRADE_REQUIRED") {
        toast.error("AI Bid Copilot requires Starter plan or above.");
      } else {
        toast.error("Failed to generate AI response.");
      }
    } finally {
      setLoading(false);
      loadConversations();
    }
  };

  const handleGenerateProposal = async () => {
    if (!conversationId) {
      toast.error("Please chat with the assistant first to build context");
      return;
    }
    setDraftingProposal(true);
    try {
      const res = await api.generateProposal(tenderId, conversationId);
      setGeneratedProposal(res);
      toast.success("Draft Proposal compiled successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to compile proposal");
    } finally {
      setDraftingProposal(false);
    }
  };

  const handleExportWord = async () => {
    if (!generatedProposal) return;
    try {
      const blob = await api.exportProposal(generatedProposal.proposalId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedProposal.title || 'Tender_Proposal'}.doc`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("Exported Word document successfully!");
    } catch (e) {
      toast.error("Failed to export Word document");
    }
  };

  return (
    <div className="w-[480px] bg-slate-900 border-l border-slate-800 flex flex-col h-full text-slate-100 shadow-2xl relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60 backdrop-blur">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-violet-400 animate-pulse" />
          <div>
            <h2 className="font-bold text-sm text-white flex items-center">
              AI Bid Copilot
              <span className="ml-2 text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded uppercase font-semibold">
                {userTier === 'enterprise' ? 'Claude 3.5' : userTier === 'pro' ? 'GPT-4o' : 'Gemini'}
              </span>
            </h2>
            <p className="text-[10px] text-slate-450">Prepare draft proposals & qualifying documents</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            title="Conversation History"
          >
            <History className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* History Overlay Sidebar */}
      {showHistory && (
        <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col p-6 space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center"><History className="h-4 w-4 mr-2 text-primary" /> Past Conversations</h3>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <button 
            onClick={handleStartNew}
            className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-semibold flex items-center justify-center space-x-2 transition"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Start New Conversation</span>
          </button>
          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.map((c) => (
              <div 
                key={c.id} 
                onClick={() => loadConversationDetail(c.id)}
                className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer transition text-xs flex justify-between items-center"
              >
                <div className="truncate pr-4">
                  <p className="font-medium text-slate-200 truncate">{c.title}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{new Date(c.updatedAt).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat viewport */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-950 to-slate-900">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-4">
            <div className="h-12 w-12 bg-violet-500/10 rounded-full border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="font-bold text-sm text-white">How can I assist with this Bid?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ask me to write the technical approach, check MSME eligibility exemptions, outline project timelines, or identify qualifying certificates.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-4 w-full text-left">
              {[
                "Analyze eligibility requirements",
                "Draft technical approach",
                "Check document compliance",
                "Generate executive summary"
              ].map((suggestion, idx) => (
                <button 
                  key={idx}
                  onClick={() => setInput(suggestion)}
                  className="p-3 bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-lg text-[10px] text-slate-400 hover:text-slate-200 text-left transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-violet-600 text-white rounded-br-none' 
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Generated Proposal Drawer Section */}
      {generatedProposal && (
        <div className="bg-slate-950 border-t border-slate-800 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-violet-400 flex items-center uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5 mr-1 text-violet-400" /> Draft Proposal Ready
            </span>
            <button 
              onClick={handleExportWord}
              className="px-2.5 py-1 bg-white text-slate-950 font-bold hover:bg-slate-100 rounded text-[10px] flex items-center space-x-1 transition shadow-sm"
            >
              <Download className="h-3 w-3" />
              <span>Export Word (.doc)</span>
            </button>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg text-[11px] text-slate-400 max-h-24 overflow-y-auto font-mono">
            {generatedProposal.content.substring(0, 300)}...
          </div>
        </div>
      )}

      {/* Form Submission */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col space-y-3">
        <div className="flex items-center space-x-2">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask AI Bid Assistant..."
            className="flex-1 bg-slate-900 border border-slate-850 text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500 flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" /> Approximated tokens used in session
          </span>
          <button 
            type="button"
            onClick={handleGenerateProposal}
            disabled={draftingProposal || !conversationId}
            className="text-[10px] font-bold text-violet-400 hover:text-violet-300 disabled:text-slate-600 transition flex items-center space-x-1"
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span>{draftingProposal ? "Compiling..." : "Assemble Proposal Draft"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
