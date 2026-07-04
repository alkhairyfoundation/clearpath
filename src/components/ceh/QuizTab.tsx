'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Trophy, Clock, Star, Zap, ChevronRight, RotateCcw,
  Volume2, VolumeX, Crown, Medal, Award, Target, CheckCircle,
  XCircle, Users, Swords, Plus, Trash2, User, UserCheck
} from 'lucide-react';
import { speak, stopSpeaking, preloadVoices } from '@/lib/tts';
import { quizQuestions, quizCategories, QuizQuestion } from '@/lib/quiz-data';
import { playCorrect, playWrong, playNext, playEnd } from '@/lib/sounds';

type GamePhase =
  | 'menu'
  | 'single-setup'
  | 'single-playing'
  | 'single-result'
  | 'battle-setup'
  | 'battle-playing'
  | 'battle-result';

interface Participant {
  id: number;
  name: string;
  score: number;
  answers: (number | null)[];  // index of selected answer per question, null if unanswered
  finished: boolean;
}

interface QuizSection {
  id: string;
  name: string;
  description?: string;
  questions: { id: string; question: string; options: string[]; correct: number; points: number }[];
}

const COLORS = ['#1a4d2e', '#d4a843', '#2563eb', '#dc2626', '#7c3aed', '#0891b2', '#ca8a04', '#be185d'];

export default function QuizTab() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  // Single player state
  const [playerName, setPlayerName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [lifelines, setLifelines] = useState({ fiftyFifty: 1, skip: 1 });
  const [streak, setStreak] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [questionSource, setQuestionSource] = useState<'builtin' | 'custom'>('builtin');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [confettiPieces, setConfettiPieces] = useState<any[]>([]);
  const [removedOptions, setRemovedOptions] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timerRunningRef = useRef(false);

  // Battle state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [battleSection, setBattleSection] = useState<string>('all');
  const [customSections, setCustomSections] = useState<QuizSection[]>([]);
  const [battleStartTime, setBattleStartTime] = useState(0);
  const [showAllAnswered, setShowAllAnswered] = useState(false);

  const leaderboardInitRef = useRef(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  // Preload TTS voices on mount
  useEffect(() => { preloadVoices(); }, []);

  const speakIfEnabled = useCallback((text: string) => {
    if (voiceEnabled) speak(text);
  }, [voiceEnabled]);

  // Fetch leaderboard
  useEffect(() => {
    if (leaderboardInitRef.current) return;
    leaderboardInitRef.current = true;
    const doFetch = async () => {
      try {
        const res = await fetch('/api/leaderboard');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setLeaderboardData(data);
      } catch { /* silent */ }
    };
    doFetch();
  }, []);

  // Fetch custom quiz sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch('/api/quiz-sections');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setCustomSections(data);
        }
      } catch { /* silent */ }
    };
    fetchSections();
  }, []);

  // Single player start
  const startSingleGame = () => {
    if (!playerName.trim()) return;
    let pool: QuizQuestion[];
    if (questionSource === 'custom' && selectedSection) {
      const section = customSections.find(s => s.id === selectedSection);
      if (section) {
        pool = section.questions.map(q => ({
          id: parseInt(q.id) || 0,
          question: q.question,
          options: q.options as string[],
          correct: q.correct,
          category: section.name,
        }));
      } else {
        pool = [...quizQuestions];
      }
    } else {
      pool = allCategories ? [...quizQuestions] : quizQuestions.filter(q => q.category === selectedCategory);
    }
    pool = pool.sort(() => Math.random() - 0.5).slice(0, 20);
    setQuestions(pool);
    setCurrentQ(0);
    setScore(0);
    setSelected(null);
    setAnswered(false);
    setLifelines({ fiftyFifty: 1, skip: 1 });
    setStreak(0);
    setRemovedOptions(new Set());
    timerRunningRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }
    setPhase('single-playing');
  };

  // Battle start
  const startBattle = () => {
    if (participants.length < 2) return;
    let pool: QuizQuestion[];
    if (battleSection === 'all' || battleSection === 'mixed') {
      pool = [...quizQuestions];
      customSections.forEach(section => {
        section.questions.forEach(q => {
          pool.push({
            id: parseInt(q.id) || 0,
            question: q.question,
            options: q.options as string[],
            correct: q.correct,
            category: section.name,
          });
        });
      });
    } else {
      const section = customSections.find(s => s.id === battleSection);
      if (section) {
        pool = section.questions.map(q => ({
          id: parseInt(q.id) || 0,
          question: q.question,
          options: q.options as string[],
          correct: q.correct,
          category: section.name,
        }));
      } else {
        pool = [...quizQuestions];
      }
    }
    pool = pool.sort(() => Math.random() - 0.5).slice(0, 20);

    setQuestions(pool);
    setCurrentQ(0);
    setCurrentPlayerIdx(0);
    setShowAllAnswered(false);
    setParticipants(prev => prev.map(p => ({ ...p, score: 0, answers: [], finished: false })));
    setBattleStartTime(Date.now());
    timerRunningRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }
    setPhase('battle-playing');
  };

  // Single player answer
  const handleAnswer = (idx: number) => {
    if (answered || selected !== null) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === questions[currentQ].correct) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
      playCorrect();
      speakIfEnabled('Correct!');
    } else {
      setStreak(0);
      playWrong();
      speakIfEnabled('Incorrect!');
    }
  };

  // Battle answer
  const handleBattleAnswer = (idx: number) => {
    const current = participants[currentPlayerIdx];
    if (!current || current.finished) return;

    const isCorrect = idx === questions[currentQ].correct;
    const updated = [...participants];
    updated[currentPlayerIdx] = {
      ...current,
      score: isCorrect ? current.score + 1 : current.score,
      answers: [...current.answers, idx],
      finished: true,
    };
    setParticipants(updated);

    if (isCorrect) playCorrect(); else playWrong();
    speakIfEnabled(isCorrect ? `${current.name}, Correct!` : `${current.name}, Incorrect!`);

    advanceBattle(updated);
  };

  const advanceBattle = (updated: Participant[]) => {
    const nextIdx = updated.findIndex((p, i) => i > currentPlayerIdx && !p.finished);
    if (nextIdx !== -1) {
      setCurrentPlayerIdx(nextIdx);
      timerRunningRef.current = false;
    } else {
      setShowAllAnswered(true);
      setAnswered(true);
      timerRunningRef.current = false;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }
      speakIfEnabled('All answered!');
    }
  };

  const handleBattleTimeout = () => {
    const current = participants[currentPlayerIdx];
    if (!current || current.finished) return;
    const updated = [...participants];
    updated[currentPlayerIdx] = {
      ...current,
      answers: [...current.answers, null],
      finished: true,
    };
    setParticipants(updated);
    speakIfEnabled(`${current.name}, time's up!`);
    advanceBattle(updated);
  };

  const startTimer = (seconds: number) => {
    if (timerRunningRef.current) return;
    timerRunningRef.current = true;
    let time = seconds;
    setTimeLeft(time);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      time -= 1;
      if (time <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = undefined;
        timerRunningRef.current = false;
        if (phase === 'single-playing') {
          setAnswered(true);
          setTimeLeft(0);
        } else if (phase === 'battle-playing') {
          handleBattleTimeout();
        }
        return;
      }
      setTimeLeft(time);
    }, 1000);
  };

  // Start timer when playing and not answered
  useEffect(() => {
    if (phase === 'single-playing' && !answered) {
      startTimer(20);
    }
    if (phase === 'battle-playing' && !showAllAnswered) {
      const current = participants[currentPlayerIdx];
      if (current && !current.finished) {
        startTimer(10);
      }
    }
  }, [currentQ, phase, answered, currentPlayerIdx, showAllAnswered]);

  useEffect(() => {
    if (phase === 'single-playing' && !answered && questions[currentQ]) {
      speakIfEnabled(`Question ${currentQ + 1}. ${questions[currentQ].question}`);
    }
  }, [currentQ, phase, answered, speakIfEnabled, questions]);

  const nextBattleQuestion = () => {
    if (currentQ + 1 >= questions.length) {
      endBattle();
    } else {
      playNext();
      setCurrentQ(prev => prev + 1);
      setCurrentPlayerIdx(0);
      setShowAllAnswered(false);
      setAnswered(false);
      setParticipants(prev => prev.map(p => ({ ...p, finished: false })));
      timerRunningRef.current = false;
    }
  };

  const endBattle = async () => {
    stopSpeaking();

    // Save all participants to leaderboard first
    const cat = battleSection === 'all' ? 'Battle - All Categories' : (customSections.find(s => s.id === battleSection)?.name || 'Battle');
    try {
      await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: participants.map(p => ({
            studentName: p.name,
            score: p.score,
            total: questions.length,
            category: cat,
          })),
        }),
      });
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLeaderboardData(data);
      }
    } catch { /* silent */ }

    // Determine winner
    const sorted = [...participants].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    playEnd();

    // Announce winner via TTS then show results
    if (voiceEnabled && winner) {
      speak(`And the winner is ${winner.name} with ${winner.score} points! Congratulations!`, {
        onEnd: () => setPhase('battle-result'),
      });
    } else {
      setPhase('battle-result');
    }
  };

  // Add participant
  const addParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) return;
    if (participants.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
    setParticipants(prev => [...prev, { id: Date.now(), name, score: 0, answers: [], finished: false }]);
    setNewParticipantName('');
  };

  const removeParticipant = (id: number) => {
    if (participants.length <= 2) return;
    setParticipants(prev => prev.filter(p => p.id !== id));
  };

  // Single player helpers
  const useSkip = () => {
    if (lifelines.skip <= 0 || answered) return;
    setLifelines(prev => ({ ...prev, skip: prev.skip - 1 }));
    setRemovedOptions(new Set());
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; timerRunningRef.current = false; }
    nextSingleQuestion();
  };

  const handleFiftyFifty = () => {
    if (lifelines.fiftyFifty <= 0 || answered) return;
    const correct = questions[currentQ].correct;
    const wrong = questions[currentQ].options.map((_, i) => i).filter(i => i !== correct && !removedOptions.has(i));
    const toRemove = wrong.sort(() => Math.random() - 0.5).slice(0, Math.min(2, wrong.length));
    setRemovedOptions(prev => new Set([...prev, ...toRemove]));
    setLifelines(prev => ({ ...prev, fiftyFifty: prev.fiftyFifty - 1 }));
  };

  const nextSingleQuestion = () => {
    if (currentQ + 1 >= questions.length) {
      endSingleGame();
    } else {
      playNext();
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setAnswered(false);
      timerRunningRef.current = false;
    }
  };

  const handleNextSingleQuestion = () => {
    setRemovedOptions(new Set());
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; timerRunningRef.current = false; }
    nextSingleQuestion();
  };

  const endSingleGame = async () => {
    setPhase('single-result');
    stopSpeaking();
    playEnd();
    if (score >= questions.length * 0.8) triggerConfetti();
    speakIfEnabled(`Game Over! You scored ${score} out of ${questions.length}.`);
    try {
      const cat = allCategories ? 'All Categories' : selectedCategory;
      await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: playerName, score, total: questions.length, category: cat }),
      });
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLeaderboardData(data);
      }
    } catch { /* silent */ }
  };

  const triggerConfetti = () => {
    const pieces = Array.from({ length: 50 }, (_, i) => ({
      id: i, x: Math.random() * 100, delay: Math.random() * 2,
      color: ['#d4a843', '#1a4d2e', '#e8c46a', '#2d6b3f', '#f59e0b'][Math.floor(Math.random() * 5)],
      size: Math.random() * 8 + 4,
    }));
    setConfettiPieces(pieces);
    setTimeout(() => setConfettiPieces([]), 4000);
  };

  const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;

  // Confetti overlay
  const confettiOverlay = (key: string) => (
    <AnimatePresence>
      {confettiPieces.map(p => (
        <motion.div key={`${key}-${p.id}`}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1 }}
          animate={{ y: '100vh', rotate: 360, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, delay: p.delay, ease: 'easeOut' }}
          className="fixed top-0 w-3 h-3 rounded-sm pointer-events-none z-50"
          style={{ backgroundColor: p.color, left: `${p.x}%`, width: p.size, height: p.size }}
        />
      ))}
    </AnimatePresence>
  );

  // Timer bar
  const timerBar = (time: number, maxTime: number = 20) => (
    <div className={`rounded-xl p-2 text-center font-mono text-lg font-bold transition-colors ${
      time <= 5 ? 'bg-red-100 text-red-600' : time <= 10 ? 'bg-amber-100 text-amber-600' : 'bg-[#1a4d2e] text-white'
    }`}>
      <Clock className="w-4 h-4 inline mr-1" />
      {time}s
    </div>
  );

  // Progress bar
  const progressBar = (current: number, total: number) => (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">Question {current + 1} of {total}</span>
        <span className="text-xs font-bold text-[#1a4d2e]">{Math.round(((current + 1) / total) * 100)}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#1a4d2e] to-[#d4a843] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );

  // MENU PHASE
  if (phase === 'menu') {
    return (
      <div className="space-y-6">
        {/* Leaderboard Preview */}
        {leaderboardData.length > 0 && (
          <div className="bg-gradient-to-r from-[#d4a843] to-[#e8c46a] rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5" />
              <h3 className="font-bold">Top Performers</h3>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {leaderboardData.slice(0, 5).map((entry, i) => (
                <div key={i} className="flex-shrink-0 text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i === 0 ? 'bg-white/30' : 'bg-white/20'}`}>
                    {i === 0 ? <Crown className="w-5 h-5" /> : i === 1 ? <Medal className="w-5 h-5" /> : <Award className="w-5 h-5" />}
                  </div>
                  <p className="text-xs mt-1 font-medium truncate max-w-[60px]">{entry.studentName}</p>
                  <p className="text-[10px] opacity-80">{entry.percentage}%</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setPhase('single-setup')}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-all"
          >
            <Target className="w-10 h-10 text-[#d4a843] mx-auto mb-2" />
            <h3 className="font-bold text-[#1a4d2e]">Single Player</h3>
            <p className="text-xs text-gray-500 mt-1">Practice & learn at your own pace</p>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setPhase('battle-setup')}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-md transition-all"
          >
            <Swords className="w-10 h-10 text-[#1a4d2e] mx-auto mb-2" />
            <h3 className="font-bold text-[#d4a843]">Battle Mode</h3>
            <p className="text-xs text-gray-500 mt-1">Compete with 2+ players head-to-head</p>
          </motion.button>
        </div>

        {/* Full Leaderboard */}
        {leaderboardData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#1a4d2e] text-white p-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#d4a843]" />
              <span className="font-semibold">Full Leaderboard</span>
            </div>
            <div className="divide-y divide-gray-50">
              {leaderboardData.map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'
                    }`}>{i + 1}</span>
                    <p className="text-sm font-medium">{entry.studentName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#1a4d2e]">{entry.percentage}%</p>
                    <p className="text-xs text-gray-400">{entry.score}/{entry.total}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // SINGLE PLAYER SETUP
  if (phase === 'single-setup') {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center mb-6">
            <Target className="w-12 h-12 text-[#d4a843] mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-[#1a4d2e]">Quiz Challenge</h2>
            <p className="text-sm text-gray-500 mt-1">Test your cybersecurity knowledge!</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Your Name</label>
              <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full mt-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#d4a843] focus:ring-1 focus:ring-[#d4a843]/20 outline-none text-sm" />
            </div>
            {/* Question Source */}
            <div>
              <label className="text-sm font-medium text-gray-700">Question Source</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => { setQuestionSource('builtin'); setAllCategories(true); setSelectedCategory(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${questionSource === 'builtin' ? 'bg-[#1a4d2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Built-in Categories
                </button>
                {customSections.length > 0 && (
                  <button onClick={() => { setQuestionSource('custom'); setSelectedSection(customSections[0]?.id || null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${questionSource === 'custom' ? 'bg-[#1a4d2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    Custom Sections
                  </button>
                )}
              </div>
            </div>

            {questionSource === 'builtin' ? (
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => { setAllCategories(true); setSelectedCategory(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${allCategories ? 'bg-[#1a4d2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    All Categories
                  </button>
                  {quizCategories.map(cat => (
                    <button key={cat} onClick={() => { setAllCategories(false); setSelectedCategory(cat); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!allCategories && selectedCategory === cat ? 'bg-[#1a4d2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700">Custom Section</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customSections.map(s => (
                    <button key={s.id} onClick={() => setSelectedSection(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedSection === s.id ? 'bg-[#1a4d2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {s.name} ({s.questions.length} Qs)
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <button onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${voiceEnabled ? 'bg-[#1a4d2e]/10 text-[#1a4d2e]' : 'bg-gray-100 text-gray-500'}`}>
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                Voice {voiceEnabled ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => setPhase('menu')} className="text-xs text-gray-400 underline">Back</button>
            </div>
            <button onClick={startSingleGame} disabled={!playerName.trim()}
              className="w-full py-3 bg-gradient-to-r from-[#d4a843] to-[#e8c46a] text-[#1a4d2e] rounded-xl font-bold text-sm hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              <Play className="w-4 h-4" /> Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // BATTLE SETUP
  if (phase === 'battle-setup') {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center mb-6">
            <Swords className="w-12 h-12 text-[#d4a843] mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-[#1a4d2e]">Battle Mode</h2>
            <p className="text-sm text-gray-500 mt-1">Add at least 2 players to start the challenge</p>
          </div>

          {/* Add Participants */}
          <div className="flex gap-2 mb-4">
            <input type="text" value={newParticipantName}
              onChange={e => setNewParticipantName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addParticipant(); }}
              placeholder="Enter player name..."
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#d4a843] outline-none text-sm" />
            <button onClick={addParticipant}
              className="px-4 py-2.5 bg-[#1a4d2e] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d2e]/80 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {/* Participant List */}
          <div className="space-y-2 mb-4">
            {participants.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No players added yet</p>
              </div>
            ) : (
              participants.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <button onClick={() => removeParticipant(p.id)}
                    className="p-1 text-red-400 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Quiz Section Selector */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">Question Set</label>
            <select value={battleSection} onChange={e => setBattleSection(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none">
              <option value="all">All Categories (Mixed)</option>
              {customSections.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.description ? `— ${s.description}` : ''} ({s.questions.length} questions)</option>
              ))}
            </select>
          </div>

          {/* Voice Toggle */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${voiceEnabled ? 'bg-[#1a4d2e]/10 text-[#1a4d2e]' : 'bg-gray-100 text-gray-500'}`}>
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              Voice {voiceEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPhase('menu')}
              className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">
              Back
            </button>
            <button onClick={startBattle} disabled={participants.length < 2}
              className="flex-1 py-2.5 bg-gradient-to-r from-[#d4a843] to-[#e8c46a] text-[#1a4d2e] rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
              <Swords className="w-4 h-4" /> Start Battle!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SINGLE PLAYER PLAYING
  if (phase === 'single-playing' && questions[currentQ]) {
    const q = questions[currentQ];
    return (
      <div className="space-y-4 relative">
        {confettiOverlay('single')}
        {progressBar(currentQ, questions.length)}
        {timerBar(timeLeft)}

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <span className="text-xs font-medium text-[#d4a843] bg-[#d4a843]/10 px-2 py-0.5 rounded-full">{q.category}</span>
          <h3 className="text-lg font-semibold text-gray-800 mt-3 leading-relaxed">{q.question}</h3>
        </div>

        <div className="grid gap-3">
          {q.options.map((opt, i) => {
            const isRemoved = removedOptions.has(i);
            let optClass = 'bg-white border-gray-200 hover:border-[#d4a843]/50 hover:bg-[#fdf8f0]';
            if (answered) {
              if (i === q.correct) optClass = 'bg-green-50 border-green-400 text-green-700';
              else if (i === selected && i !== q.correct) optClass = 'bg-red-50 border-red-400 text-red-700';
              else optClass = 'bg-gray-50 border-gray-200 opacity-50';
            } else if (isRemoved) {
              optClass = 'bg-gray-100 border-gray-200 opacity-30 cursor-not-allowed';
            }
            return (
              <motion.button key={i} whileHover={!answered && !isRemoved ? { scale: 1.01 } : {}}
                whileTap={!answered && !isRemoved ? { scale: 0.99 } : {}}
                onClick={() => !isRemoved && handleAnswer(i)}
                disabled={answered || isRemoved}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${optClass} disabled:cursor-not-allowed flex items-center gap-3`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  answered && i === q.correct ? 'bg-green-500 text-white' :
                  answered && i === selected ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {answered && i === q.correct ? <CheckCircle className="w-4 h-4" /> :
                   answered && i === selected ? <XCircle className="w-4 h-4" /> :
                   String.fromCharCode(65 + i)}
                </span>
                <span>{opt}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={handleFiftyFifty} disabled={lifelines.fiftyFifty <= 0 || answered}
            className="flex-1 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center gap-1">
            <Star className="w-4 h-4 text-[#d4a843]" /> 50:50 ({lifelines.fiftyFifty})
          </button>
          <button onClick={useSkip} disabled={lifelines.skip <= 0 || answered}
            className="flex-1 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center gap-1">
            <Zap className="w-4 h-4 text-blue-500" /> Skip ({lifelines.skip})
          </button>
          {answered && (
            <button onClick={handleNextSingleQuestion}
              className="flex-1 py-2.5 bg-[#1a4d2e] text-white rounded-xl text-sm font-medium hover:bg-[#1a4d2e]/80 flex items-center justify-center gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // BATTLE PLAYING
  if (phase === 'battle-playing' && questions[currentQ]) {
    const q = questions[currentQ];
    const current = participants[currentPlayerIdx];
    const answeredCount = participants.filter(p => p.finished).length;

    return (
      <div className="space-y-4 relative">
        {confettiOverlay('battle')}

        {/* Battle Scoreboard */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Question {currentQ + 1} of {questions.length}</span>
            <span className="text-xs text-gray-500">{answeredCount}/{participants.length} answered</span>
          </div>
          {/* Player chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {participants.map((p, i) => {
              const bg = i === currentPlayerIdx && !showAllAnswered ? COLORS[i % COLORS.length] : p.finished ? '#22c55e' : '#e5e7eb';
              return (
                <div key={p.id} className="flex-shrink-0 text-center" style={{ width: 48 }}>
                  <div className="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-300"
                    style={{ backgroundColor: bg }}>
                    {p.finished ? <CheckCircle className="w-4 h-4" /> : p.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[9px] mt-0.5 font-medium truncate">{p.name}</p>
                  <p className="text-[9px] font-bold">{p.score}</p>
                </div>
              );
            })}
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
            <motion.div className="h-full bg-gradient-to-r from-[#1a4d2e] to-[#d4a843] rounded-full"
              initial={{ width: 0 }} animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Current player indicator */}
        {!showAllAnswered && current && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} key={currentPlayerIdx}
            className="rounded-xl p-3 flex items-center gap-3 text-white font-semibold"
            style={{ backgroundColor: COLORS[currentPlayerIdx % COLORS.length] }}>
            <User className="w-5 h-5" />
            {current.name}'s Turn
          </motion.div>
        )}

        {!showAllAnswered ? (
          <>
            {timerBar(timeLeft)}

            {current && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <span className="text-xs font-medium text-[#d4a843] bg-[#d4a843]/10 px-2 py-0.5 rounded-full">
                  {q.category || 'Quiz'}
                </span>
                <h3 className="text-lg font-semibold text-gray-800 mt-3 leading-relaxed">{q.question}</h3>
              </div>
            )}

            <div className="grid gap-3">
              {current && q.options.map((opt, i) => (
                <motion.button key={i} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => handleBattleAnswer(i)}
                  disabled={current.finished}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-[#d4a843]/50 hover:bg-[#fdf8f0] transition-all text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </motion.button>
              ))}
            </div>
          </>
        ) : (
          /* All answered — show correct answer */
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-green-700">The correct answer was:</p>
              <p className="text-xl font-bold text-gray-800 mt-2">{q.options[q.correct]}</p>
            </div>

            {/* How each player answered */}
            <div className="space-y-2">
              {participants.map((p, i) => {
                const answer = p.answers[currentQ];
                const isCorrect = answer === q.correct;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                        {p.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {answer !== null && answer !== undefined ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isCorrect ? '✓ Correct' : `✗ ${q.options[answer] || '???'}`}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">No answer</span>
                      )}
                      <span className="text-sm font-bold">{p.score}/{currentQ + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={nextBattleQuestion}
              className="w-full py-3 bg-[#1a4d2e] text-white rounded-xl font-bold text-sm hover:bg-[#1a4d2e]/80 flex items-center justify-center gap-2">
              {currentQ + 1 >= questions.length ? 'See Results' : 'Next Question'} <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  // SINGLE PLAYER RESULT
  if (phase === 'single-result') {
    return (
      <div className="space-y-6 relative">
        {confettiOverlay('single-result')}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 ${
            percentage >= 80 ? 'bg-green-100' : percentage >= 50 ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            <Trophy className={`w-10 h-10 ${percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`} />
          </div>
          <h2 className="text-2xl font-bold text-[#1a4d2e]">Quiz Complete!</h2>
          <p className="text-gray-500 mt-1">Well done, {playerName}!</p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-[#fdf8f0] rounded-xl p-4">
              <p className="text-3xl font-bold text-[#d4a843]">{score}</p>
              <p className="text-xs text-gray-500">Correct</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-3xl font-bold text-gray-600">{questions.length - score}</p>
              <p className="text-xs text-gray-500">Incorrect</p>
            </div>
            <div className="bg-[#1a4d2e]/10 rounded-xl p-4">
              <p className="text-3xl font-bold text-[#1a4d2e]">{percentage}%</p>
              <p className="text-xs text-gray-500">Score</p>
            </div>
          </div>
          <div className="mt-6 text-lg font-semibold text-[#1a4d2e]">
            {percentage >= 80 ? '🏆 Outstanding Performance!' : percentage >= 60 ? '🌟 Great Job!' : percentage >= 40 ? '📚 Good Effort!' : '💪 Keep Practicing!'}
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setPhase('menu')}
              className="flex-1 py-3 bg-[#1a4d2e] text-white rounded-xl font-medium text-sm hover:bg-[#1a4d2e]/80 flex items-center justify-center gap-1">
              <RotateCcw className="w-4 h-4" /> Back to Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // BATTLE RESULT
  if (phase === 'battle-result') {
    const sorted = [...participants].sort((a, b) => b.score - a.score);
    return (
      <div className="space-y-6 relative">
        {confettiOverlay('battle-result')}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 text-center">
          <Swords className="w-12 h-12 text-[#d4a843] mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-[#1a4d2e]">Battle Complete!</h2>
          <p className="text-sm text-gray-500 mt-1">Here are the final standings</p>

          {/* Podium */}
          <div className="mt-6 flex justify-center items-end gap-4 h-40">
            {sorted.length >= 2 && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white text-xl font-bold mb-1"
                  style={{ backgroundColor: COLORS[1 % COLORS.length] }}>
                  {sorted[1].name.charAt(0)}
                </div>
                <p className="text-xs font-medium">{sorted[1].name}</p>
                <p className="text-lg font-bold">{sorted[1].score}</p>
                <div className="w-16 h-16 bg-gray-200 rounded-t-lg mt-1 flex items-center justify-center">
                  <Medal className="w-6 h-6 text-gray-500" />
                </div>
              </div>
            )}
            {sorted.length >= 1 && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold mb-1 ring-4 ring-[#d4a843]"
                  style={{ backgroundColor: COLORS[0 % COLORS.length] }}>
                  {sorted[0].name.charAt(0)}
                </div>
                <p className="text-sm font-bold">{sorted[0].name}</p>
                <p className="text-2xl font-bold text-[#d4a843]">{sorted[0].score}</p>
                <div className="w-20 h-20 bg-[#d4a843] rounded-t-lg mt-1 flex items-center justify-center">
                  <Crown className="w-8 h-8 text-white" />
                </div>
              </div>
            )}
            {sorted.length >= 3 && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white text-xl font-bold mb-1"
                  style={{ backgroundColor: COLORS[2 % COLORS.length] }}>
                  {sorted[2].name.charAt(0)}
                </div>
                <p className="text-xs font-medium">{sorted[2].name}</p>
                <p className="text-lg font-bold">{sorted[2].score}</p>
                <div className="w-16 h-14 bg-amber-100 rounded-t-lg mt-1 flex items-center justify-center">
                  <Award className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            )}
          </div>

          {/* Full standings */}
          <div className="mt-6 space-y-2 text-left">
            {sorted.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-[#d4a843] text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-500'
                  }`}>{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: COLORS[participants.indexOf(p) % COLORS.length] }}>
                      {p.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{p.score}/{questions.length}</span>
                  <span className="text-sm font-bold w-12 text-right">
                    {questions.length > 0 ? Math.round((p.score / questions.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setPhase('menu')}
            className="mt-6 w-full py-3 bg-[#1a4d2e] text-white rounded-xl font-bold text-sm hover:bg-[#1a4d2e]/80 flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Back to Menu
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
}
