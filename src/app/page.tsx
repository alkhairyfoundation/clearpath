'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Camera, Gamepad2, Shield, Home, GraduationCap, Sparkles, ChevronRight, Menu, X } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import AssistantTab from '@/components/ceh/AssistantTab';
import AttendanceTab from '@/components/ceh/AttendanceTab';
import QuizTab from '@/components/ceh/QuizTab';
import AdminTab from '@/components/ceh/AdminTab';

type Tab = 'home' | 'assistant' | 'attendance' | 'quiz' | 'admin';

interface Student {
  id: string;
  name: string;
  email: string;
  department: string;
}

const tabs: { key: Tab; label: string; icon: any; color: string }[] = [
  { key: 'home', label: 'Home', icon: Home, color: 'from-[#1a4d2e] to-[#2d6b3f]' },
  { key: 'assistant', label: 'AI Assistant', icon: Bot, color: 'from-[#d4a843] to-[#e8c46a]' },
  { key: 'attendance', label: 'Attendance', icon: Camera, color: 'from-blue-600 to-blue-700' },
  { key: 'quiz', label: 'Quiz Challenge', icon: Gamepad2, color: 'from-purple-600 to-purple-700' },
  { key: 'admin', label: 'Admin', icon: Shield, color: 'from-gray-700 to-gray-800' },
];

export default function CEHApp() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [students, setStudents] = useState<Student[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assistantAutoSpeak, setAssistantAutoSpeak] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setStudents(data);
    } catch { /* silent */ }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
    } catch { /* silent */ }
  }, []);

  const studentsInitRef = useRef(false);
  useEffect(() => {
    if (studentsInitRef.current) return;
    studentsInitRef.current = true;
    (async () => {
      try {
        const [studentsRes, settingsRes] = await Promise.all([
          fetch('/api/students'),
          fetch('/api/settings'),
        ]);
        if (studentsRes.ok) {
          const studentsData = await studentsRes.json();
          if (Array.isArray(studentsData)) setStudents(studentsData);
        }
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.avatarUrl) setAvatarUrl(settingsData.avatarUrl);
        }
      } catch { /* silent */ }
    })();
  }, []);

  const handleStudentChange = useCallback(() => {
    fetchStudents();
  }, [fetchStudents]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a4d2e] to-[#1a4d2e]/90 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#d4a843]/20 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-[#d4a843]" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">CEH AI</h1>
              <p className="text-[10px] text-white/60 hidden sm:block">ClearPath Edu Hub • Graduation 2026</p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { if (tab.key === 'assistant') setAssistantAutoSpeak(true); setActiveTab(tab.key); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === tab.key 
                    ? 'bg-white/20 text-white' 
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-white/10 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-white/10"
            >
              <div className="px-4 py-2 space-y-1">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { if (tab.key === 'assistant') setAssistantAutoSpeak(true); setActiveTab(tab.key); setMobileMenuOpen(false); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      activeTab === tab.key ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <HomeTab key="home" onNavigate={(tab) => { if (tab === 'assistant') setAssistantAutoSpeak(true); setActiveTab(tab); }} studentCount={students.length} />}
          {activeTab === 'assistant' && <motion.div key="assistant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><ErrorBoundary componentName="AI Assistant"><AssistantTab avatarUrl={avatarUrl} autoSpeak={assistantAutoSpeak} /></ErrorBoundary></motion.div>}
          {activeTab === 'attendance' && <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><ErrorBoundary componentName="Attendance"><AttendanceTab /></ErrorBoundary></motion.div>}
          {activeTab === 'quiz' && <motion.div key="quiz" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><ErrorBoundary componentName="Quiz"><QuizTab /></ErrorBoundary></motion.div>}
          {activeTab === 'admin' && <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><ErrorBoundary componentName="Admin"><AdminTab onStudentChange={handleStudentChange} /></ErrorBoundary></motion.div>}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a4d2e] text-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-white/60">Consciousness • Competence • Character</p>
          <p className="text-[10px] text-white/40 mt-1">Built by ClearPath Students • Directed by Odebunmi Tawwāb • © 2026</p>
        </div>
      </footer>
    </div>
  );
}

// HOME TAB COMPONENT
function HomeTab({ onNavigate, studentCount }: { onNavigate: (tab: Tab) => void; studentCount: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-[#1a4d2e] via-[#1a4d2e]/95 to-[#0f2d1a] rounded-3xl p-8 md:p-12 text-white overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-[#d4a843]/10 animate-float" />
        <div className="absolute bottom-8 left-8 w-12 h-12 rounded-full bg-[#d4a843]/15 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/4 w-6 h-6 rounded-full bg-white/10 animate-float" style={{ animationDelay: '4s' }} />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#d4a843]" />
            <span className="text-xs font-medium text-[#d4a843] bg-[#d4a843]/10 px-3 py-1 rounded-full">End of Year / Graduation Ceremony 2026</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-3 leading-tight">
            Welcome to <span className="text-[#d4a843]">CEH AI</span>
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-xl leading-relaxed">
            Your intelligent companion for the ClearPath Edu Hub graduation celebration. Explore our AI Assistant, mark your attendance, and test your cybersecurity knowledge!
          </p>
          
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => onNavigate('assistant')}
              className="px-5 py-2.5 bg-[#d4a843] text-[#1a4d2e] rounded-xl font-semibold text-sm hover:bg-[#e8c46a] transition-all flex items-center gap-2 shadow-lg shadow-[#d4a843]/20"
            >
              <Bot className="w-4 h-4" /> Talk to AI
            </button>
            <button
              onClick={() => onNavigate('quiz')}
              className="px-5 py-2.5 bg-white/10 text-white rounded-xl font-medium text-sm hover:bg-white/20 transition-all flex items-center gap-2 backdrop-blur"
            >
              <Gamepad2 className="w-4 h-4" /> Take Quiz
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {tabs.filter(t => t.key !== 'home' && t.key !== 'admin').map((tab) => (
          <motion.button
            key={tab.key}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate(tab.key)}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left hover:shadow-md transition-all group"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tab.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <tab.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-800 text-lg">{tab.label}</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {tab.key === 'assistant' && 'Chat with our AI assistant, ask questions about cybersecurity, careers, and the ceremony.'}
              {tab.key === 'attendance' && 'Mark your attendance using face recognition or manual check-in for the graduation.'}
              {tab.key === 'quiz' && 'Challenge yourself with 80 cybersecurity questions across 5 categories.'}
            </p>
            <div className="mt-3 flex items-center gap-1 text-[#d4a843] text-sm font-medium group-hover:gap-2 transition-all">
              Open <ChevronRight className="w-4 h-4" />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#fdf8f0] to-white rounded-2xl p-6 border border-[#d4a843]/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#1a4d2e]/10 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-[#1a4d2e]" />
            </div>
            <span className="text-sm font-medium text-gray-600">Registered Students</span>
          </div>
          <p className="text-3xl font-bold text-[#1a4d2e]">{studentCount}</p>
          <p className="text-xs text-gray-400 mt-1">Ready for the ceremony</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a4d2e]/5 to-white rounded-2xl p-6 border border-[#1a4d2e]/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#d4a843]/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#d4a843]" />
            </div>
            <span className="text-sm font-medium text-gray-600">Motto</span>
          </div>
          <p className="text-lg font-bold text-[#1a4d2e] leading-tight">Consciousness • Competence • Character</p>
          <p className="text-xs text-gray-400 mt-1">ClearPath Edu Hub values</p>
        </div>
      </div>

      {/* Admin Access Card */}
      <button
        onClick={() => onNavigate('admin')}
        className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-all flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Admin Portal</p>
            <p className="text-xs text-gray-400">Manage students, settings, and view statistics</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </button>
    </motion.div>
  );
}
