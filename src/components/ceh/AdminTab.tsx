'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Settings, BarChart3, Trash2, Plus, Upload, Save, Lock, Unlock, ImageIcon, Download, ChevronRight, Eye } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  department: string;
  faceImage?: string | null;
  registeredAt: string;
}

interface AdminTabProps {
  onStudentChange: () => void;
}

export default function AdminTab({ onStudentChange }: AdminTabProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [activeSection, setActiveSection] = useState<'students' | 'settings' | 'stats'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [notif, setNotif] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  
  // Add student form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', department: '', faceImage: '' });
  const [newStudentFaceFile, setNewStudentFaceFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceFileInputRef = useRef<HTMLInputElement>(null);

  // Change PIN dialog
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Health stats
  const [healthData, setHealthData] = useState<{ status: string; uptime: number; db: string; api: string; memoryUsage: string; students: number; attendance: number; version: string } | null>(null);

  const ADMIN_PIN = 'ceh2026';
  const adminHeaders = { 'Content-Type': 'application/json', 'x-admin-pin': ADMIN_PIN };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 4000);
  };

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      setStudents(data);
    } catch { /* silent */ }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
    } catch { /* silent */ }
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
      const data = await res.json();
      setAttendanceRecords(data);
    } catch { /* silent */ }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setLeaderboard(data);
    } catch { /* silent */ }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch { /* silent */ }
  }, []);

  const refreshAllRef = useRef(() => {});
  useEffect(() => {
    refreshAllRef.current = () => {
      fetchStudents();
      fetchSettings();
      fetchAttendance();
      fetchLeaderboard();
      fetchHealth();
    };
    refreshAllRef.current();
  }, []);

  const handleLogin = () => {
    if (pin === 'ceh2026') {
      setAuthenticated(true);
      refreshAllRef.current();
    } else {
      notify('error', 'Invalid PIN. Please try again.');
    }
  };

  const addStudent = async () => {
    if (!newStudent.name || !newStudent.email || !newStudent.department) {
      notify('error', 'All fields are required.');
      return;
    }
    setLoading(true);
    try {
      const body: any = { name: newStudent.name, email: newStudent.email, department: newStudent.department };
      if (newStudentFaceFile) body.faceImage = newStudentFaceFile;
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        notify('success', `${newStudent.name} registered successfully!`);
        setNewStudent({ name: '', email: '', department: '', faceImage: '' });
        setNewStudentFaceFile(null);
        setShowAddForm(false);
        fetchStudents();
        onStudentChange();
      } else {
        const data = await res.json();
        notify('error', data.error);
      }
    } catch {
      notify('error', 'Failed to register student.');
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await fetch('/api/students', {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ id }),
      });
      notify('success', `${name} deleted.`);
      fetchStudents();
      onStudentChange();
    } catch {
      notify('error', 'Failed to delete student.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ key: 'avatarUrl', value: base64 }),
        });
        setAvatarUrl(base64);
        notify('success', 'Avatar updated successfully!');
      } catch {
        notify('error', 'Failed to save avatar.');
      }
    };
    reader.readAsDataURL(file);
  };

  const exportData = async () => {
    try {
      const [studentsRes, attendanceRes, leaderboardRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/attendance'),
        fetch('/api/leaderboard'),
      ]);
      const data = {
        students: await studentsRes.json(),
        attendance: await attendanceRes.json(),
        leaderboard: await leaderboardRes.json(),
        exportDate: new Date().toISOString(),
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ceh-ai-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('success', 'Data exported!');
    } catch {
      notify('error', 'Export failed.');
    }
  };

  // LOGIN SCREEN
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#1a4d2e] flex items-center justify-center mx-auto mb-3">
              <Lock className="w-8 h-8 text-[#d4a843]" />
            </div>
            <h2 className="text-xl font-bold text-[#1a4d2e]">Admin Access</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your PIN to continue</p>
          </div>
          
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Enter PIN..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg tracking-widest focus:border-[#d4a843] focus:ring-2 focus:ring-[#d4a843]/20 outline-none"
            maxLength={10}
          />
          
          <button
            onClick={handleLogin}
            className="w-full mt-4 py-3 bg-[#1a4d2e] text-white rounded-xl font-semibold hover:bg-[#1a4d2e]/80 transition-all flex items-center justify-center gap-2"
          >
            <Unlock className="w-4 h-4" /> Unlock
          </button>
        </motion.div>
      </div>
    );
  }

  // ADMIN DASHBOARD
  return (
    <div className="space-y-4">
      {/* Notification */}
      <AnimatePresence>
        {notif && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-3 rounded-lg text-sm flex items-center gap-2 ${notif.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notif.type === 'success' ? <Save className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            {notif.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#1a4d2e] to-[#1a4d2e]/80 rounded-xl p-4 text-white">
          <Users className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{students.length}</p>
          <p className="text-xs opacity-80">Registered Students</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
          <Eye className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{attendanceRecords.length}</p>
          <p className="text-xs opacity-80">Attendance Records</p>
        </div>
        <div className="bg-gradient-to-br from-[#d4a843] to-[#e8c46a] rounded-xl p-4 text-[#1a4d2e]">
          <BarChart3 className="w-6 h-6 mb-2" />
          <p className="text-2xl font-bold">{leaderboard.length}</p>
          <p className="text-xs opacity-80">Quiz Sessions</p>
        </div>
        <div className={`rounded-xl p-4 text-white ${healthData?.status === 'healthy' ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-gray-700 to-gray-800'}`}>
          <Settings className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{healthData?.status === 'healthy' ? 'Healthy' : healthData?.status || 'Checking...'}</p>
          <p className="text-xs opacity-80">{healthData ? `v${healthData.version} • ${healthData.db}` : 'System Status'}</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'students', label: 'Students', icon: Users },
          { key: 'settings', label: 'Settings', icon: Settings },
          { key: 'stats', label: 'Statistics', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeSection === tab.key ? 'bg-[#1a4d2e] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
        <button onClick={exportData} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#d4a843] text-[#1a4d2e] hover:bg-[#d4a843]/80 transition-all ml-auto">
          <Download className="w-4 h-4" /> Export All
        </button>
      </div>

      {/* STUDENTS SECTION */}
      {activeSection === 'students' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Student Registry</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-[#1a4d2e] text-white rounded-lg text-xs font-medium hover:bg-[#1a4d2e]/80 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Student
            </button>
          </div>
          
          <AnimatePresence>
            {showAddForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-gray-100">
                <div className="p-4 grid gap-3">
                  <input type="text" placeholder="Full Name" value={newStudent.name} onChange={(e) => setNewStudent(p => ({ ...p, name: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#d4a843] outline-none" required />
                  <input type="email" placeholder="Email Address" value={newStudent.email} onChange={(e) => setNewStudent(p => ({ ...p, email: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#d4a843] outline-none" required />
                  <input type="text" placeholder="Department" value={newStudent.department} onChange={(e) => setNewStudent(p => ({ ...p, department: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#d4a843] outline-none" required />
                  <div className="flex items-center gap-2">
                    <input ref={faceFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setNewStudentFaceFile(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <button type="button" onClick={() => faceFileInputRef.current?.click()} className="text-xs flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <Upload className="w-3 h-3" /> {newStudentFaceFile ? 'Change Photo' : 'Upload Photo (optional)'}
                    </button>
                    {newStudentFaceFile && <span className="text-xs text-green-600">Photo selected</span>}
                  </div>
                  <button onClick={addStudent} disabled={loading} className="py-2 bg-[#d4a843] text-[#1a4d2e] rounded-lg text-sm font-semibold disabled:opacity-40">
                    {loading ? 'Saving...' : 'Register Student'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="max-h-[400px] overflow-y-auto">
            {students.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No students registered yet</p>
              </div>
            ) : (
              students.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    {s.faceImage ? (
                      <img src={s.faceImage} alt={`${s.name}'s photo`} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center text-xs font-bold text-[#1a4d2e]">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.department} • {s.email}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteStudent(s.id, s.name)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SETTINGS SECTION */}
      {activeSection === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#d4a843]" /> AI Assistant Avatar
            </h3>
            <p className="text-sm text-gray-500 mb-4">Upload a custom image for the AI Assistant avatar. This image will be displayed with talking animations.</p>
            
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#d4a843]/30 bg-gray-100 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#1a4d2e] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d2e]/80 flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" /> Upload Image
                </button>
                {avatarUrl && (
                  <button
                    onClick={async () => {
                      try {
                        await fetch('/api/settings', {
                          method: 'POST',
                          headers: adminHeaders,
                          body: JSON.stringify({ key: 'avatarUrl', value: '' }),
                        });
                        setAvatarUrl(undefined);
                        notify('success', 'Avatar removed.');
                      } catch {
                        notify('error', 'Failed to remove avatar.');
                      }
                    }}
                    className="ml-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-2">JPG, PNG recommended. Max 2MB.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#1a4d2e]" /> Security
            </h3>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Admin PIN</p>
                <p className="text-xs text-gray-400">Current: ••••••</p>
              </div>
              <button onClick={() => setShowChangePin(true)} className="px-3 py-1.5 bg-gray-200 rounded-lg text-xs font-medium hover:bg-gray-300">Change</button>
            </div>
          </div>

          {/* Change PIN Dialog */}
          <AnimatePresence>
            {showChangePin && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowChangePin(false)}>
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-gray-800 mb-4">Change Admin PIN</h3>
                  <div className="space-y-3">
                    <input type="password" placeholder="Current PIN" value={oldPin} onChange={e => setOldPin(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 focus:border-[#d4a843] outline-none" />
                    <input type="password" placeholder="New PIN (6-10 characters)" value={newPin} onChange={e => setNewPin(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 focus:border-[#d4a843] outline-none" />
                    <input type="password" placeholder="Confirm new PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 focus:border-[#d4a843] outline-none" />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setShowChangePin(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                    <button onClick={async () => {
                      if (oldPin !== 'ceh2026') { notify('error', 'Current PIN is incorrect.'); return; }
                      if (newPin.length < 6) { notify('error', 'PIN must be at least 6 characters.'); return; }
                      if (newPin !== confirmPin) { notify('error', 'PINs do not match.'); return; }
                      try {
                        await fetch('/api/settings', {
                          method: 'POST',
                          headers: adminHeaders,
                          body: JSON.stringify({ key: 'adminPin', value: newPin }),
                        });
                        notify('success', 'PIN changed successfully!');
                        setShowChangePin(false);
                        setOldPin('');
                        setNewPin('');
                        setConfirmPin('');
                      } catch { notify('error', 'Failed to change PIN.'); }
                    }} className="flex-1 py-2 bg-[#1a4d2e] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d2e]/80">Save</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* STATS SECTION */}
      {activeSection === 'stats' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Attendance Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <p className="text-3xl font-bold text-green-600">{attendanceRecords.length}</p>
                <p className="text-xs text-gray-500">Total Present</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl text-center">
                <p className="text-3xl font-bold text-amber-600">{students.length > 0 ? Math.round((attendanceRecords.length / students.length) * 100) : 0}%</p>
                <p className="text-xs text-gray-500">Attendance Rate</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Quiz Performance</h3>
            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#1a4d2e] text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <span className="text-sm font-medium">{entry.studentName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#d4a843] rounded-full" style={{ width: `${entry.percentage}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[#1a4d2e]">{entry.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No quiz sessions yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
