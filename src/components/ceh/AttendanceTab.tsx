'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CameraOff, UserCheck, Users, CheckCircle, AlertCircle,
  RefreshCw, UserPlus, ScanFace, Loader2, Smile
} from 'lucide-react';
import { loadFaceModels, getFaceDescriptor, findBestMatch, captureFrame } from '@/lib/face-recognition';

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

type Mode = 'checkin' | 'register';

export default function AttendanceTab() {
  const [mode, setMode] = useState<Mode>('checkin');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  // Check-in state
  const [recognizedStudent, setRecognizedStudent] = useState<Student | null>(null);
  const [recognizing, setRecognizing] = useState(false);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regFaceDescriptor, setRegFaceDescriptor] = useState<number[] | null>(null);
  const [regFaceImage, setRegFaceImage] = useState<string | null>(null);
  const [regStep, setRegStep] = useState<'form' | 'capture' | 'done'>('form');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const notify = (type: 'success' | 'error' | 'info', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadModels = async () => {
    if (modelsLoaded) return true;
    setLoadingModels(true);
    const ok = await loadFaceModels();
    setModelsLoaded(ok);
    setLoadingModels(false);
    if (!ok) notify('error', 'Failed to load face recognition models. Check your internet.');
    return ok;
  };

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setStudents(data);
    } catch {}
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setRecords(data);
    } catch {}
  }, []);

  const fetchAllRef = useRef(false);
  useEffect(() => {
    if (fetchAllRef.current) return;
    fetchAllRef.current = true;
    fetchStudents();
    fetchRecords();
  }, []);

  const stopCameraRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => { stopCameraRef.current(); };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraOn(true);
      }
      await loadModels();
    } catch {
      notify('error', 'Camera access denied. Allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
    setRecognizedStudent(null);
    setRecognizing(false);
  };

  useEffect(() => {
    stopCameraRef.current = stopCamera;
  }, [stopCamera]);

  // Face recognition scanning (check-in mode)
  const startFaceScan = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setRecognizing(true);
    const registered = students.filter(s => s.faceDescriptor && Array.isArray(s.faceDescriptor));

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const descriptor = await getFaceDescriptor(videoRef.current);
        if (descriptor && registered.length > 0) {
          const match = findBestMatch(
            descriptor,
            registered.map(s => ({ studentId: s.id, descriptor: s.faceDescriptor as number[] }))
          );
          if (match.match) {
            const student = students.find(s => s.id === match.studentId);
            if (student) {
              setRecognizedStudent(student);
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = undefined;
              setRecognizing(false);
              handleMarkAttendance(student.id);
            }
          }
        }
      } catch {}
    }, 1500);
  };

  const stopFaceScan = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = undefined;
    }
    setRecognizing(false);
  };

  const handleMarkAttendance = async (studentId: string) => {
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
        notify('success', `Welcome, ${data.student?.name || 'Student'}!`);
        stopCamera();
        fetchRecords();
      } else if (res.status === 409) {
        notify('info', `${data.record?.student?.name || 'Student'} already marked present.`);
        stopCamera();
      } else {
        notify('error', data.error || 'Failed to mark attendance.');
      }
    } catch {
      notify('error', 'Failed to mark attendance.');
    } finally {
      setProcessing(false);
    }
  };

  // Face capture for registration
  const captureFaceForRegistration = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setProcessing(true);
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (descriptor) {
        setRegFaceDescriptor(descriptor);
        const frame = captureFrame(videoRef.current);
        setRegFaceImage(frame);
        setRegStep('done');
        notify('success', 'Face captured successfully!');
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
      notify('error', 'All fields are required.');
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
        }),
      });
      if (res.ok) {
        notify('success', `${regName} registered successfully!`);
        setRegName('');
        setRegEmail('');
        setRegDepartment('');
        setRegFaceDescriptor(null);
        setRegFaceImage(null);
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

  const presentStudentIds = new Set(records.map(r => r.studentId));
  const absentStudents = students.filter(s => !presentStudentIds.has(s.id));

  return (
    <div className="space-y-6">
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
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
             notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
             <AlertCircle className="w-4 h-4" />}
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('checkin'); setRegStep('form'); if (cameraOn) stopCamera(); }}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === 'checkin' ? 'bg-[#1a4d2e] text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          <ScanFace className="w-5 h-5" /> Check In (Face Recognition)
        </button>
        <button
          onClick={() => { setMode('register'); if (cameraOn) stopCamera(); }}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mode === 'register' ? 'bg-[#d4a843] text-[#1a4d2e]' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          <UserPlus className="w-5 h-5" /> Register New
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <Users className="w-6 h-6 text-[#1a4d2e] mx-auto mb-1" />
          <p className="text-xl font-bold text-[#1a4d2e]">{students.length}</p>
          <p className="text-[10px] text-gray-500">Registered</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <UserCheck className="w-6 h-6 text-green-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-600">{records.length}</p>
          <p className="text-[10px] text-gray-500">Present</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <Smile className="w-6 h-6 text-[#d4a843] mx-auto mb-1" />
          <p className="text-xl font-bold text-[#d4a843]">{absentStudents.length}</p>
          <p className="text-[10px] text-gray-500">Available</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Camera Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#1a4d2e] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <span className="font-semibold">Camera</span>
            </div>
            <button
              onClick={cameraOn ? stopCamera : startCamera}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                cameraOn ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {cameraOn ? <><CameraOff className="w-3 h-3 inline mr-1" />Stop</> : <><Camera className="w-3 h-3 inline mr-1" />Start</>}
            </button>
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

            {/* Face detected overlay */}
            {cameraOn && recognizedStudent && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-4 border-green-400 rounded-lg w-48 h-48 opacity-60" />
                <div className="absolute bottom-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {recognizedStudent.name} ✓
                </div>
              </div>
            )}

            {/* Model loading indicator */}
            {loadingModels && cameraOn && (
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading AI models...
              </div>
            )}
          </div>

          {/* Mode-specific controls */}
          {cameraOn && mode === 'checkin' && (
            <div className="p-4 border-t border-gray-100">
              {recognizedStudent ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-green-700">✓ Face Recognized</p>
                  <p className="text-xs text-gray-500 mt-1">Attendance being processed...</p>
                </div>
              ) : recognizing ? (
                <div className="text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1a4d2e] mx-auto mb-1" />
                  <p className="text-sm text-gray-600">Scanning for faces...</p>
                  <button onClick={stopFaceScan} className="mt-2 text-xs text-red-500 underline">Stop</button>
                </div>
              ) : (
                <button
                  onClick={startFaceScan}
                  disabled={!modelsLoaded || students.length === 0}
                  className="w-full py-2.5 bg-[#1a4d2e] text-white rounded-xl text-sm font-medium hover:bg-[#1a4d2e]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <ScanFace className="w-4 h-4" />
                  {students.length === 0 ? 'No registered students' : 'Start Face Recognition'}
                </button>
              )}
            </div>
          )}

          {/* Registration capture controls */}
          {cameraOn && mode === 'register' && (
            <div className="p-4 border-t border-gray-100">
              {regStep === 'capture' && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Position your face in the camera and click capture</p>
                  <button
                    onClick={captureFaceForRegistration}
                    disabled={processing}
                    className="w-full py-2.5 bg-[#d4a843] text-[#1a4d2e] rounded-xl text-sm font-bold hover:bg-[#d4a843]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Capture Face
                  </button>
                </div>
              )}
              {regStep === 'done' && (
                <div className="text-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-sm text-green-700 font-medium">Face captured! Complete registration below.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Based on mode */}
        <div className="space-y-4">
          {mode === 'checkin' ? (
            <>
              {/* Manual check-in */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Manual Check-in</p>
                <div className="flex gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleMarkAttendance(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select student...</option>
                    {absentStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - {s.department}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Attendance Records */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-[#1a4d2e] text-white p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Attendance Records</span>
                  </div>
                  <button onClick={fetchRecords} className="p-1 hover:bg-white/10 rounded">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {records.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No records yet</p>
                    </div>
                  ) : (
                    records.map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between p-3 border-b border-gray-50 hover:bg-gray-50/50"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{r.student.name}</p>
                            <p className="text-[10px] text-gray-400">{r.student.department}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            r.method === 'face' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {r.method === 'face' ? 'Face' : 'Manual'}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Registration Form */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#d4a843]" /> New Registration
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
                      if (!regName || !regEmail || !regDepartment) {
                        notify('error', 'Please fill all fields first.');
                        return;
                      }
                      setRegStep('capture');
                      if (!cameraOn) startCamera();
                    }}
                    className="w-full py-2.5 bg-[#d4a843] text-[#1a4d2e] rounded-xl text-sm font-bold hover:bg-[#d4a843]/80 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Continue to Face Capture
                  </button>
                </div>
              )}

              {regStep === 'done' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {regFaceImage && (
                      <img src={regFaceImage} alt="Captured face" className="w-16 h-16 rounded-full object-cover border-2 border-green-400" />
                    )}
                    <div className="text-sm">
                      <p className="font-medium text-gray-800">{regName}</p>
                      <p className="text-xs text-gray-500">{regEmail} • {regDepartment}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRegister}
                    disabled={processing}
                    className="w-full py-2.5 bg-[#1a4d2e] text-white rounded-xl text-sm font-bold hover:bg-[#1a4d2e]/80 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Complete Registration
                  </button>
                  <button
                    onClick={() => setRegStep('form')}
                    className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Back to form
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Registered Students */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1a4d2e]" />
            <span className="font-semibold text-gray-800">Registered Students ({students.length})</span>
          </div>
          <button onClick={fetchStudents} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No students registered yet</p>
            </div>
          ) : (
            students.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="flex items-center gap-2">
                  {s.faceImage ? (
                    <img src={s.faceImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center text-xs font-bold text-[#1a4d2e]">
                      {s.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.department} {s.faceDescriptor ? '• Face enrolled' : ''}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  presentStudentIds.has(s.id) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {presentStudentIds.has(s.id) ? 'Present' : 'Absent'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
