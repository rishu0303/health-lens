import { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Auth from './Auth'; 
import { 
  UploadCloud, MessageSquare, FileText, Activity, 
  LayoutDashboard, Settings, Search, Send, Loader2, CheckCircle, LogOut, RefreshCw, Database
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5003';

function formatAnswer(answer, options = {}) {
  const { includeDisclaimer = true } = options;

  if (typeof answer === 'string') return answer;

  if (answer?.answer) {
    const parts = [];
    if (answer.medicalContext === 'report_interpretation') {
      parts.push('Mode: Report interpretation');
    } else if (answer.medicalContext === 'educational_info') {
      parts.push('Mode: Educational information');
    } else if (answer.medicalContext === 'mixed') {
      parts.push('Mode: Report interpretation + educational information');
    } else if (answer.medicalContext === 'out_of_scope') {
      parts.push('Mode: Outside report scope');
    } else if (answer.medicalContext === 'safety_refusal') {
      parts.push('Mode: Safety refusal');
    }

    parts.push(answer.answer);

    if (answer.emergencyWarning) {
      parts.push(answer.emergencyWarning);
    }

    if (answer.knowledgeBaseNotice) {
      parts.push(answer.knowledgeBaseNotice);
    }

    if (Array.isArray(answer.citations) && answer.citations.length > 0) {
      const citations = answer.citations
        .map((item, index) => {
          const page = item.page ? `, page ${item.page}` : '';
          const score = typeof item.score === 'number' ? ` (${Math.round(item.score * 100)}% match)` : '';
          return `${index + 1}. ${item.source || 'Knowledge base'}${page}${score}`;
        })
        .join('\n');
      parts.push(`Sources:\n${citations}`);
    }

    if (answer.disclaimer && includeDisclaimer) {
      parts.push(answer.disclaimer);
    }

    if (Array.isArray(answer.followUpQuestions) && answer.followUpQuestions.length > 0) {
      parts.push(`Follow-up questions:\n${answer.followUpQuestions.map((item) => `- ${item}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  return 'I received a response, but could not display it.';
}

function getApiErrorMessage(error) {
  return error.response?.data?.details || error.response?.data?.message || error.message;
}

function getKnowledgeReadinessLabel(status) {
  if (!status) return 'Checking';
  if (status.ready) return 'Ready';
  if (status.chunkCount === 0) return 'Syncing';
  return 'Not Ready';
}

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('medinsight_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [token, setToken] = useState(localStorage.getItem('medinsight_token'));

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!token ? <Auth setToken={setToken} /> : <Navigate to="/" />} />
        <Route path="/" element={token ? <Dashboard setToken={setToken} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

function Dashboard({ setToken }) {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', content: 'Hello! I am MedInsight. How can I help you analyze your reports today?' }
  ]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [hasShownMedicalDisclaimer, setHasShownMedicalDisclaimer] = useState(false);
  const [knowledgeStatus, setKnowledgeStatus] = useState(null);
  const [isRefreshingKnowledge, setIsRefreshingKnowledge] = useState(false);
  const [isSyncingKnowledge, setIsSyncingKnowledge] = useState(false);
  
  // FIXED: New state to hold the uploaded report's database ID
  const [currentReportId, setCurrentReportId] = useState(null);
  
  const fileInputRef = useRef(null);

  const refreshKnowledgeStatus = async () => {
    setIsRefreshingKnowledge(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/reports/knowledge-base/status`);
      setKnowledgeStatus(response.data.status);
    } catch (error) {
      setKnowledgeStatus({
        ready: false,
        provider: 'knowledge_base',
        lastError: getApiErrorMessage(error),
      });
    } finally {
      setIsRefreshingKnowledge(false);
    }
  };

  useEffect(() => {
    refreshKnowledgeStatus();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('medinsight_token');
    setToken(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('report', file); 

    try {
      const response = await axios.post(`${API_BASE_URL}/api/reports/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('success');
      
      // FIXED: Save the ID returned from the backend so the chat can use it
      const reportId = response.data?.report?._id || response.data?.report?.id;
      if (reportId) {
        setCurrentReportId(reportId);
      }
      setHasShownMedicalDisclaimer(false);

      setChatHistory(prev => [...prev, { role: 'ai', content: `I've successfully processed "${file.name}". You can now ask me questions about it!` }]);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSyncKnowledgeBase = async () => {
    setIsSyncingKnowledge(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/reports/knowledge-base/sync`, {});
      setKnowledgeStatus(response.data.status);
      setChatHistory(prev => [...prev, {
        role: 'ai',
        content: 'Knowledge base synced successfully.',
      }]);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setChatHistory(prev => [...prev, {
        role: 'ai',
        content: `Knowledge base sync failed. ${message}`,
      }]);
      await refreshKnowledgeStatus();
    } finally {
      setIsSyncingKnowledge(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    const userQuestion = question;
    setChatHistory(prev => [...prev, { role: 'user', content: userQuestion }]);
    setQuestion('');
    setIsQuerying(true);
    
    try {
      let response;
      
      // FIXED: Conditional routing. Report specific vs. Global KB
      if (currentReportId) {
        response = await axios.post(`${API_BASE_URL}/api/reports/${currentReportId}/chat`, { 
          question: userQuestion 
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/api/reports/query`, { 
          question: userQuestion 
        });
      }
      
      const answer = response.data.answer;
      const shouldShowDisclaimer = Boolean(answer?.disclaimer) && !hasShownMedicalDisclaimer;
      setChatHistory(prev => [...prev, {
        role: 'ai',
        content: formatAnswer(answer, { includeDisclaimer: shouldShowDisclaimer }),
      }]);
      if (shouldShowDisclaimer) {
        setHasShownMedicalDisclaimer(true);
      }
    } catch (error) {
      console.error("Error asking AI:", error);
      if (error.response && error.response.status === 401) {
        handleLogout(); 
      } else {
        const fallback = currentReportId
          ? "Sorry, I couldn't analyze that report right now."
          : "Sorry, there was an error connecting to the MedInsight knowledge base.";
        const detail = getApiErrorMessage(error);

        setChatHistory(prev => [...prev, { role: 'ai', content: detail ? `${fallback} ${detail}` : fallback }]);
      }
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] font-sans text-stone-800 overflow-hidden">
      <aside className="w-64 flex flex-col justify-between bg-white border-r border-stone-200 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.05)] z-10">
        <div>
          <div className="h-20 flex items-center px-8 border-b border-stone-100">
            <Activity className="text-amber-900 mr-3" size={26} strokeWidth={2.5} />
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-900 to-amber-700 bg-clip-text text-transparent tracking-tight">MedInsight</h1>
          </div>
          <nav className="p-4 space-y-2 mt-4">
            <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <NavItem icon={<FileText size={20} />} label="Patient Reports" />
            <NavItem icon={<MessageSquare size={20} />} label="Knowledge Base" active />
          </nav>
        </div>
        <div className="p-4 border-t border-stone-100">
          <NavItem icon={<Settings size={20} />} label="Settings" />
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-red-600 hover:bg-red-50 mt-2">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen relative">
        <header className="h-20 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-10">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 bg-stone-100 border-none rounded-xl focus:ring-2 focus:ring-amber-900/20 outline-none" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-amber-900 p-0.5"><div className="w-full h-full bg-white rounded-full overflow-hidden"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=medinsight" alt="Avatar" className="w-full h-full object-cover" /></div></div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto h-full flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/3 flex flex-col gap-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex-1 flex flex-col">
                <h2 className="text-base font-semibold text-stone-800 mb-1">Add Medical Record</h2>
                <p className="text-sm text-stone-500 mb-6">Upload PDFs to expand the AI's knowledge base.</p>
                <div className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-all cursor-pointer group relative overflow-hidden ${uploadStatus === 'error' ? 'border-red-300 bg-red-50' : uploadStatus === 'success' ? 'border-green-300 bg-green-50' : 'border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-amber-900/30'}`}>
                  <input type="file" ref={fileInputRef} className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" accept=".pdf" onChange={handleFileUpload} disabled={isUploading}/>
                  {isUploading ? (<div className="flex flex-col items-center text-amber-900"><Loader2 size={36} className="animate-spin mb-4" /><span className="text-sm font-medium">Processing...</span></div>) : uploadStatus === 'success' ? (<div className="flex flex-col items-center text-green-700"><CheckCircle size={36} className="mb-4" /><span className="text-sm font-medium">Upload Complete!</span></div>) : (<><div className="h-14 w-14 bg-white shadow-sm border border-stone-200 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"><UploadCloud className="text-stone-500 group-hover:text-amber-900" size={28} /></div><span className="text-sm font-medium text-stone-700">Drag & drop or click</span></>)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-900 to-amber-800 rounded-2xl p-6 text-white shadow-md relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
                  <div>
                    <h3 className="font-medium text-stone-200 mb-1">Knowledge Base Status</h3>
                    <div className="text-3xl font-bold">{getKnowledgeReadinessLabel(knowledgeStatus)}</div>
                  </div>
                  <Database size={24} className="text-amber-200 shrink-0" />
                </div>
                <div className="space-y-2 text-sm text-stone-100 relative z-10">
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${knowledgeStatus?.ready ? 'bg-emerald-300 animate-pulse' : 'bg-amber-300'}`}></span>
                    {knowledgeStatus?.provider === 'pinecone' ? 'Vector knowledge base' : 'Local knowledge base'}
                  </div>
                  {knowledgeStatus?.chunkCount !== null && knowledgeStatus?.chunkCount !== undefined && (
                    <div className="text-stone-200">Sources indexed: {knowledgeStatus.chunkCount}</div>
                  )}
                  {knowledgeStatus?.lastError && (
                    <div className="text-red-100 text-xs leading-relaxed">{knowledgeStatus.lastError}</div>
                  )}
                </div>
                <div className="mt-5 flex gap-2 relative z-10">
                  <button
                    type="button"
                    onClick={refreshKnowledgeStatus}
                    disabled={isRefreshingKnowledge || isSyncingKnowledge}
                    className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    {isRefreshingKnowledge ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncKnowledgeBase}
                    disabled={isRefreshingKnowledge || isSyncingKnowledge}
                    className="flex items-center justify-center gap-2 rounded-lg bg-white text-amber-950 px-3 py-2 text-xs font-semibold hover:bg-amber-50 disabled:opacity-60"
                  >
                    {isSyncingKnowledge ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                    Sync
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                <div><h2 className="text-base font-semibold text-stone-800">AI Assistant</h2></div>
                <div className="px-3 py-1 bg-white border border-stone-200 rounded-full text-xs font-medium text-stone-600 shadow-sm flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>Gemini 3.1 Flash-Lite</div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] whitespace-pre-line p-4 text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-amber-900 text-white rounded-2xl rounded-tr-sm' : 'bg-white border border-stone-200 text-stone-700 rounded-2xl rounded-tl-sm'}`}>{msg.content}</div>
                  </div>
                ))}
                {isQuerying && (<div className="flex justify-start"><div className="bg-white border border-stone-200 text-stone-500 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-3"><Loader2 size={18} className="animate-spin text-amber-900" /><span className="text-sm">Analyzing...</span></div></div>)}
              </div>

              <div className="p-5 bg-white border-t border-stone-100">
                <form onSubmit={handleAskQuestion} className="relative flex items-center">
                  <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={isQuerying} placeholder="Ask about patient conditions..." className="w-full bg-stone-50 border border-stone-200 rounded-full py-3.5 pl-6 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/30 shadow-inner" />
                  <button type="submit" disabled={!question.trim() || isQuerying} className={`absolute right-2 p-2 rounded-full flex items-center justify-center ${question.trim() && !isQuerying ? 'bg-amber-900 text-white hover:bg-amber-950' : 'bg-stone-100 text-stone-400'}`}><Send size={18} className="translate-x-[-1px] translate-y-[1px]" /></button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active }) {
  return (
    <a href="#" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? 'bg-stone-100 border border-stone-200 text-amber-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'}`}>
      <span className={active ? 'text-amber-900' : 'text-stone-400'}>{icon}</span>{label}
    </a>
  );
}

export default App;
