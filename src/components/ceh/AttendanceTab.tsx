'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, UserCheck, Users, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  department: string;
  faceImage?: string | null;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  student: Student;
  timestamp: string;
  method: string;
}

interface AttendanceTabProps {
  students: Student[];
  onRefreshStudents: () => void;
}

export default function AttendanceTab({ students, onRefreshStudents }: AttendanceTabProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    }
  }, []);

  const fetchRecordsRef = useRef(fetchRecords);
  useEffect(() => {
    fetchRecordsRef.current = fetchRecords;
    fetchRecordsRef.current();
  }, [fetchRecords]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraOn(true);
      }
    } catch (err) {
      setNotification({ type: 'error', msg: 'Camera access denied. Please allow camera permissions.' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
    setSnapshot(null);
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSnapshot(dataUrl);
  };

  const markAttendance = async (studentId: string, method: string) => {
    if (!studentId) {
      setNotification({ type: 'error', msg: 'Please select a student first.' });
      return;
    }
    setLoading(true);
    try {
      const body: any = { studentId, method };
      if (snapshot) body.snapshot = snapshot;
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (res.ok) {
        setNotification({ type: 'success', msg: `${data.student.name} marked as present!` });
        setSelectedStudent('');
        fetchRecords();
      } else {
        setNotification({ type: 'error', msg: data.error });
      }
    } catch {
      setNotification({ type: 'error', msg: 'Failed to mark attendance.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const presentStudentIds = new Set(records.map(r => r.studentId));
  const absentStudents = students.filter(s => !presentStudentIds.has(s.id));

  return (
    <div className="space-y-6">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`flex items-center gap-2 p-3 rounded-lg ${
              notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{notification.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <Users className="w-8 h-8 text-[#1a4d2e] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1a4d2e]">{students.length}</p>
          <p className="text-xs text-gray-500">Registered</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <UserCheck className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{records.length}</p>
          <p className="text-xs text-gray-500">Present</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-amber-500">{absentStudents.length}</p>
          <p className="text-xs text-gray-500">Absent</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <Camera className="w-8 h-8 text-[#d4a843] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#d4a843]">{cameraOn ? 'ON' : 'OFF'}</p>
          <p className="text-xs text-gray-500">Camera</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Camera Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#1a4d2e] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <span className="font-semibold">Camera Feed</span>
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
            {snapshot ? (
              <img src={snapshot} alt="Captured snapshot" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
            {!cameraOn && !snapshot && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center text-gray-400">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Camera Off</p>
                  <p className="text-xs">Click Start to begin</p>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
            {/* Camera controls overlay */}
            {cameraOn && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                <button onClick={captureSnapshot} className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium shadow-lg hover:bg-gray-100 flex items-center gap-1">
                  <Camera className="w-3 h-3" /> Capture
                </button>
                {snapshot && (
                  <button onClick={() => setSnapshot(null)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium shadow-lg hover:bg-red-600">
                    Retake
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Quick Mark Attendance */}
          <div className="p-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Attendance Mark</p>
            <div className="flex gap-2">
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#d4a843] focus:ring-1 focus:ring-[#d4a843]/20 outline-none"
              >
                <option value="">Select student...</option>
                {absentStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {s.department}</option>
                ))}
              </select>
              <button
                onClick={() => markAttendance(selectedStudent, 'manual')}
                disabled={!selectedStudent || loading}
                className="px-4 py-2 bg-[#1a4d2e] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d2e]/80 transition-all disabled:opacity-40 flex items-center gap-1"
              >
                <UserCheck className="w-4 h-4" />
                Mark Present
              </button>
            </div>
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
          
          <div className="max-h-[400px] overflow-y-auto">
            {records.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No attendance records yet</p>
                <p className="text-xs mt-1">Mark attendance using the form above</p>
              </div>
            ) : (
              records.map((record, i) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 border-b border-gray-50 hover:bg-gray-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{record.student.name}</p>
                      <p className="text-xs text-gray-400">{record.student.department} • {record.student.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${record.method === 'face' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {record.method === 'face' ? 'Face ID' : 'Manual'}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
