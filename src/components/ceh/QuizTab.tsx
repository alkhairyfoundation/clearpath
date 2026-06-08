'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trophy, Clock, Star, Zap, ChevronRight, RotateCcw, Volume2, VolumeX, Crown, Medal, Award, Target, CheckCircle, XCircle } from 'lucide-react';
import { quizQuestions, quizCategories, QuizQuestion } from '@/lib/quiz-data';

type GamePhase = 'menu' | 'playing' | 'result';

export default function QuizTab() {
  const [phase, setPhase] = useState<GamePhase>('menu');
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
  const [confettiPieces, setConfettiPieces] = useState<any[]>([]);
  
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timerRunningRef = useRef(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    return () => { if (synthRef.current) synthRef.current.cancel(); };
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !voiceEnabled) return;
    synthRef.current.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.0;
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US'));
    if (preferred) u.voice = preferred;
    synthRef.current.speak(u);
  }, [voiceEnabled]);

  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const leaderboardInitRef = useRef(false);

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

  const startGame = () => {
    if (!playerName.trim()) return;
    let pool = allCategories ? [...quizQuestions] : quizQuestions.filter(q => q.category === selectedCategory);
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    setPhase('playing');
  };

  // Timer effect
  useEffect(() => {
    if (phase !== 'playing' || answered) return;
    if (timerRunningRef.current) return;
    timerRunningRef.current = true;
    
    let time = 20;
    setTimeLeft(time);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      time -= 1;
      if (time <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = undefined;
        timerRunningRef.current = false;
        setAnswered(true);
        setTimeLeft(0);
        return;
      }
      setTimeLeft(time);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRunningRef.current = false;
    };
  }, [currentQ, phase, answered]);

  useEffect(() => {
    if (phase === 'playing' && !answered && questions[currentQ]) {
      speak(`Question ${currentQ + 1}. ${questions[currentQ].question}`);
    }
  }, [currentQ, phase, answered, speak, questions]);

  const handleAnswer = (idx: number) => {
    if (answered || selected !== null) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === questions[currentQ].correct) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
    }
  };

  const useSkip = () => {
    if (lifelines.skip <= 0 || answered) return;
    setLifelines(prev => ({ ...prev, skip: prev.skip - 1 }));
    setRemovedOptions(new Set());
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
      timerRunningRef.current = false;
    }
    nextQuestion();
  };

  const nextQuestion = () => {
    if (currentQ + 1 >= questions.length) {
      endGame();
    } else {
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const endGame = async () => {
    setPhase('result');
    if (synthRef.current) synthRef.current.cancel();
    
    if (score >= questions.length * 0.8) triggerConfetti();
    
    speak(`Game Over! You scored ${score} out of ${questions.length}. ${score >= questions.length * 0.8 ? 'Excellent performance!' : score >= questions.length * 0.5 ? 'Good job!' : 'Keep practicing!'}`);
    
    try {
      const cat = allCategories ? 'All Categories' : selectedCategory;
      await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: playerName, score, total: questions.length, category: cat }),
      });
      const refreshLb = async () => {
        try {
          const res = await fetch('/api/leaderboard');
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data)) setLeaderboardData(data);
        } catch { /* silent */ }
      };
      refreshLb();
    } catch { /* silent */ }
  };

  const triggerConfetti = () => {
    const pieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      color: ['#d4a843', '#1a4d2e', '#e8c46a', '#2d6b3f', '#f59e0b'][Math.floor(Math.random() * 5)],
      size: Math.random() * 8 + 4,
    }));
    setConfettiPieces(pieces);
    setTimeout(() => setConfettiPieces([]), 4000);
  };

  const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;

  // Fifty-fifty removed options tracking
  const [removedOptions, setRemovedOptions] = useState<Set<number>>(new Set());

  const handleFiftyFifty = () => {
    if (lifelines.fiftyFifty <= 0 || answered) return;
    const correct = questions[currentQ].correct;
    const wrong = questions[currentQ].options.map((_, i) => i).filter(i => i !== correct && !removedOptions.has(i));
    const toRemove = wrong.sort(() => Math.random() - 0.5).slice(0, Math.min(2, wrong.length));
    setRemovedOptions(prev => new Set([...prev, ...toRemove]));
    setLifelines(prev => ({ ...prev, fiftyFifty: prev.fiftyFifty - 1 }));
  };

  const handleNextQuestion = () => {
    setRemovedOptions(new Set());
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
      timerRunningRef.current = false;
    }
    nextQuestion();
  };

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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center mb-6">
            <Target className="w-12 h-12 text-[#d4a843] mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-[#1a4d2e]">Quiz Challenge</h2>
            <p className="text-sm text-gray-500 mt-1">Test your cybersecurity knowledge!</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full mt-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#d4a843] focus:ring-1 focus:ring-[#d4a843]/20 outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Category</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => { setAllCategories(true); setSelectedCategory(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${allCategories ? 'bg-[#1a4d2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  All Categories
                </button>
                {quizCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setAllCategories(false); setSelectedCategory(cat); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!allCategories && selectedCategory === cat ? 'bg-[#1a4d2e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${voiceEnabled ? 'bg-[#1a4d2e]/10 text-[#1a4d2e]' : 'bg-gray-100 text-gray-500'}`}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                Voice {voiceEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <button
              onClick={startGame}
              disabled={!playerName.trim()}
              className="w-full py-3 bg-gradient-to-r from-[#d4a843] to-[#e8c46a] text-[#1a4d2e] rounded-xl font-bold text-sm hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Quiz
            </button>
          </div>
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
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{entry.studentName}</p>
                      <p className="text-xs text-gray-400">{entry.category || 'Mixed'}</p>
                    </div>
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

  // PLAYING PHASE
  if (phase === 'playing' && questions[currentQ]) {
    const q = questions[currentQ];
    return (
      <div className="space-y-4 relative">
        {/* Confetti */}
        <AnimatePresence>
          {confettiPieces.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1 }}
              animate={{ y: '100vh', rotate: 360, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, delay: p.delay, ease: 'easeOut' }}
              className="fixed top-0 w-3 h-3 rounded-sm pointer-events-none z-50"
              style={{ backgroundColor: p.color, left: `${p.x}%`, width: p.size, height: p.size }}
            />
          ))}
        </AnimatePresence>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Question {currentQ + 1} of {questions.length}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <Star className="w-3 h-3 text-[#d4a843]" />
                <span className="font-bold text-[#1a4d2e]">{score}</span>
              </div>
              {streak >= 3 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Zap className="w-3 h-3" /> {streak}x streak
                </span>
              )}
            </div>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-[#1a4d2e] to-[#d4a843] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Timer */}
        <div className={`rounded-xl p-2 text-center font-mono text-lg font-bold transition-colors ${
          timeLeft <= 5 ? 'bg-red-100 text-red-600' : timeLeft <= 10 ? 'bg-amber-100 text-amber-600' : 'bg-[#1a4d2e] text-white'
        }`}>
          <Clock className="w-4 h-4 inline mr-1" />
          {timeLeft}s
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <span className="text-xs font-medium text-[#d4a843] bg-[#d4a843]/10 px-2 py-0.5 rounded-full">{q.category}</span>
          <h3 className="text-lg font-semibold text-gray-800 mt-3 leading-relaxed">{q.question}</h3>
        </div>

        {/* Options */}
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
              <motion.button
                key={i}
                whileHover={!answered && !isRemoved ? { scale: 1.01 } : {}}
                whileTap={!answered && !isRemoved ? { scale: 0.99 } : {}}
                onClick={() => !isRemoved && handleAnswer(i)}
                disabled={answered || isRemoved}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${optClass} disabled:cursor-not-allowed flex items-center gap-3`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  answered && i === q.correct ? 'bg-green-500 text-white' :
                  answered && i === selected ? 'bg-red-500 text-white' :
                  'bg-gray-100 text-gray-600'
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

        {/* Lifelines & Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleFiftyFifty}
            disabled={lifelines.fiftyFifty <= 0 || answered}
            className="flex-1 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center gap-1"
          >
            <Star className="w-4 h-4 text-[#d4a843]" /> 50:50 ({lifelines.fiftyFifty})
          </button>
          <button
            onClick={useSkip}
            disabled={lifelines.skip <= 0 || answered}
            className="flex-1 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center gap-1"
          >
            <Zap className="w-4 h-4 text-blue-500" /> Skip ({lifelines.skip})
          </button>
          {answered && (
            <button
              onClick={handleNextQuestion}
              className="flex-1 py-2.5 bg-[#1a4d2e] text-white rounded-xl text-sm font-medium hover:bg-[#1a4d2e]/80 flex items-center justify-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // RESULT PHASE
  if (phase === 'result') {
    return (
      <div className="space-y-6 relative">
        <AnimatePresence>
          {confettiPieces.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1 }}
              animate={{ y: '100vh', rotate: 360, opacity: 0 }}
              transition={{ duration: 3, delay: p.delay }}
              className="fixed top-0 rounded-sm pointer-events-none z-50"
              style={{ backgroundColor: p.color, left: `${p.x}%`, width: p.size, height: p.size }}
            />
          ))}
        </AnimatePresence>

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
            <button
              onClick={() => setPhase('menu')}
              className="flex-1 py-3 bg-[#1a4d2e] text-white rounded-xl font-medium text-sm hover:bg-[#1a4d2e]/80 flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-4 h-4" /> Play Again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
