import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, KeyRound, UserPlus, CalendarPlus, CheckCircle, ArrowLeft,
  Building, Phone, FileText, Search, User, MapPin, Clock, X, Mail,
} from 'lucide-react';
import { format } from 'date-fns';
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

// ─── OTP Entry Modal ──────────────────────────────────────────────────────────
function OTPEntryModal({ onValidated, onClose }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('email'); // email → otp → validating → error
  const [errMsg, setErrMsg] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const inputRefs = useRef([]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStep('otp');
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handleDigit = (idx, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter' && otp.every((d) => d)) handleVerify();
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setStep('validating');
    setErrMsg('');
    try {
      const { data } = await api.post('/otp/verify', { email: email.trim().toLowerCase(), otp: code });
      onValidated(data);
    } catch (err) {
      const errorData = err.response?.data || {};
      setErrMsg(errorData.message || 'Invalid OTP. Please try again.');
      setAttemptsLeft(errorData.attemptsLeft ?? (attemptsLeft - 1));
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  useEffect(() => {
    if (otp.every((d) => d) && step === 'otp') handleVerify();
  }, [otp]); // eslint-disable-line

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className={`${CARD_BG} rounded-2xl overflow-hidden w-full max-w-sm border border-red-900/50 shadow-2xl`}>
        <div className="flex items-center justify-between px-5 py-3 bg-red-700">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <KeyRound size={16} /> Enter Your OTP
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm mb-4">Enter the email address used for your visit booking. Your OTP will be verified against it.</p>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500"
                  placeholder="your@email.com"
                />
              </div>
              <button type="submit"
                className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                Continue →
              </button>
            </form>
          )}

          {(step === 'otp' || step === 'validating' || step === 'error') && (
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Enter the 6-digit OTP sent to</p>
                <p className="text-white font-medium text-sm truncate">{email}</p>
              </div>

              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx} ref={(el) => (inputRefs.current[idx] = el)}
                    value={digit} onChange={(e) => handleDigit(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    maxLength={1} inputMode="numeric" pattern="\d*"
                    disabled={step === 'validating'}
                    className="w-11 h-14 text-center text-2xl font-bold text-white bg-white/10 border-2 border-white/20 rounded-xl focus:outline-none focus:border-red-500 disabled:opacity-50 transition-colors"
                  />
                ))}
              </div>

              {errMsg && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-2.5 text-sm text-red-300">
                  {errMsg}
                  {attemptsLeft > 0 && attemptsLeft <= 2 && (
                    <span className="block text-xs text-red-400 mt-0.5">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</span>
                  )}
                </div>
              )}

              {step === 'validating' && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
                  <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  Verifying OTP…
                </div>
              )}

              <button onClick={() => setStep('email')}
                className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors mt-2">
                ← Change email address
              </button>
            </div>
          )}
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

  const inputCls = 'w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 pl-8 text-sm focus:outline-none focus:border-red-500 transition-colors';

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        <input value={value} onChange={(e) => { onChange(e.target.value); onSelect(null); }}
          onFocus={() => results.length && setOpen(true)}
          className={inputCls} placeholder="Type employee name…" autoComplete="off" />
      </div>
      {open && results.length > 0 && (
        <div className={`absolute z-30 w-full ${DROPDOWN_BG} border border-red-900/40 rounded-xl shadow-2xl mt-1 max-h-44 overflow-y-auto`}>
          {results.map((emp) => (
            <button key={emp.id} type="button"
              onMouseDown={() => { onSelect(emp); onChange(emp.name); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-red-900/30 border-b border-white/5 last:border-0 transition-colors">
              <div className="text-sm font-medium text-white">{emp.name}</div>
              <div className="text-xs text-red-400/70">
                {emp.desk_location && <span>{emp.desk_location}</span>}
                {emp.desk_location && emp.department && <span className="text-gray-700 mx-1">·</span>}
                {emp.department && <span className="text-gray-600">{emp.department}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      {selected ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-400">
          <CheckCircle size={11} />
          <span>{selected.name}{selected.desk_location ? ` — ${selected.desk_location}` : ''}</span>
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
    if (!form.visitorEmail) return toast.error('Email is required to receive your OTP when approved');
    setLoading(true);
    try {
      const { data } = await api.post('/otp/walk-in', { ...form, employeeId: selectedEmp.id });
      toast.success('Request submitted!');
      onDone(selectedEmp.name, data.visitId, form.visitorEmail);
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
            <p className="text-red-200 text-xs">Fill in your details — the employee will be notified and you'll receive an OTP</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Email Address * <span className="text-gray-600 font-normal">(you'll receive your OTP here when approved)</span>
            </label>
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
              <input type="email" value={form.visitorEmail} onChange={set('visitorEmail')} required className={inputCls} placeholder="you@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Company / Organisation</label>
            <div className="relative">
              <Building size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
              <input value={form.visitorCompany} onChange={set('visitorCompany')} className={inputCls} placeholder="Acme Corp" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Whom to Meet *</label>
            <EmployeeSearch value={empSearch} onChange={setEmpSearch} onSelect={setSelectedEmp} selected={selectedEmp} />
          </div>

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

// ─── Pre-Planned Booking Info ─────────────────────────────────────────────────
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
            <p className="text-red-200 text-xs">Schedule a visit in advance — visitor gets an OTP by email</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            {[
              { n: '1', title: 'Employee logs in to the Staff Portal', desc: 'Use the Staff Portal button below to sign in.' },
              { n: '2', title: 'Fill visitor & meeting details', desc: 'Enter visitor name, email, date/time, meeting room and purpose.' },
              { n: '3', title: 'System sends invite email', desc: 'Visitor receives a secure link to complete their registration.' },
              { n: '4', title: 'Visitor receives OTP by email', desc: 'A 6-digit OTP is emailed once the visit is approved.' },
              { n: '5', title: 'On arrival — enter OTP at reception', desc: 'Visitor enters their email + OTP at this kiosk to check in.' },
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

// ─── OTP Validated Success Screen ─────────────────────────────────────────────
function ValidatedScreen({ data, onDone }) {
  const { visit } = data;
  useEffect(() => { const t = setTimeout(onDone, 25000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="w-full max-w-md text-center space-y-5">
      <div className="w-20 h-20 bg-red-700/30 rounded-full flex items-center justify-center mx-auto border-2 border-red-500">
        <CheckCircle size={40} className="text-red-400" />
      </div>
      <div>
        <p className="text-red-400 text-sm font-medium tracking-wide uppercase mb-1">Check-In Successful</p>
        <h2 className="text-4xl font-bold text-white">{visit?.visitorName}</h2>
        {visit?.visitorCompany && <p className="text-red-200 mt-1">{visit.visitorCompany}</p>}
      </div>

      <div className="bg-white/5 border border-red-900/30 rounded-2xl p-5 text-left space-y-3">
        {visit?.hostName && (
          <div className="flex items-center gap-3">
            <User size={15} className="text-red-500 flex-shrink-0" />
            <span className="text-gray-300 text-sm">Meeting <strong className="text-white">{visit.hostName}</strong>
              {visit.hostDepartment && <span className="text-gray-500"> · {visit.hostDepartment}</span>}
            </span>
          </div>
        )}
        {visit?.destination && (
          <div className="flex items-center gap-3">
            <MapPin size={15} className="text-red-500 flex-shrink-0" />
            <span className="text-gray-300 text-sm">
              Heading to <strong className="text-white">
                {visit.destination.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
            </span>
          </div>
        )}
        {visit?.meetingRoom && (
          <div className="flex items-center gap-3">
            <Clock size={15} className="text-red-500 flex-shrink-0" />
            <span className="text-gray-300 text-sm">Meeting Room: {visit.meetingRoom}</span>
          </div>
        )}
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

// ─── Walk-In Submitted (waits for OTP via socket) ─────────────────────────────
function SubmittedScreen({ employeeName, visitId, visitorEmail, onDone }) {
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!visitId) return;
    const sock = socketIo(import.meta.env.VITE_SOCKET_URL || '', { withCredentials: true });
    sock.emit('visit:join', { visitId });
    sock.on('visit:approved', () => {
      setOtpSent(true);
      toast.success('Visit approved! OTP has been sent to your email.');
    });
    // Legacy event still emitted for backward compat
    sock.on('visit:approved_qr', () => {
      setOtpSent(true);
      toast.success('Visit approved! OTP has been sent to your email.');
    });
    return () => sock.disconnect();
  }, [visitId]);

  useEffect(() => {
    const delay = otpSent ? 60000 : 120000;
    const t = setTimeout(onDone, delay);
    return () => clearTimeout(t);
  }, [otpSent, onDone]);

  if (otpSent) {
    return (
      <div className="w-full max-w-md text-center space-y-5">
        <div className="w-20 h-20 bg-red-700/30 rounded-full flex items-center justify-center mx-auto border-2 border-red-500">
          <CheckCircle size={40} className="text-red-400" />
        </div>
        <div>
          <p className="text-red-400 text-sm font-medium tracking-wide uppercase mb-1">Visit Approved!</p>
          <h2 className="text-3xl font-bold text-white">Check Your Email</h2>
          <p className="text-gray-400 text-sm mt-2">
            Your 6-digit OTP has been sent to <strong className="text-white">{visitorEmail}</strong>
          </p>
        </div>

        <div className="bg-white/5 border border-red-900/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-800/50 text-red-400 text-sm font-bold flex items-center justify-center flex-shrink-0">①</div>
            <p className="text-gray-300 text-sm text-left">Open your email and copy the 6-digit OTP</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-800/50 text-red-400 text-sm font-bold flex items-center justify-center flex-shrink-0">②</div>
            <p className="text-gray-300 text-sm text-left">Tap "I Have an OTP" on the home screen</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-800/50 text-red-400 text-sm font-bold flex items-center justify-center flex-shrink-0">③</div>
            <p className="text-gray-300 text-sm text-left">Enter your email and OTP to complete check-in</p>
          </div>
        </div>

        <button onClick={onDone}
          className="bg-red-700 hover:bg-red-600 text-white px-8 py-2.5 rounded-xl text-sm transition-colors">
          Back to Home
        </button>
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
          ['③', `Once approved, a 6-digit OTP will be emailed to ${visitorEmail}`],
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
      id: 'otp',
      icon: KeyRound,
      label: 'I Have an OTP',
      sub: 'Pre-approved visit — enter your 6-digit OTP to check in',
      border: 'hover:border-red-500',
      bg: 'hover:bg-red-900/20',
      iconBg: 'bg-red-900/40 group-hover:bg-red-700',
      iconColor: 'text-red-400 group-hover:text-white',
      cta: 'Enter OTP',
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
          <button key={opt.id} onClick={() => onChoice(opt.id)}
            className={`group bg-white/3 border-2 border-white/8 ${opt.border} ${opt.bg} rounded-2xl p-7 text-left transition-all duration-200 hover:shadow-2xl hover:-translate-y-1`}
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
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
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [validatedData, setValidatedData] = useState(null);
  const [submittedEmp, setSubmittedEmp] = useState('');
  const [submittedVisitId, setSubmittedVisitId] = useState(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const reset = () => {
    setScreen('home');
    setValidatedData(null);
    setSubmittedEmp('');
    setSubmittedVisitId(null);
    setSubmittedEmail('');
  };

  const handleChoice = (id) => {
    if (id === 'otp') setShowOTPModal(true);
    else setScreen(id);
  };

  return (
    <div className="min-h-screen flex flex-col text-white select-none" style={{ background: BG }}>

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

      <main className="flex-1 flex items-center justify-center p-8">
        {screen === 'home' && <HomeScreen onChoice={handleChoice} />}
        {screen === 'walkin' && (
          <WalkInForm
            onBack={reset}
            onDone={(emp, visitId, email) => {
              setSubmittedEmp(emp);
              setSubmittedVisitId(visitId);
              setSubmittedEmail(email);
              setScreen('submitted');
            }}
          />
        )}
        {screen === 'preplanned' && (
          <PrePlannedInfo onBack={reset} onGoToPortal={() => navigate('/login')} />
        )}
        {screen === 'submitted' && (
          <SubmittedScreen
            employeeName={submittedEmp}
            visitId={submittedVisitId}
            visitorEmail={submittedEmail}
            onDone={reset}
          />
        )}
        {screen === 'validated' && validatedData && <ValidatedScreen data={validatedData} onDone={reset} />}
      </main>

      <footer className="px-8 py-3 border-t border-red-900/20 flex items-center justify-between text-xs text-gray-700 flex-shrink-0">
        <span>Temi · Serial: 00126040079</span>
        <button onClick={() => navigate('/login')} className="text-gray-700 hover:text-red-500 transition-colors underline underline-offset-2">
          Staff Portal →
        </button>
        <span>For help, contact security desk</span>
      </footer>

      {showOTPModal && (
        <OTPEntryModal
          onValidated={(data) => { setShowOTPModal(false); setValidatedData(data); setScreen('validated'); }}
          onClose={() => setShowOTPModal(false)}
        />
      )}
    </div>
  );
}
