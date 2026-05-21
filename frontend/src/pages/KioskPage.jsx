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

// ─── Live Clock ───────────────────────────────────────────────────────────────
function KioskClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="text-right leading-tight">
      <div className="text-gray-900 text-xl font-mono font-bold">{format(now, 'hh:mm:ss a')}</div>
      <div className="text-orange-500 text-xs font-medium">{format(now, 'EEEE, dd MMMM yyyy')}</div>
    </div>
  );
}

// ─── OTP Entry Modal (no email step) ─────────────────────────────────────────
function OTPEntryModal({ onValidated, onClose }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('otp'); // otp → validating
  const [errMsg, setErrMsg] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const inputRefs = useRef([]);

  useEffect(() => { setTimeout(() => inputRefs.current[0]?.focus(), 100); }, []);

  const handleDigit = (idx, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'Enter' && otp.every((d) => d)) handleVerify();
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) { setOtp(text.split('')); inputRefs.current[5]?.focus(); }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setStep('validating');
    setErrMsg('');
    try {
      const { data } = await api.post('/otp/verify', { otp: code });
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl border border-orange-100">
        <div className="flex items-center justify-between px-5 py-3 bg-orange-500">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <KeyRound size={16} /> Enter Your 6-Digit OTP
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-gray-500 text-sm text-center">
            Enter the OTP sent to your email when your visit was approved.
          </p>

          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx} ref={(el) => (inputRefs.current[idx] = el)}
                value={digit} onChange={(e) => handleDigit(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                maxLength={1} inputMode="numeric" pattern="\d*"
                disabled={step === 'validating'}
                className="w-11 h-14 text-center text-2xl font-bold text-gray-900 bg-orange-50 border-2 border-orange-200 rounded-xl focus:outline-none focus:border-orange-500 disabled:opacity-50 transition-colors"
              />
            ))}
          </div>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              {errMsg}
              {attemptsLeft > 0 && attemptsLeft <= 2 && (
                <span className="block text-xs text-red-500 mt-0.5">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</span>
              )}
            </div>
          )}

          {step === 'validating' && (
            <div className="flex items-center justify-center gap-2 text-orange-500 text-sm">
              <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              Verifying OTP…
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={step === 'validating' || otp.some((d) => !d)}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            Verify OTP →
          </button>
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

  const inputCls = 'w-full bg-orange-50 border border-orange-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 pl-8 text-sm focus:outline-none focus:border-orange-500 transition-colors';

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input value={value} onChange={(e) => { onChange(e.target.value); onSelect(null); }}
          onFocus={() => results.length && setOpen(true)}
          className={inputCls} placeholder="Type employee name…" autoComplete="off" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 w-full bg-white border border-orange-200 rounded-xl shadow-xl mt-1 max-h-44 overflow-y-auto">
          {results.map((emp) => (
            <button key={emp.id} type="button"
              onMouseDown={() => { onSelect(emp); onChange(emp.name); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b border-gray-50 last:border-0 transition-colors">
              <div className="text-sm font-medium text-gray-900">{emp.name}</div>
              <div className="text-xs text-orange-500">
                {emp.desk_location && <span>{emp.desk_location}</span>}
                {emp.desk_location && emp.department && <span className="text-gray-300 mx-1">·</span>}
                {emp.department && <span className="text-gray-400">{emp.department}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      {selected ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle size={11} />
          <span>{selected.name}{selected.desk_location ? ` — ${selected.desk_location}` : ''}</span>
        </div>
      ) : value.length > 0 ? (
        <p className="mt-1.5 text-xs text-orange-500">Select an employee from the list above</p>
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

  const inputCls = 'w-full bg-orange-50 border border-orange-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 pl-8 text-sm focus:outline-none focus:border-orange-500 transition-colors';

  return (
    <div className="w-full max-w-lg">
      <button onClick={onBack} className="flex items-center gap-1.5 text-orange-500 hover:text-orange-700 mb-5 text-sm transition-colors font-medium">
        <ArrowLeft size={15} /> Back to Home
      </button>

      <div className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-orange-500 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <UserPlus size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Walk-In Visit Registration</h2>
            <p className="text-orange-100 text-xs">Fill in your details — the employee will be notified and you'll receive an OTP</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Your Full Name *</label>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={form.visitorName} onChange={set('visitorName')} required className={inputCls} placeholder="John Doe" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={form.visitorPhone} onChange={set('visitorPhone')} className={inputCls} placeholder="+91 9876543210" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Email Address * <span className="text-gray-400 font-normal">(you'll receive your OTP here when approved)</span>
            </label>
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="email" value={form.visitorEmail} onChange={set('visitorEmail')} required className={inputCls} placeholder="you@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Company / Organisation</label>
            <div className="relative">
              <Building size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={form.visitorCompany} onChange={set('visitorCompany')} className={inputCls} placeholder="Acme Corp" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Whom to Meet *</label>
            <EmployeeSearch value={empSearch} onChange={setEmpSearch} onSelect={setSelectedEmp} selected={selectedEmp} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Purpose of Visit *</label>
            <div className="relative">
              <FileText size={13} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
              <textarea value={form.purpose} onChange={set('purpose')} required rows={2}
                className="w-full bg-orange-50 border border-orange-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2 pl-8 text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
                placeholder="Meeting, delivery, interview, demo…" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
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
      <button onClick={onBack} className="flex items-center gap-1.5 text-orange-500 hover:text-orange-700 mb-5 text-sm transition-colors font-medium">
        <ArrowLeft size={15} /> Back to Home
      </button>
      <div className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-orange-600 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <CalendarPlus size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Pre-Planned Visit Booking</h2>
            <p className="text-orange-100 text-xs">Schedule a visit in advance — visitor gets an OTP by email</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            {[
              { n: '1', title: 'Employee logs in to the Staff Portal', desc: 'Use the Staff Portal button below to sign in.' },
              { n: '2', title: 'Fill visitor & meeting details', desc: 'Enter visitor name, email, date/time, meeting room and purpose.' },
              { n: '3', title: 'System sends invite email', desc: 'Visitor receives a secure link to complete their registration.' },
              { n: '4', title: 'Visitor receives OTP by email', desc: 'A 6-digit OTP is emailed once the visit is approved.' },
              { n: '5', title: 'On arrival — enter OTP at reception', desc: 'Visitor enters their 6-digit OTP at this kiosk to check in.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 border border-orange-300 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <p className="text-gray-900 text-sm font-medium">{step.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onGoToPortal}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
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
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto border-2 border-green-400">
        <CheckCircle size={40} className="text-green-500" />
      </div>
      <div>
        <p className="text-orange-500 text-sm font-semibold tracking-wide uppercase mb-1">Check-In Successful</p>
        <h2 className="text-4xl font-bold text-gray-900">{visit?.visitorName}</h2>
        {visit?.visitorCompany && <p className="text-gray-500 mt-1">{visit.visitorCompany}</p>}
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-left space-y-3">
        {visit?.hostName && (
          <div className="flex items-center gap-3">
            <User size={15} className="text-orange-500 flex-shrink-0" />
            <span className="text-gray-700 text-sm">Meeting <strong className="text-gray-900">{visit.hostName}</strong>
              {visit.hostDepartment && <span className="text-gray-400"> · {visit.hostDepartment}</span>}
            </span>
          </div>
        )}
        {visit?.destination && (
          <div className="flex items-center gap-3">
            <MapPin size={15} className="text-orange-500 flex-shrink-0" />
            <span className="text-gray-700 text-sm">
              Heading to <strong className="text-gray-900">
                {visit.destination.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
            </span>
          </div>
        )}
        {visit?.meetingRoom && (
          <div className="flex items-center gap-3">
            <Clock size={15} className="text-orange-500 flex-shrink-0" />
            <span className="text-gray-700 text-sm">Meeting Room: {visit.meetingRoom}</span>
          </div>
        )}
      </div>

      <div className="bg-orange-500 rounded-xl p-4 flex items-center gap-3">
        <Bot size={28} className="text-white flex-shrink-0" />
        <p className="text-white text-sm text-left">
          <strong>Temi is on the way!</strong> The robot will escort you to your destination shortly. Please wait here.
        </p>
      </div>
      <button onClick={onDone} className="text-gray-400 hover:text-gray-600 text-xs transition-colors">Reset screen</button>
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
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto border-2 border-green-400">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <div>
          <p className="text-orange-500 text-sm font-semibold tracking-wide uppercase mb-1">Visit Approved!</p>
          <h2 className="text-3xl font-bold text-gray-900">Check Your Email</h2>
          <p className="text-gray-500 text-sm mt-2">
            Your 6-digit OTP has been sent to <strong className="text-gray-900">{visitorEmail}</strong>
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
          {[
            ['①', 'Open your email and copy the 6-digit OTP'],
            ['②', 'Tap "I Have an OTP" on the home screen'],
            ['③', 'Enter your OTP to complete check-in'],
          ].map(([n, text]) => (
            <div key={n} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 text-orange-600 text-sm font-bold flex items-center justify-center flex-shrink-0">{n}</div>
              <p className="text-gray-700 text-sm text-left">{text}</p>
            </div>
          ))}
        </div>

        <button onClick={onDone}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2.5 rounded-xl text-sm transition-colors font-medium">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md text-center space-y-5">
      <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto border-2 border-orange-400">
        <Clock size={40} className="text-orange-500" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900">Request Sent!</h2>
      <p className="text-gray-500">Awaiting approval from <strong className="text-gray-900">{employeeName}</strong>.</p>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-left text-sm space-y-3">
        <p className="font-semibold text-gray-900 text-base mb-1">Please wait here…</p>
        {[
          ['①', `${employeeName} is being notified right now`],
          ['②', 'They will approve or decline your request'],
          ['③', `Once approved, a 6-digit OTP will be emailed to ${visitorEmail}`],
        ].map(([n, t]) => (
          <div key={n} className="flex items-start gap-2 text-gray-500">
            <span className="text-orange-500 font-bold flex-shrink-0">{n}</span>
            <span>{t}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-orange-500 text-sm font-medium">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        <span>Waiting for approval…</span>
      </div>

      <button onClick={onDone}
        className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-8 py-2.5 rounded-xl text-sm transition-colors font-medium shadow-sm">
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
      border: 'border-orange-200 hover:border-orange-500',
      bg: 'hover:bg-orange-50',
      iconBg: 'bg-orange-100 group-hover:bg-orange-500',
      iconColor: 'text-orange-500 group-hover:text-white',
      cta: 'Enter OTP',
      ctaColor: 'text-orange-500',
    },
    {
      id: 'walkin',
      icon: UserPlus,
      label: 'Walk-In Visit',
      sub: 'No appointment — register now and notify your host',
      border: 'border-orange-100 hover:border-orange-400',
      bg: 'hover:bg-orange-50',
      iconBg: 'bg-orange-50 group-hover:bg-orange-400',
      iconColor: 'text-orange-400 group-hover:text-white',
      cta: 'Register Visit',
      ctaColor: 'text-orange-400',
    },
    {
      id: 'preplanned',
      icon: CalendarPlus,
      label: 'Pre-Plan a Future Visit',
      sub: 'Schedule a visit in advance through the staff portal',
      border: 'border-gray-200 hover:border-orange-300',
      bg: 'hover:bg-orange-50',
      iconBg: 'bg-gray-100 group-hover:bg-orange-300',
      iconColor: 'text-gray-500 group-hover:text-white',
      cta: 'Schedule Visit',
      ctaColor: 'text-gray-500 group-hover:text-orange-500',
    },
  ];

  return (
    <div className="w-full max-w-4xl">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold text-gray-900 mb-3">Welcome!</h1>
        <p className="text-orange-500 text-lg font-medium">How can we help you today?</p>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {options.map((opt) => (
          <button key={opt.id} onClick={() => onChoice(opt.id)}
            className={`group bg-white border-2 ${opt.border} ${opt.bg} rounded-2xl p-7 text-left transition-all duration-200 hover:shadow-xl hover:-translate-y-1 shadow-sm`}>
            <div className={`w-14 h-14 rounded-2xl ${opt.iconBg} flex items-center justify-center mb-5 transition-colors duration-200`}>
              <opt.icon size={28} className={`${opt.iconColor} transition-colors duration-200`} />
            </div>
            <h2 className="text-gray-900 text-lg font-bold mb-2">{opt.label}</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{opt.sub}</p>
            <div className={`mt-5 flex items-center gap-2 ${opt.ctaColor} text-sm font-semibold transition-colors`}>
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

  const reset = useCallback(() => {
    setScreen('home');
    setValidatedData(null);
    setSubmittedEmp('');
    setSubmittedVisitId(null);
    setSubmittedEmail('');
  }, []);

  const handleChoice = (id) => {
    if (id === 'otp') setShowOTPModal(true);
    else setScreen(id);
  };

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: 'linear-gradient(140deg,#ffffff 0%,#fff7ed 60%,#ffedd5 100%)' }}>

      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-orange-100 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-md">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <div className="text-gray-900 font-bold leading-tight">Nanta Tech Limited</div>
            <div className="text-orange-500 text-xs font-medium">Visitor Reception · Powered by Temi</div>
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

      <footer className="px-8 py-3 bg-white border-t border-orange-100 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
        <span>Temi · Serial: 00126040079</span>
        <button onClick={() => navigate('/login')} className="text-gray-400 hover:text-orange-500 transition-colors underline underline-offset-2">
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
