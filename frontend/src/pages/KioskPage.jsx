import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, QrCode, UserPlus, CalendarPlus, CheckCircle, ArrowLeft,
  Building, Phone, FileText, Search, User, MapPin, Clock, X, Mail, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import jsQR from 'jsqr';
import { io as socketIo } from 'socket.io-client';
import api from '../api/axios';
import toast from 'react-hot-toast';

const BG = 'linear-gradient(140deg,#080808 0%,#130000 55%,#200000 100%)';
const CARD_BG = 'bg-[#0d0000]';
const DROPDOWN_BG = 'bg-[#1a0000]';

// ─── Live Clock ───────────────────────────────────────────────────────────────
function KioskClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="text-right leading-tight">
      <div className="text-white text-xl font-mono font-bold">{format(now, 'hh:mm:ss a')}</div>
      <div className="text-red-400 text-xs">{format(now, 'EEEE, dd MMMM yyyy')}</div>
    </div>
  );
}

// ─── Web QR Scanner Modal ─────────────────────────────────────────────────────
function QRScannerModal({ onValidated, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('starting');
  const [errMsg, setErrMsg] = useState('');

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame); return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) { validateToken(code.data); return; }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, []); // eslint-disable-line

  const validateToken = async (token) => {
    setPhase('validating');
    stop();
    try {
      const { data } = await api.post('/qr/validate', { token },
        { headers: { 'x-temi-api-key': 'temi_internal_api_key' } }
      );
      onValidated(data);
    } catch (err) {
      setErrMsg(err.response?.data?.error || 'Invalid or expired QR code');
      setPhase('error');
    }
  };

  const retry = useCallback(() => {
    setPhase('scanning');
    setErrMsg('');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      streamRef.current = s;
      videoRef.current.srcObject = s;
      videoRef.current.play();
      rafRef.current = requestAnimationFrame(scanFrame);
    });
  }, [scanFrame]);

  useEffect(() => {
    let alive = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        videoRef.current.srcObject = s;
        videoRef.current.play();
        setPhase('scanning');
        rafRef.current = requestAnimationFrame(scanFrame);
      })
      .catch(() => { setErrMsg('Camera access denied. Please allow camera permissions.'); setPhase('error'); });
    return () => { alive = false; stop(); };
  }, [scanFrame, stop]);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className={`${CARD_BG} rounded-2xl overflow-hidden w-full max-w-sm border border-red-900/50 shadow-2xl`}>
        <div className="flex items-center justify-between px-5 py-3 bg-red-700">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <QrCode size={16} /> Scan Your QR Code
          </div>
          <button onClick={() => { stop(); onClose(); }} className="text-white/70 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {phase === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-red-500/70 rounded-xl relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br" />
                <div className="absolute inset-x-4 h-0.5 bg-red-500/60 top-1/2 animate-pulse" />
              </div>
            </div>
          )}
          {(phase === 'starting' || phase === 'validating') && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-red-400 border-t-red-600 rounded-full animate-spin" />
              <p className="text-white text-sm">{phase === 'starting' ? 'Starting camera…' : 'Validating QR code…'}</p>
            </div>
          )}
          {phase === 'error' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="text-red-400 text-4xl">⚠</div>
              <p className="text-red-300 text-sm font-medium">{errMsg}</p>
              {!errMsg.includes('Camera') && (
                <button onClick={retry} className="bg-red-700 text-white text-xs px-5 py-2 rounded-lg hover:bg-red-600">Try Again</button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 text-center">
          <p className="text-gray-500 text-xs">Hold QR code steady inside the frame</p>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Search Dropdown ─────────────────────────────────────────────────
function EmployeeSearch({ value, onChange, onSelect, selected }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!value || value.length < 1) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/visitor/employees/search?q=${encodeURIComponent(value)}`);
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); onSelect(null); }}
          onFocus={() => results.length && setOpen(true)}
          className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 pl-8 text-sm focus:outline-none focus:border-red-500 transition-colors"
          placeholder="Type employee name…"
          autoComplete="off"
        />
      </div>
      {open && results.length > 0 && (
        <div className={`absolute z-30 w-full ${DROPDOWN_BG} border border-red-900/40 rounded-xl shadow-2xl mt-1 max-h-44 overflow-y-auto`}>
          {results.map((emp) => (
            <button
              key={emp.id} type="button"
              onMouseDown={() => { onSelect(emp); onChange(emp.name); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-red-900/30 border-b border-white/5 last:border-0 transition-colors"
            >
              <div className="text-sm font-medium text-white">{emp.name}</div>
              <div className="text-xs text-gray-500">{emp.department || 'General'}</div>
            </button>
          ))}
        </div>
      )}
      {selected ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-400">
          <CheckCircle size={11} />
          <span>{selected.name} · {selected.department || 'N/A'}</span>
        </div>
      ) : value.length > 0 ? (
        <p className="mt-1.5 text-xs text-red-400">Select an employee from the list above</p>
      ) : null}
    </div>
  );
}

// ─── Walk-In Form ─────────────────────────────────────────────────────────────
function WalkInForm({ onBack, onDone }) {
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ visitorName: '', visitorEmail: '', visitorPhone: '', visitorCompany: '', purpose: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return toast.error('Please select an employee from the dropdown list');
    setLoading(true);
    try {
      const { data } = await api.post('/visitor/impromptu', { ...form, employeeId: selectedEmp.id });
      toast.success('Request submitted!');
      onDone(selectedEmp.name, data.visit.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 pl-8 text-sm focus:outline-none focus:border-red-500 transition-colors';

  return (
    <div className="w-full max-w-lg">
      <button onClick={onBack} className="flex items-center gap-1.5 text-red-400 hover:text-white mb-5 text-sm transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="bg-white/5 border border-red-900/30 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="bg-red-700 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <UserPlus size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Walk-In Visit Registration</h2>
            <p className="text-red-200 text-xs">Fill in your details — the employee will be notified instantly</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Your Full Name *</label>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input value={form.visitorName} onChange={set('visitorName')} required className={inputCls} placeholder="John Doe" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input value={form.visitorPhone} onChange={set('visitorPhone')} className={inputCls} placeholder="+91 9876543210" />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Email Address <span className="text-gray-600 font-normal">(to receive QR code when approved)</span>
            </label>
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
              <input type="email" value={form.visitorEmail} onChange={set('visitorEmail')} className={inputCls} placeholder="you@example.com" />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Company / Organisation</label>
            <div className="relative">
              <Building size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
              <input value={form.visitorCompany} onChange={set('visitorCompany')} className={inputCls} placeholder="Acme Corp" />
            </div>
          </div>

          {/* Whom to meet */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Whom to Meet *</label>
            <EmployeeSearch value={empSearch} onChange={setEmpSearch} onSelect={setSelectedEmp} selected={selectedEmp} />
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Purpose of Visit *</label>
            <div className="relative">
              <FileText size={13} className="absolute left-3 top-3 text-gray-600 pointer-events-none" />
              <textarea value={form.purpose} onChange={set('purpose')} required rows={2}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl px-3 py-2 pl-8 text-sm focus:outline-none focus:border-red-500 transition-colors resize-none"
                placeholder="Meeting, delivery, interview, demo…" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Submitting…' : 'Submit Visit Request →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Pre-Planned Booking Info Panel ──────────────────────────────────────────
function PrePlannedInfo({ onBack, onGoToPortal }) {
  return (
    <div className="w-full max-w-lg">
      <button onClick={onBack} className="flex items-center gap-1.5 text-red-400 hover:text-white mb-5 text-sm transition-colors">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="bg-white/5 border border-red-900/30 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="bg-red-800 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <CalendarPlus size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Pre-Planned Visit Booking</h2>
            <p className="text-red-200 text-xs">Schedule a visit in advance — visitor gets a QR code by email</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            {[
              { n: '1', title: 'Employee logs in to the Staff Portal', desc: 'Use the Staff Portal button below to sign in.' },
              { n: '2', title: 'Fill visitor & meeting details', desc: 'Enter visitor name, email, date/time, meeting room and purpose.' },
              { n: '3', title: 'System sends invite email', desc: 'Visitor receives a secure link to complete their registration.' },
              { n: '4', title: 'Visitor gets QR code', desc: 'After registering, the visitor receives their QR code by email.' },
              { n: '5', title: 'On arrival — scan QR at reception', desc: 'Visitor scans QR here or at the Temi robot to check in.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-red-800/50 border border-red-600/50 text-red-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{step.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onGoToPortal}
            className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
            Go to Staff Portal to Schedule a Visit →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QR Validated Success ─────────────────────────────────────────────────────
function ValidatedScreen({ data, onDone }) {
  const { visitor, visit, host } = data;
  useEffect(() => { const t = setTimeout(onDone, 25000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="w-full max-w-md text-center space-y-5">
      <div className="w-20 h-20 bg-red-700/30 rounded-full flex items-center justify-center mx-auto border-2 border-red-500">
        <CheckCircle size={40} className="text-red-400" />
      </div>
      <div>
        <p className="text-red-400 text-sm font-medium tracking-wide uppercase mb-1">Check-In Successful</p>
        <h2 className="text-4xl font-bold text-white">{visitor?.name}</h2>
        {visitor?.company && <p className="text-red-200 mt-1">{visitor.company}</p>}
      </div>

      <div className="bg-white/5 border border-red-900/30 rounded-2xl p-5 text-left space-y-3">
        <div className="flex items-center gap-3">
          <User size={15} className="text-red-500 flex-shrink-0" />
          <span className="text-gray-300 text-sm">Meeting <strong className="text-white">{host?.name}</strong>
            {host?.department && <span className="text-gray-500"> · {host.department}</span>}
          </span>
        </div>
        {visit?.meetingRoom && (
          <div className="flex items-center gap-3">
            <MapPin size={15} className="text-red-500 flex-shrink-0" />
            <span className="text-gray-300 text-sm">
              Heading to <strong className="text-white">
                {visit.meetingRoom.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Clock size={15} className="text-red-500 flex-shrink-0" />
          <span className="text-gray-300 text-sm">Purpose: {visit?.purpose}</span>
        </div>
      </div>

      <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 flex items-center gap-3">
        <Bot size={28} className="text-red-500 flex-shrink-0" />
        <p className="text-red-100 text-sm text-left">
          <strong>Temi is on the way!</strong> The robot will escort you to your destination shortly. Please wait here.
        </p>
      </div>
      <button onClick={onDone} className="text-gray-700 hover:text-gray-500 text-xs transition-colors">Reset screen</button>
    </div>
  );
}

// ─── Walk-In Submitted (waits for QR via socket) ─────────────────────────────
function SubmittedScreen({ employeeName, visitId, onDone }) {
  const [approvedQR, setApprovedQR] = useState(null);

  // Connect socket, join visit room, wait for QR
  useEffect(() => {
    if (!visitId) return;
    const sock = socketIo(import.meta.env.VITE_SOCKET_URL || '', { withCredentials: true });
    sock.emit('visit:join', { visitId });
    sock.on('visit:approved_qr', ({ qrImage, expiresAt }) => {
      setApprovedQR({ qrImage, expiresAt });
      toast.success('Visit approved! Your QR code is ready.');
    });
    return () => sock.disconnect();
  }, [visitId]);

  // Auto-reset 30s after QR appears, 2 min while waiting
  useEffect(() => {
    const delay = approvedQR ? 30000 : 120000;
    const t = setTimeout(onDone, delay);
    return () => clearTimeout(t);
  }, [approvedQR, onDone]);

  const downloadQR = () => {
    const a = document.createElement('a');
    a.href = approvedQR.qrImage;
    a.download = 'visit-qr.png';
    a.click();
  };

  if (approvedQR) {
    return (
      <div className="w-full max-w-md text-center space-y-5">
        <div className="w-20 h-20 bg-red-700/30 rounded-full flex items-center justify-center mx-auto border-2 border-red-500">
          <CheckCircle size={40} className="text-red-400" />
        </div>
        <div>
          <p className="text-red-400 text-sm font-medium tracking-wide uppercase mb-1">Visit Approved!</p>
          <h2 className="text-3xl font-bold text-white">Your QR Code</h2>
          <p className="text-gray-400 text-sm mt-1">Show this QR at reception or scan it on this screen</p>
        </div>

        <div className="bg-white rounded-2xl p-4 inline-block mx-auto shadow-2xl">
          <img src={approvedQR.qrImage} alt="Visit QR Code" className="w-52 h-52 mx-auto" />
          <p className="text-gray-500 text-xs mt-2">
            Valid until {format(new Date(approvedQR.expiresAt), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={downloadQR}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
            <Download size={15} /> Download QR
          </button>
          <button onClick={onDone}
            className="bg-white/5 hover:bg-white/10 border border-red-900/40 text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
            Done
          </button>
        </div>

        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-3 flex items-center gap-3">
          <Bot size={22} className="text-red-500 flex-shrink-0" />
          <p className="text-red-200 text-xs text-left">Scan the QR code above at the reception kiosk to check in and Temi will escort you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md text-center space-y-5">
      <div className="w-20 h-20 bg-red-800/30 rounded-full flex items-center justify-center mx-auto border-2 border-red-600">
        <Clock size={40} className="text-red-500" />
      </div>
      <h2 className="text-3xl font-bold text-white">Request Sent!</h2>
      <p className="text-gray-400">Awaiting approval from <strong className="text-white">{employeeName}</strong>.</p>

      <div className="bg-white/5 border border-red-900/30 rounded-xl p-5 text-left text-sm space-y-3">
        <p className="font-semibold text-white text-base mb-1">Please wait here…</p>
        {[
          ['①', `${employeeName} is being notified right now`],
          ['②', 'They will approve or decline your request'],
          ['③', 'Your QR code will appear on this screen automatically'],
        ].map(([n, t]) => (
          <div key={n} className="flex items-start gap-2 text-gray-400">
            <span className="text-red-500 font-bold flex-shrink-0">{n}</span>
            <span>{t}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span>Waiting for approval…</span>
      </div>

      <button onClick={onDone}
        className="bg-white/5 hover:bg-white/10 border border-red-900/40 text-white px-8 py-2.5 rounded-xl text-sm transition-colors">
        Cancel
      </button>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ onChoice }) {
  const options = [
    {
      id: 'qr',
      icon: QrCode,
      label: 'I Have a QR Code',
      sub: 'Pre-approved visit — scan your QR code to check in',
      border: 'hover:border-red-500',
      bg: 'hover:bg-red-900/20',
      iconBg: 'bg-red-900/40 group-hover:bg-red-700',
      iconColor: 'text-red-400 group-hover:text-white',
      cta: 'Scan QR Code',
      ctaColor: 'text-red-400',
    },
    {
      id: 'walkin',
      icon: UserPlus,
      label: 'Walk-In Visit',
      sub: 'No appointment — register now and notify your host',
      border: 'hover:border-red-600',
      bg: 'hover:bg-red-800/20',
      iconBg: 'bg-red-800/30 group-hover:bg-red-600',
      iconColor: 'text-red-300 group-hover:text-white',
      cta: 'Register Visit',
      ctaColor: 'text-red-300',
    },
    {
      id: 'preplanned',
      icon: CalendarPlus,
      label: 'Pre-Plan a Future Visit',
      sub: 'Schedule a visit in advance through the staff portal',
      border: 'hover:border-red-700',
      bg: 'hover:bg-red-950/30',
      iconBg: 'bg-red-950/50 group-hover:bg-red-800',
      iconColor: 'text-red-500 group-hover:text-white',
      cta: 'Schedule Visit',
      ctaColor: 'text-red-500',
    },
  ];

  return (
    <div className="w-full max-w-4xl">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold text-white mb-3">Welcome!</h1>
        <p className="text-red-300 text-lg">How can we help you today?</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChoice(opt.id)}
            className={`group bg-white/3 border-2 border-white/8 ${opt.border} ${opt.bg} rounded-2xl p-7 text-left transition-all duration-200 hover:shadow-2xl hover:-translate-y-1`}
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className={`w-14 h-14 rounded-2xl ${opt.iconBg} flex items-center justify-center mb-5 transition-colors duration-200`}>
              <opt.icon size={28} className={`${opt.iconColor} transition-colors duration-200`} />
            </div>
            <h2 className="text-white text-lg font-bold mb-2">{opt.label}</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{opt.sub}</p>
            <div className={`mt-5 flex items-center gap-2 ${opt.ctaColor} text-sm font-medium`}>
              <span>{opt.cta}</span><span>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Root Kiosk ───────────────────────────────────────────────────────────────
export default function KioskPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState('home');
  const [showScanner, setShowScanner] = useState(false);
  const [validatedData, setValidatedData] = useState(null);
  const [submittedEmp, setSubmittedEmp] = useState('');
  const [submittedVisitId, setSubmittedVisitId] = useState(null);

  const reset = () => { setScreen('home'); setValidatedData(null); setSubmittedEmp(''); setSubmittedVisitId(null); };

  const handleChoice = (id) => {
    if (id === 'qr') setShowScanner(true);
    else setScreen(id);
  };

  return (
    <div className="min-h-screen flex flex-col text-white select-none" style={{ background: BG }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-red-900/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-700 flex items-center justify-center shadow-lg">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold leading-tight">Nanta Tech Limited</div>
            <div className="text-red-500 text-xs">Visitor Reception · Powered by Temi</div>
          </div>
        </div>
        <KioskClock />
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        {screen === 'home' && <HomeScreen onChoice={handleChoice} />}
        {screen === 'walkin' && (
          <WalkInForm
            onBack={reset}
            onDone={(emp, visitId) => { setSubmittedEmp(emp); setSubmittedVisitId(visitId); setScreen('submitted'); }}
          />
        )}
        {screen === 'preplanned' && (
          <PrePlannedInfo onBack={reset} onGoToPortal={() => navigate('/login')} />
        )}
        {screen === 'submitted' && <SubmittedScreen employeeName={submittedEmp} visitId={submittedVisitId} onDone={reset} />}
        {screen === 'validated' && validatedData && <ValidatedScreen data={validatedData} onDone={reset} />}
      </main>

      {/* Footer */}
      <footer className="px-8 py-3 border-t border-red-900/20 flex items-center justify-between text-xs text-gray-700 flex-shrink-0">
        <span>Temi · Serial: 00126040079</span>
        <button onClick={() => navigate('/login')} className="text-gray-700 hover:text-red-500 transition-colors underline underline-offset-2">
          Staff Portal →
        </button>
        <span>For help, contact security desk</span>
      </footer>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScannerModal
          onValidated={(data) => { setShowScanner(false); setValidatedData(data); setScreen('validated'); }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
