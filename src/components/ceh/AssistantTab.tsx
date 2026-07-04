'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { speak, stopSpeaking, preloadVoices } from '@/lib/tts';
import { Send, Mic, MicOff, MessageSquare, Volume2, VolumeX, X, Bot, Sparkles, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AssistantTabProps {
  avatarUrl?: string;
  autoSpeak?: boolean;
}

interface SchoolContext {
  students?: any[];
  settings?: Record<string, string>;
  attendanceCount?: number;
  leaderboard?: any[];
}

const welcomeMessage: Message = {
  role: 'assistant',
  content: "Hello! I'm CEH AI, your intelligent assistant for the ClearPath Edu Hub Graduation Ceremony! I can help you with event information, cybersecurity knowledge, career guidance, or just have a friendly chat. How can I help you today?",
  timestamp: new Date()
};

export default function AssistantTab({ avatarUrl, autoSpeak }: AssistantTabProps) {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [autoListen, setAutoListen] = useState(false);
  const [speechSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [recognitionSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [schoolContext, setSchoolContext] = useState<SchoolContext | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef(input);
  const isLoadingRef = useRef(isLoading);
  const messagesRef = useRef(messages);
  const autoListenRef = useRef(autoListen);
  const schoolContextRef = useRef(schoolContext);
  const ttsEnabledRef = useRef(ttsEnabled);

  // Keep refs in sync
  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
  useEffect(() => { schoolContextRef.current = schoolContext; }, [schoolContext]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // Fetch school context for AI (refreshes periodically)
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const [studentsRes, attendanceRes, settingsRes, leaderboardRes] = await Promise.all([
          fetch('/api/students'),
          fetch('/api/attendance'),
          fetch('/api/settings'),
          fetch('/api/leaderboard'),
        ]);
        const [students, attendance, settings, leaderboard] = await Promise.all([
          studentsRes.ok ? studentsRes.json() : [],
          attendanceRes.ok ? attendanceRes.json() : [],
          settingsRes.ok ? settingsRes.json() : {},
          leaderboardRes.ok ? leaderboardRes.json() : [],
        ]);
        setSchoolContext({
          students: Array.isArray(students) ? students : [],
          settings: (settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}) as Record<string, string>,
          attendanceCount: Array.isArray(attendance) ? attendance.length : 0,
          leaderboard: Array.isArray(leaderboard) ? leaderboard : [],
        });
      } catch { /* silent */ }
    };
    fetchContext();
    const interval = setInterval(fetchContext, 30000);
    return () => clearInterval(interval);
  }, []);

  const speakWithCallback = useCallback((text: string, callback?: () => void) => {
    if (!ttsEnabledRef.current) return;
    setIsSpeaking(true);
    speak(text, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => { setIsSpeaking(false); if (callback) callback(); },
      onError: () => setIsSpeaking(false),
    });
  }, []);

  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputRef.current.trim();
    if (!messageText || isLoadingRef.current) return;

    stopListeningRef.current();
    stopSpeaking();
    setIsSpeaking(false);

    const userMessage: Message = { role: 'user', content: messageText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messagesRef.current.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history,
          schoolContext: schoolContextRef.current,
        }),
      });

      const data = await res.json();
      const assistantMessage: Message = { role: 'assistant', content: data.reply, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);

      if (autoListenRef.current) {
        speakWithCallback(data.reply, () => {
          setTimeout(() => startListeningRef.current(), 300);
        });
      } else {
        speakWithCallback(data.reply);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm experiencing a connection issue. Please check your network and try again.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Speech recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      preloadVoices(() => setVoicesLoaded(true));

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (event.results[event.results.length - 1].isFinal) {
            setInput(transcript);
            setIsListening(false);
            inputRef.current = transcript;
            sendMessage();
          } else {
            setInput(transcript);
          }
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }

    return () => {
      stopSpeaking();
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.abort();
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
          setIsListening(true);
        } catch { /* ignore */ }
      }, 100);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      setIsListening(false);
    }
  }, []);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  // Speak welcome message on navigation or first interaction
  const doGreeting = useCallback(() => {
    if (ttsEnabledRef.current && voicesLoaded && !hasInteracted) {
      setHasInteracted(true);
      speakWithCallback(welcomeMessage.content);
    }
  }, [hasInteracted, voicesLoaded, speakWithCallback]);

  const handleFirstInteraction = useCallback(() => {
    if (!hasInteracted) {
      doGreeting();
    }
  }, [hasInteracted, doGreeting]);

  useEffect(() => {
    if (autoSpeak) {
      const timer = setTimeout(() => doGreeting(), 200);
      return () => clearTimeout(timer);
    }
  }, [autoSpeak, doGreeting]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Avatar Section */}
      <div className="flex flex-col items-center justify-center lg:w-1/3 p-6">
        <motion.div
          className="relative"
          animate={isSpeaking ? {
            scale: [1, 1.03, 1],
            rotate: [0, 0.5, -0.5, 0]
          } : { scale: 1, rotate: 0 }}
          transition={{ duration: 1.5, repeat: isSpeaking ? Infinity : 0, ease: "easeInOut" }}
        >
          {/* Avatar Container */}
          <div className="relative w-64 h-64 rounded-full overflow-hidden shadow-2xl border-4 border-[#d4a843]/50">
            {avatarUrl ? (
              <img src={avatarUrl} alt="CEH AI Avatar" className="w-full h-full object-cover" />
            ) : (
              <DefaultAvatar isSpeaking={isSpeaking} />
            )}

            {/* Speaking indicator ring */}
            <AnimatePresence>
              {isSpeaking && (
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-[#d4a843]"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.98, 1.02, 0.98] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </AnimatePresence>

            {/* Listening indicator */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-emerald-400"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.98, 1.03, 0.98] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Status badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-1 ${
              isLoading ? 'bg-amber-100 text-amber-700' :
              isSpeaking ? 'bg-green-100 text-green-700' :
              isListening ? 'bg-blue-100 text-blue-700' :
              'bg-[#fdf8f0] text-[#1a4d2e]'
            }`}>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {isSpeaking && <Volume2 className="w-3 h-3" />}
              {isListening && <Mic className="w-3 h-3 animate-pulse" />}
              <span>{isLoading ? 'Thinking...' : isSpeaking ? 'Speaking' : isListening ? 'Listening...' : 'Ready'}</span>
            </div>
          </div>
        </motion.div>

        <h2 className="mt-6 text-2xl font-bold text-[#1a4d2e]">CEH AI Assistant</h2>
        <p className="text-sm text-[#1a4d2e]/70 mt-1">ClearPath Edu Hub • Graduation 2026</p>

        {/* Quick Controls */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`p-2 rounded-full transition-all ${ttsEnabled ? 'bg-[#1a4d2e] text-white' : 'bg-gray-200 text-gray-500'}`}
            title={ttsEnabled ? 'Disable voice' : 'Enable voice'}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setAutoListen(!autoListen)}
            className={`p-2 rounded-full transition-all ${autoListen ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}
            title={autoListen ? 'Auto-listen ON (speak after AI responds)' : 'Auto-listen OFF'}
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={() => startListening()}
            disabled={!recognitionSupported || isListening || isLoading}
            className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : recognitionSupported ? 'bg-[#1a4d2e] text-white hover:bg-[#1a4d2e]/80' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            title="Start listening"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 rounded-full bg-[#d4a843] text-white transition-all hover:bg-[#d4a843]/80 lg:hidden"
            title="Toggle chat"
          >
            {showChat ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex gap-1 mt-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${autoListen ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            {autoListen ? 'Auto-listen ON' : 'Auto-listen OFF'}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${ttsEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            Voice {ttsEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {!speechSupported && (
          <p className="text-xs text-amber-600 mt-2 text-center">Speech synthesis not supported. Try Chrome or Edge.</p>
        )}
        {speechSupported && !voicesLoaded && (
          <p className="text-xs text-amber-600 mt-2 text-center">Loading voices...</p>
        )}
        {!recognitionSupported && speechSupported && (
          <p className="text-xs text-gray-400 mt-1 text-center">Voice input requires Chrome or Edge</p>
        )}
      </div>

      {/* Chat Section */}
      <div className={`flex flex-col flex-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden ${showChat ? 'flex' : 'hidden lg:flex'}`}>
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-[#1a4d2e] to-[#1a4d2e]/80 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <span className="font-semibold">Conversation</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{messages.length} messages</span>
          </div>
          <button
            onClick={() => setShowChat(!showChat)}
            className="lg:hidden p-1 hover:bg-white/10 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px] lg:max-h-[500px]">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-[#1a4d2e] text-white rounded-br-md'
                  : 'bg-[#fdf8f0] text-gray-800 rounded-bl-md border border-[#d4a843]/20'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-[#fdf8f0] rounded-2xl rounded-bl-md px-4 py-3 border border-[#d4a843]/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#d4a843] animate-spin" />
                  <span className="text-sm text-gray-500">CEH AI is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { handleFirstInteraction(); if (isListening) stopListening(); else startListening(); }}
              disabled={!recognitionSupported}
              className={`flex-shrink-0 p-2.5 rounded-full transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : recognitionSupported
                    ? 'bg-[#1a4d2e]/10 text-[#1a4d2e] hover:bg-[#1a4d2e]/20'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
              title={isListening ? 'Stop listening' : 'Speak to AI'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); handleFirstInteraction(); }}
              onFocus={handleFirstInteraction}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={isListening ? "Listening..." : "Ask CEH AI anything..."}
              className="flex-1 px-4 py-2.5 bg-white rounded-full border border-gray-200 focus:border-[#d4a843] focus:ring-2 focus:ring-[#d4a843]/20 outline-none text-sm"
              disabled={isLoading}
            />

            <button
              onClick={() => { handleFirstInteraction(); sendMessage(); }}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 p-2.5 rounded-full bg-[#d4a843] text-white hover:bg-[#d4a843]/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#d4a843]/20"
              title="Send message"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          {isListening && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-center mt-2 text-red-500 flex items-center justify-center gap-1"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Listening... speak now or click again to stop
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

// Default beautiful human AI avatar built with CSS/SVG
function DefaultAvatar({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#1a4d2e]/10 to-[#fdf8f0] flex items-center justify-center relative">
      <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Background glow */}
        <defs>
          <radialGradient id="glow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#d4a843" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1a4d2e" stopOpacity="0.05" />
          </radialGradient>
          <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D2956A" />
            <stop offset="100%" stopColor="#C68642" />
          </linearGradient>
          <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="100%" stopColor="#16213e" />
          </linearGradient>
          <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a4d2e" />
            <stop offset="100%" stopColor="#0f2d1a" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle cx="100" cy="100" r="98" fill="url(#glow)" />

        {/* Body / Suit */}
        <ellipse cx="100" cy="195" rx="60" ry="40" fill="url(#suitGrad)" />
        <ellipse cx="100" cy="185" rx="55" ry="35" fill="#1a4d2e" />

        {/* Suit collar / lapels */}
        <path d="M75 160 L90 140 L100 155 L110 140 L125 160" fill="#0f2d1a" stroke="#d4a843" strokeWidth="0.5" />

        {/* Tie */}
        <polygon points="100,148 96,158 100,185 104,158" fill="#d4a843" />
        <polygon points="96,158 100,148 104,158 100,162" fill="#e8c46a" />

        {/* Neck */}
        <rect x="90" y="128" width="20" height="18" rx="5" fill="url(#skinGrad)" />

        {/* Hair (back) */}
        <ellipse cx="100" cy="82" rx="42" ry="45" fill="url(#hairGrad)" />

        {/* Face */}
        <ellipse cx="100" cy="90" rx="36" ry="40" fill="url(#skinGrad)" />

        {/* Hair (front/top) */}
        <path d="M64 78 Q65 45 100 40 Q135 45 136 78 Q130 55 100 50 Q70 55 64 78" fill="url(#hairGrad)" />

        {/* Eyebrows */}
        <path d="M78 76 Q85 72 92 76" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M108 76 Q115 72 122 76" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Eyes */}
        <ellipse cx="85" cy="85" rx="7" ry="8" fill="white" />
        <ellipse cx="115" cy="85" rx="7" ry="8" fill="white" />
        <circle cx="85" cy="85" r="4.5" fill="#2C1810" />
        <circle cx="115" cy="85" r="4.5" fill="#2C1810" />
        <circle cx="87" cy="83" r="1.5" fill="white" />
        <circle cx="117" cy="83" r="1.5" fill="white" />

        {/* Nose */}
        <path d="M100 88 Q97 98 100 100 Q103 98 100 88" fill="#B87A4B" opacity="0.5" />

        {/* Mouth */}
        {isSpeaking ? (
          <motion.ellipse
            cx="100" cy="110" rx="8" ry="5" fill="#C0392B"
            animate={{ ry: [3, 7, 4, 6, 3], rx: [6, 9, 7, 8, 6] }}
            transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <path d="M92 108 Q100 114 108 108" stroke="#C0392B" strokeWidth="2" fill="#D35400" fillOpacity="0.3" strokeLinecap="round" />
        )}

        {/* Ears */}
        <ellipse cx="62" cy="88" rx="5" ry="8" fill="url(#skinGrad)" />
        <ellipse cx="138" cy="88" rx="5" ry="8" fill="url(#skinGrad)" />

        {/* CEH Badge */}
        <rect x="82" y="162" width="36" height="12" rx="2" fill="#d4a843" />
        <text x="100" y="171" textAnchor="middle" fontSize="7" fill="#1a4d2e" fontWeight="bold">CEH AI</text>

        {/* Decorative particles */}
        {isSpeaking && (
          <>
            <motion.circle cx="40" cy="50" r="2" fill="#d4a843" opacity="0.6" animate={{ cy: [50, 40, 50], opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
            <motion.circle cx="160" cy="60" r="1.5" fill="#1a4d2e" opacity="0.4" animate={{ cy: [60, 50, 60], opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} />
            <motion.circle cx="50" cy="150" r="2" fill="#d4a843" opacity="0.5" animate={{ cx: [50, 55, 50], opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }} />
            <motion.circle cx="155" cy="140" r="1.5" fill="#1a4d2e" opacity="0.3" animate={{ cy: [140, 130, 140] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.7 }} />
          </>
        )}
      </svg>
    </div>
  );
}
