import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, Building, Phone, Camera, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import QRDisplay from '../../components/common/QRDisplay';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function VisitorForm() {
  const { token } = useParams();
  const [visitInfo, setVisitInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [form, setForm] = useState({ fullName: '', company: '', phone: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const fetchVisit = async () => {
      try {
        const { data } = await api.get(`/visitor/register/${token}`);
        setVisitInfo(data);
        setForm((f) => ({ ...f, fullName: data.visitorName || '', company: data.company || '' }));
      } catch (err) {
        toast.error(err.response?.data?.error || 'Invalid invitation link');
      } finally {
        setLoading(false);
      }
    };
    fetchVisit();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (photoFile) formData.append('photo', photoFile);

      const { data } = await api.post(`/visitor/register/${token}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setQrData(data);
      toast.success('Registration complete!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="lg" />
    </div>
  );

  if (!visitInfo) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card max-w-md w-full text-center">
        <div className="text-red-400 text-5xl mb-4">⚠</div>
        <h2 className="text-xl font-semibold text-gray-900">Invalid Invitation</h2>
        <p className="text-gray-500 mt-2">This link is invalid or has expired. Please contact your host.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-white text-2xl font-bold">Visitor Registration</div>
          <p className="text-primary-200 text-sm mt-1">Complete your details to get your QR code</p>
        </div>

        {!qrData ? (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Visit info header */}
            <div className="bg-primary-600 px-6 py-4">
              <div className="text-white text-sm font-medium">Your Visit Details</div>
              <div className="text-primary-100 text-xs mt-1 space-y-0.5">
                <div>Host: <span className="font-medium text-white">{visitInfo.employeeName}</span> — {visitInfo.department}</div>
                {visitInfo.scheduledAt && (
                  <div>Date: <span className="font-medium text-white">{format(new Date(visitInfo.scheduledAt), 'dd MMM yyyy, hh:mm a')}</span></div>
                )}
                {visitInfo.meetingRoom && (
                  <div>Room: <span className="font-medium text-white">{visitInfo.meetingRoom.replace(/_/g, ' ')}</span></div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.fullName} onChange={set('fullName')} required className="input pl-8" placeholder="Your full name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.company} onChange={set('company')} className="input pl-8" placeholder="Your company" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.phone} onChange={set('phone')} className="input pl-8" placeholder="+91 9876543210" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-lg p-3 cursor-pointer hover:border-primary-300 transition-colors">
                  <Camera size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {photoFile ? photoFile.name : 'Upload your photo'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files[0])} />
                </label>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                {submitting ? 'Registering...' : 'Complete Registration'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">You're Registered!</h2>
            <p className="text-gray-500 text-sm">
              Your QR code has been sent to your email. Show it to Temi robot at the reception.
            </p>
            <QRDisplay qrImage={qrData.qrImage} expiresAt={qrData.expiresAt} visitorName={form.fullName} />
          </div>
        )}
      </div>
    </div>
  );
}
