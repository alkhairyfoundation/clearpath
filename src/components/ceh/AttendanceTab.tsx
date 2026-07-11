'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CameraOff, UserCheck, Users, CheckCircle, AlertCircle,
  RefreshCw, UserPlus, ScanFace, Loader2, Smile, Fingerprint,
  User, RotateCcw, Volume2, Sparkles
} from 'lucide-react';
import { loadFaceModels, getBestFaceDescriptor, quickFaceScan, findBestMatch, captureFrame, TemporalConsensus, FaceQuality } from '@/lib/face-recognition';
import { speak, stopSpeaking, preloadVoices } from '@/lib/tts';

interface Student {
  id: string;
  name: string;
  email: string;
  department: string;
  faceImage?: string | null;
  faceDescriptor?: number[] | null;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  student: Student;
  timestamp: string;
  method: string;
}

type Flow = 'checkin' | 'enroll' | 'register';

export default function AttendanceTab() {
  const [flow, setFlow] = useState<Flow>('checkin');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoadFailed, setModelsLoadFailed] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  // Check-in state
  const [recognizedStudent, setRecognizedStudent] = useState<Student | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<'idle' | 'scanning' | 'found' | 'failed'>('idle');

  // Welcome overlay state
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeStudent, setWelcomeStudent] = useState<Student | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Scan progress
  const [scanProgress, setScanProgress] = useState(0);

  // Enroll state
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollStep, setEnrollStep] = useState<'select' | 'capture' | 'done'>('select');
  const [captureQuality, setCaptureQuality] = useState<FaceQuality | null>(null);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regFaceDescriptor, setRegFaceDescriptor] = useState<number[] | null>(null);
  const [regFaceImage, setRegFaceImage] = useState<string | null>(null);
  const [regFaceQuality, setRegFaceQuality] = useState<number | null>(null);
  const [regStep, setRegStep] = useState<'form' | 'capture' | 'done'>('form');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scanningRef = useRef(false);
  const consensusRef = useRef<TemporalConsensus | null>(null);
  const stopCameraRef = useRef<() => void>(() => {});

  const notify = (type: 'success' | 'error' | 'info', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadModels = async () => {
    if (modelsLoaded) return true;
    setLoadingModels(true);
    setModelLoadProgress(0);
    const ok = await loadFaceModels((loaded, total) => {
      setModelLoadProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
    });
    setModelsLoaded(ok);
    setModelsLoadFailed(!ok);
    setLoadingModels(false);
    if (!ok) notify('error', 'Failed to load face recognition models. Check your internet and refresh.');
    return ok;
  };

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setStudents(data);
      }
    } catch {}
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRecords(data);
      }
    } catch {}
  }, []);

  const fetchAllRef = useRef(false);
  useEffect(() => {
    if (fetchAllRef.current) return;
    fetchAllRef.current = true;
    fetchStudents();
    fetchRecords();
  }, []);

  useEffect(() => {
    return () => { stopCameraRef.current(); };
  }, []);

  // Preload TTS voices on mount
  useEffect(() => {
    preloadVoices();
  }, []);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (consensusRef.current) {
      consensusRef.current.reset();
      consensusRef.current = null;
    }
    setCameraOn(false);
    setModelsLoadFailed(false);
    setModelLoadProgress(0);
    setRecognizedStudent(null);
    setRecognizing(false);
    setRecognitionStatus('idle');
    setScanProgress(0);
    setCaptureQuality(null);
    setShowWelcome(false);
    setWelcomeStudent(null);
    setIsSpeaking(false);
    stopSpeaking();
  }, []);

  useEffect(() => {
    stopCameraRef.current = stopCamera;
  }, [stopCamera]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraOn(true);
      }
      await Promise.all([loadModels(), fetchStudents(), fetchRecords()]);
    } catch {
      notify('error', 'Camera access denied. Allow camera permissions.');
    }
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    if (cameraOn) {
      stopCamera();
      await new Promise(r => setTimeout(r, 200));
      startCamera();
    }
  };

  // ----- WELCOME GREETING -----
  const showWelcomeGreeting = (student: Student, alreadyCheckedIn: boolean) => {
    setWelcomeStudent(student);
    setShowWelcome(true);

    const greeting = alreadyCheckedIn
      ? `${student.name} from ${student.department}, you have already checked in. Welcome back!`
      : `Welcome, ${student.name}! You are from the ${student.department} department. Enjoy the ClearPath Edu Hub graduation ceremony!`;

    setIsSpeaking(true);

    const dismissOverlay = () => {
      setIsSpeaking(false);
      // Give user time to read the overlay after speech ends
      setTimeout(() => {
        setShowWelcome(false);
        setWelcomeStudent(null);
        stopCamera();
      }, 2000);
    };

    speak(greeting, {
      onEnd: dismissOverlay,
      onError: dismissOverlay,
    });
  };

  // ----- MARK ATTENDANCE -----
  const markAttendance = async (studentId: string, student?: Student) => {
    setProcessing(true);
    try {
      const snapshot = videoRef.current ? captureFrame(videoRef.current) : undefined;
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, method: 'face', snapshot }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('success', `Welcome, ${data.student?.name || 'Student'}! ✓`);
        fetchStudents();
        fetchRecords();
        if (student) {
          showWelcomeGreeting(student, false);
        } else {
          setTimeout(() => stopCamera(), 2000);
        }
      } else if (res.status === 409) {
        notify('info', `${data.record?.student?.name || 'Student'} already checked in.`);
        fetchRecords();
        if (student) {
          showWelcomeGreeting(student, true);
        } else {
          setTimeout(() => stopCamera(), 2000);
        }
      } else {
        notify('error', data.error || 'Failed.');
        setRecognitionStatus('idle');
      }
    } catch {
      notify('error', 'Failed to mark attendance.');
      setRecognitionStatus('idle');
    } finally {
      setProcessing(false);
    }
  };

  // ----- FACE CHECK-IN -----
  const startFaceScan = () => {
    if (!videoRef.current || !modelsLoaded) {
      if (!modelsLoaded) notify('error', 'AI models not loaded yet. Please wait.');
      return;
    }
    const enrolled = students.filter(s => s.faceDescriptor && Array.isArray(s.faceDescriptor));
    if (enrolled.length === 0) {
      notify('info', 'No students have enrolled faces yet. Use "Enroll Face" first.');
      return;
    }
    const enrolledList = enrolled.map(s => ({ studentId: s.id, descriptor: s.faceDescriptor as number[] }));
    setRecognizing(true);
    setRecognitionStatus('scanning');
    scanningRef.current = true;
    setScanProgress(0);
    consensusRef.current = new TemporalConsensus(5, 2, 4000);

    const scanOnce = async () => {
      if (!scanningRef.current || !videoRef.current || !streamRef.current) return;
      try {
        const result = await quickFaceScan(videoRef.current);
        if (result) {
          const match = findBestMatch(result.descriptor, enrolledList);
          // Only add votes for reasonable-quality scans
          if (result.quality.overall > 0.15) {
            consensusRef.current?.addVote({
              studentId: match.studentId,
              distance: match.distance,
              similarity: match.similarity,
              timestamp: Date.now(),
            });
            const progress = Math.min(100, (consensusRef.current?.voteCount ?? 0) * 20);
            setScanProgress(progress);

            const consensus = consensusRef.current?.getConsensus();
            if (consensus && consensus.studentId) {
              scanningRef.current = false;
              const student = students.find(s => s.id === consensus.studentId) || null;
              setRecognizedStudent(student);
              setRecognizing(false);
              setRecognitionStatus('found');
              if (student) markAttendance(student.id, student);
              return;
            }
          }
        }
      } catch {}
      if (scanningRef.current) {
        scanTimeoutRef.current = setTimeout(scanOnce, 600);
      }
    };

    scanOnce();
  };

  // ----- FACE ENROLLMENT (for existing students) -----
  const captureFaceForEnroll = async () => {
    if (!videoRef.current || !modelsLoaded) {
      if (!modelsLoaded) notify('error', 'AI models not loaded yet. Please wait.');
      return;
    }
    setProcessing(true);
    setCaptureQuality(null);
    try {
      // Use multiple attempts for high-quality enrollment
      const result = await getBestFaceDescriptor(videoRef.current, 8);
      if (result) {
        setCaptureQuality(result.quality);
        const qualityScore = Math.round(result.quality.overall * 100);
        if (result.quality.overall < 0.20) {
          notify('error', `Face quality too low (${qualityScore}%). Please adjust lighting and try again.`);
          setProcessing(false);
          return;
        }
        const res = await fetch('/api/students/enroll-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: enrollStudentId,
            faceDescriptor: result.descriptor,
            faceImage: captureFrame(videoRef.current),
            quality: result.quality.overall,
          }),
        });
        if (res.ok) {
          setEnrollStep('done');
          notify('success', `Face enrolled successfully! (Quality: ${qualityScore}%)`);
          fetchStudents();
        } else {
          notify('error', 'Failed to save face data.');
        }
      } else {
        notify('error', 'No face detected. Ensure good lighting and face visibility.');
      }
    } catch {
      notify('error', 'Failed to capture face.');
    } finally {
      setProcessing(false);
    }
  };

  // ----- NEW REGISTRATION + FACE ENROLL -----
  const captureFaceForRegistration = async () => {
    if (!videoRef.current || !modelsLoaded) {
      if (!modelsLoaded) notify('error', 'AI models not loaded yet. Please wait.');
      return;
    }
    setProcessing(true);
    try {
      // Use multiple attempts for high-quality enrollment
      const result = await getBestFaceDescriptor(videoRef.current, 8);
      if (result) {
        const qualityScore = Math.round(result.quality.overall * 100);
        if (result.quality.overall < 0.20) {
          notify('error', `Face quality too low (${qualityScore}%). Please adjust lighting and try again.`);
          setProcessing(false);
          return;
        }
        setRegFaceDescriptor(result.descriptor);
        setRegFaceQuality(result.quality.overall);
        setRegFaceImage(captureFrame(videoRef.current));
        setRegStep('done');
        notify('success', `Face captured! (Quality: ${qualityScore}%)`);
      } else {
        notify('error', 'No face detected. Ensure your face is visible and well-lit.');
      }
    } catch {
      notify('error', 'Failed to capture face.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regDepartment) {
      notify('error', 'All fields required.');
      return;
    }
    if (!regFaceDescriptor) {
      notify('error', 'Please capture your face first.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          department: regDepartment,
          faceImage: regFaceImage,
          faceDescriptor: regFaceDescriptor,
          faceDescriptorQuality: regFaceQuality,
        }),
      });
      if (res.ok) {
        notify('success', `${regName} registered & face enrolled!`);
        setRegName(''); setRegEmail(''); setRegDepartment('');
        setRegFaceDescriptor(null); setRegFaceImage(null); setRegFaceQuality(null);
        setRegStep('form');
        stopCamera();
        fetchStudents();
      } else {
        const data = await res.json();
        notify('error', data.error || 'Registration failed.');
      }
    } catch {
      notify('error', 'Failed to register.');
    } finally {
      setProcessing(false);
    }
  };

  // ----- UTILITIES -----
  const presentIds = new Set(records.map(r => r.studentId));
  const studentsWithFace = students.filter(s => s.faceDescriptor && Array.isArray(s.faceDescriptor));
  const studentsWithoutFace = students.filter(s => !s.faceDescriptor || !Array.isArray(s.faceDescriptor));

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flow Selector */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'checkin' as Flow, label: 'Auto Check-in', icon: ScanFace, color: 'bg-[#1a4d2e] text-white' },
          { key: 'enroll' as Flow, label: 'Enroll Face', icon: Fingerprint, color: 'bg-[#d4a843] text-[#1a4d2e]' },
          { key: 'register' as Flow, label: 'New Registration', icon: UserPlus, color: 'bg-blue-600 text-white' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => { setFlow(f.key); if (cameraOn) stopCamera(); }}
            className={`py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              flow === f.key ? f.color : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <f.icon className="w-4 h-4" /> {f.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <Users className="w-5 h-5 text-[#1a4d2e] mx-auto mb-1" />
          <p className="text-lg font-bold text-[#1a4d2e]">{students.length}</p>
          <p className="text-[9px] text-gray-500">Registered</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <Smile className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-600">{studentsWithFace.length}</p>
          <p className="text-[9px] text-gray-500">Face Enrolled</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <UserCheck className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-600">{records.length}</p>
          <p className="text-[9px] text-gray-500">Checked In</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <User className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-amber-500">{studentsWithoutFace.length}</p>
          <p className="text-[9px] text-gray-500">Need Enroll</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ====== CAMERA SECTION ====== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#1a4d2e] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <span className="font-semibold">Camera</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cameraOn ? stopCamera : startCamera}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  cameraOn ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {cameraOn ? <><CameraOff className="w-3 h-3 inline mr-1" />Stop</> : <><Camera className="w-3 h-3 inline mr-1" />Start</>}
              </button>
              {cameraOn && (
                <button
                  onClick={switchCamera}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/20 hover:bg-white/30 transition-all"
                  title={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
                >
                  {facingMode === 'user' ? <><Camera className="w-3 h-3 inline mr-1" />Back</> : <><RotateCcw className="w-3 h-3 inline mr-1" />Front</>}
                </button>
              )}
            </div>
          </div>

          <div className="aspect-video bg-gray-900 relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center text-gray-400">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Camera Off</p>
                  <p className="text-xs">Start camera to begin</p>
                </div>
              </div>
            )}

            {/* Recognition overlay */}
            {cameraOn && recognitionStatus === 'found' && recognizedStudent && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-4 border-green-400 rounded-lg w-48 h-48 opacity-70" />
                <div className="absolute bottom-4 left-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium text-center">
                  ✓ {recognizedStudent.name}
                </div>
              </div>
            )}

            {cameraOn && recognitionStatus === 'scanning' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-[#d4a843] rounded-lg w-48 h-48 opacity-50 animate-pulse" />
                <div className="absolute bottom-4 left-2 right-2 flex flex-col items-center gap-1">
                  <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Confirming identity...
                  </div>
                  <div className="w-32 h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#d4a843] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-[10px] text-white/70">{scanProgress}% confidence</span>
                </div>
              </div>
            )}

            {loadingModels && cameraOn && (
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Loading AI models...</span>
                <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden shrink-0">
                  <motion.div
                    className="h-full bg-green-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${modelLoadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="tabular-nums">{modelLoadProgress}%</span>
              </div>
            )}
            {modelsLoadFailed && cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-xl p-5 mx-4 text-center max-w-xs">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800 mb-1">Model Load Failed</p>
                  <p className="text-xs text-gray-500 mb-3">Could not download AI models. Check your internet connection and try again.</p>
                  <button
                    onClick={() => { setModelsLoadFailed(false); setLoadingModels(true); loadModels(); }}
                    className="px-4 py-2 bg-[#1a4d2e] text-white rounded-lg text-xs font-medium hover:bg-[#1a4d2e]/80 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 inline mr-1" /> Retry
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls by Flow */}
          {cameraOn && flow === 'checkin' && (
            <div className="p-4 border-t border-gray-100">
              {recognitionStatus === 'found' ? (
                <p className="text-center text-sm text-green-700 font-medium flex items-center justify-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin" /> Marking attendance...
                </p>
              ) : recognitionStatus === 'scanning' ? (
                <button onClick={() => { stopCamera(); }} className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100">
                  Stop Scanning
                </button>
              ) : (
                <button
                  onClick={startFaceScan}
                  disabled={!modelsLoaded || studentsWithFace.length === 0}
                  className="w-full py-2.5 bg-[#1a4d2e] text-white rounded-xl text-sm font-medium hover:bg-[#1a4d2e]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <ScanFace className="w-4 h-4" />
                  {studentsWithFace.length === 0 ? 'No enrolled faces yet' : 'Start Face Recognition'}
                </button>
              )}
            </div>
          )}

          {cameraOn && flow === 'enroll' && (
            <div className="p-4 border-t border-gray-100">
              {enrollStep === 'capture' && (
                <div className="space-y-2">
                  {captureQuality && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Quality:</span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            captureQuality.overall > 0.6 ? 'bg-green-500' :
                            captureQuality.overall > 0.35 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(captureQuality.overall * 100)}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className={`font-medium ${
                        captureQuality.overall > 0.6 ? 'text-green-600' :
                        captureQuality.overall > 0.35 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {Math.round(captureQuality.overall * 100)}%
                      </span>
                    </div>
                  )}
                  <button
                    onClick={captureFaceForEnroll}
                    disabled={processing}
                    className="w-full py-2.5 bg-[#d4a843] text-[#1a4d2e] rounded-xl text-sm font-bold hover:bg-[#d4a843]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Capture Face to Enroll
                  </button>
                  <p className="text-[10px] text-gray-400 text-center">
                    Look straight at the camera in good lighting
                  </p>
                </div>
              )}
              {enrollStep === 'done' && (
                <p className="text-center text-sm text-green-700 font-medium flex items-center justify-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Face enrolled successfully!
                </p>
              )}
            </div>
          )}

          {cameraOn && flow === 'register' && regStep === 'capture' && (
            <div className="p-4 border-t border-gray-100">
              <div className="space-y-2">
                <button
                  onClick={captureFaceForRegistration}
                  disabled={processing}
                  className="w-full py-2.5 bg-[#d4a843] text-[#1a4d2e] rounded-xl text-sm font-bold hover:bg-[#d4a843]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  Capture Face
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  Look straight at the camera in good lighting
                </p>
              </div>
            </div>
          )}

          {cameraOn && flow === 'register' && regStep === 'done' && (
            <div className="p-4 border-t border-gray-100">
              <p className="text-center text-sm text-green-700 font-medium flex items-center justify-center gap-1">
                <CheckCircle className="w-4 h-4" /> Face captured! Complete registration below.
              </p>
            </div>
          )}
        </div>

        {/* ====== RIGHT PANEL ====== */}
        <div className="space-y-4">
          {/* FLOW: CHECK-IN (Manual) */}
          {flow === 'checkin' && (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#1a4d2e]" /> Manual Check-in
                </p>
                <div className="flex gap-2">
                  <select
                    onChange={(e) => { if (e.target.value) markAttendance(e.target.value); }}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select student...</option>
                    {students.filter(s => !presentIds.has(s.id)).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {!s.faceDescriptor ? '(no face)' : ''} - {s.department}
                      </option>
                    ))}
                  </select>
                </div>
                {students.filter(s => !presentIds.has(s.id)).length === 0 && students.length > 0 && (
                  <p className="text-xs text-green-600 mt-2 text-center">All students checked in today!</p>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-[#1a4d2e] text-white p-4 flex items-center justify-between">
                  <span className="font-semibold">Today's Attendance</span>
                  <button onClick={fetchRecords} className="p-1 hover:bg-white/10 rounded"><RefreshCw className="w-4 h-4" /></button>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  {records.length === 0 ? (
                    <div className="p-6 text-center text-gray-400"><UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">No check-ins yet</p></div>
                  ) : (
                    records.map((r, i) => (
                      <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between p-3 border-b border-gray-50 hover:bg-gray-50/50"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{r.student.name}</p>
                            <p className="text-[10px] text-gray-400">{r.student.department}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.method === 'face' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {r.method === 'face' ? 'Face' : 'Manual'}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* FLOW: ENROLL FACE */}
          {flow === 'enroll' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-[#d4a843]" /> Enroll Face for Existing Student
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Select a registered student who hasn't enrolled their face yet. They'll then be recognized automatically during check-in.
              </p>

              {enrollStep === 'select' && (
                <div className="space-y-3">
                  {studentsWithoutFace.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <p className="text-sm">All registered students have enrolled faces!</p>
                    </div>
                  ) : (
                    <>
                      <select
                        value={enrollStudentId}
                        onChange={(e) => setEnrollStudentId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none"
                      >
                        <option value="">Select a student...</option>
                        {studentsWithoutFace.map(s => (
                          <option key={s.id} value={s.id}>{s.name} - {s.department}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (!enrollStudentId) { notify('error', 'Select a student first.'); return; }
                          setEnrollStep('capture');
                          if (!cameraOn) startCamera();
                        }}
                        disabled={!enrollStudentId}
                        className="w-full py-2.5 bg-[#d4a843] text-[#1a4d2e] rounded-xl text-sm font-bold hover:bg-[#d4a843]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        <Camera className="w-4 h-4" /> Continue to Face Capture
                      </button>
                    </>
                  )}
                </div>
              )}

              {enrollStep === 'done' && (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">Face Enrolled!</p>
                  <p className="text-xs text-gray-500 mt-1">Student can now use auto check-in.</p>
                  <button
                    onClick={() => { setEnrollStep('select'); setEnrollStudentId(''); if (cameraOn) stopCamera(); }}
                    className="mt-3 text-xs text-[#d4a843] underline"
                  >
                    Enroll another student
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FLOW: NEW REGISTRATION */}
          {flow === 'register' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" /> New Student Registration
              </h3>

              {regStep === 'form' && (
                <div className="space-y-3">
                  <input type="text" placeholder="Full Name" value={regName}
                    onChange={e => setRegName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#d4a843]" />
                  <input type="email" placeholder="Email Address" value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#d4a843]" />
                  <input type="text" placeholder="Department / Role" value={regDepartment}
                    onChange={e => setRegDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#d4a843]" />
                  <button
                    onClick={() => {
                      if (!regName || !regEmail || !regDepartment) { notify('error', 'Fill all fields first.'); return; }
                      setRegStep('capture');
                      if (!cameraOn) startCamera();
                    }}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Continue to Face Capture
                  </button>
                </div>
              )}

              {regStep === 'done' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {regFaceImage && (
                      <img src={regFaceImage} alt="Face" className="w-16 h-16 rounded-full object-cover border-2 border-green-400" />
                    )}
                    <div className="text-sm">
                      <p className="font-medium">{regName}</p>
                      <p className="text-xs text-gray-500">{regEmail} • {regDepartment}</p>
                    </div>
                  </div>
                  <button onClick={handleRegister} disabled={processing}
                    className="w-full py-2.5 bg-[#1a4d2e] text-white rounded-xl text-sm font-bold hover:bg-[#1a4d2e]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Complete Registration with Face
                  </button>
                  <button onClick={() => setRegStep('form')} className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 underline">Back</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Welcome Overlay */}
      <AnimatePresence>
        {showWelcome && welcomeStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center relative overflow-hidden"
            >
              {/* Decorative top bar */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#1a4d2e] via-[#d4a843] to-[#1a4d2e]" />

              {/* Success icon */}
              <div className="mt-4 mb-4 mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.2 }}
                >
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </motion.div>
              </div>

              {/* Student face image */}
              {welcomeStudent.faceImage ? (
                <img
                  src={welcomeStudent.faceImage}
                  alt={welcomeStudent.name}
                  className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-[#d4a843]/30 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#1a4d2e] flex items-center justify-center mx-auto border-4 border-[#d4a843]/30 shadow-lg">
                  <span className="text-3xl font-bold text-white">{welcomeStudent.name.charAt(0)}</span>
                </div>
              )}

              {/* Welcome message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4"
              >
                <h2 className="text-2xl font-bold text-[#1a4d2e]">{welcomeStudent.name}</h2>
                <p className="text-sm text-[#d4a843] font-medium mt-1">{welcomeStudent.department}</p>
                <p className="text-sm text-gray-500 mt-1">{welcomeStudent.email}</p>

                <div className="mt-4 px-4 py-3 bg-gradient-to-r from-[#1a4d2e]/5 to-[#d4a843]/5 rounded-xl">
                  <p className="text-lg font-semibold text-[#1a4d2e] flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#d4a843]" />
                    Welcome to CEH AI!
                    <Sparkles className="w-5 h-5 text-[#d4a843]" />
                  </p>
                  <p className="text-xs text-gray-500 mt-1">ClearPath Edu Hub Graduation Ceremony</p>
                </div>
              </motion.div>

              {/* Speaking indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-4 flex items-center justify-center gap-2"
              >
                <motion.div
                  animate={isSpeaking ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.8, repeat: isSpeaking ? Infinity : 0 }}
                >
                  <Volume2 className={`w-5 h-5 ${isSpeaking ? 'text-[#1a4d2e]' : 'text-gray-300'}`} />
                </motion.div>
                <span className="text-xs text-gray-400">
                  {isSpeaking ? 'Speaking welcome...' : 'Welcome ready'}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registered Students List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1a4d2e]" />
            <span className="font-semibold text-gray-800">Registered Students</span>
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{students.length}</span>
          </div>
          <button onClick={fetchStudents} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-6 text-center text-gray-400"><Users className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">No registered students yet</p></div>
          ) : (
            students.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="flex items-center gap-2">
                  {s.faceImage ? (
                    <img src={s.faceImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center text-xs font-bold text-[#1a4d2e]">{s.name.charAt(0)}</div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.faceDescriptor && Array.isArray(s.faceDescriptor) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.faceDescriptor && Array.isArray(s.faceDescriptor) ? 'Face enrolled' : 'No face'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${presentIds.has(s.id) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {presentIds.has(s.id) ? 'Present' : 'Absent'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
