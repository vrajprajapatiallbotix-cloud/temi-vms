import React, { useState, useEffect } from 'react';
import { User, Building, Phone, FileText, Search, CheckCircle, Clock } from 'lucide-react';
import { Bot } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ImpromptuForm() {
  const [employees, setEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    visitorName: '', visitorEmail: '', visitorPhone: '',
    visitorCompany: '', purpose: '', employeeId: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data } = await api.get(`/visitor/employees/search?q=${empSearch}`);
        setEmployees(data || []);
      } catch {}
    };
    const t = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  const selectEmployee = (emp) => {
    setSelectedEmp(emp);
    setForm((f) => ({ ...f, employeeId: emp.id }));
    setEmpSearch(emp.name);
    setEmployees([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employeeId) return toast.error('Please select an employee to visit');
    setLoading(true);
    try {
      await api.post('/visitor/impromptu', form);
      setSubmitted(true);
      toast.success('Request sent! Waiting for employee approval.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3 border border-white/20">
            <Bot size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Walk-In Visit</h1>
          <p className="text-primary-200 text-sm mt-1">Register your visit at reception</p>
        </div>

        {!submitted ? (
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.visitorName} onChange={set('visitorName')} required className="input pl-8" placeholder="Full name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={form.visitorCompany} onChange={set('visitorCompany')} className="input pl-8" placeholder="Company" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={form.visitorPhone} onChange={set('visitorPhone')} className="input pl-8" placeholder="Phone" />
                  </div>
                </div>
              </div>

              {/* Employee search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Whom to Meet *</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={empSearch}
                    onChange={(e) => { setEmpSearch(e.target.value); setSelectedEmp(null); setForm((f) => ({ ...f, employeeId: '' })); }}
                    className="input pl-8"
                    placeholder="Search employee by name..."
                  />
                  {employees.length > 0 && !selectedEmp && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {employees.map((emp) => (
                        <button key={emp.id} type="button" onClick={() => selectEmployee(emp)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-b-0">
                          <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                          <div className="text-xs text-gray-500">{emp.department || 'N/A'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedEmp && (
                  <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Selected: {selectedEmp.name} ({selectedEmp.department || 'N/A'})
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Visit *</label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3 text-gray-400" />
                  <textarea value={form.purpose} onChange={set('purpose')} required rows={2}
                    className="input pl-8 resize-none" placeholder="Meeting, delivery, inquiry..." />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Submitting...' : 'Submit Visit Request'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <Clock size={32} className="text-yellow-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Request Submitted!</h2>
            <p className="text-gray-500 text-sm">
              Your visit request has been sent to{' '}
              <strong>{selectedEmp?.name}</strong>. Please wait for their approval.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
              <p className="font-medium">What happens next?</p>
              <ul className="mt-2 space-y-1 text-left list-disc list-inside text-xs">
                <li>The employee will receive your request</li>
                <li>They will approve or decline</li>
                <li>If approved, you'll receive a QR code via email or SMS</li>
                <li>Show the QR to Temi robot at reception</li>
              </ul>
            </div>
            <button onClick={() => { setSubmitted(false); setForm({ visitorName:'',visitorEmail:'',visitorPhone:'',visitorCompany:'',purpose:'',employeeId:'' }); setSelectedEmp(null); setEmpSearch(''); }}
              className="btn-secondary w-full">New Request</button>
          </div>
        )}
      </div>
    </div>
  );
}
