import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Calendar, Building, Mail, Phone, MapPin, FileText, ArrowLeft, Wifi } from 'lucide-react';
import { io } from 'socket.io-client';
import Sidebar from '../../components/common/Sidebar';
import QRDisplay from '../../components/common/QRDisplay';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const TEMI_SERIAL = '00126040079';
const FALLBACK_LOCATIONS = ['reception', 'meeting_room_a', 'meeting_room_b', 'conference_hall', 'waiting_area'];

export default function NewVisit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [locations, setLocations] = useState([]);
  const [liveUpdate, setLiveUpdate] = useState(false);
  const [form, setForm] = useState({
    visitorName: '', visitorEmail: '', visitorPhone: '',
    visitorCompany: '', purpose: '', scheduledAt: '', meetingRoom: '', notes: '',
  });

  useEffect(() => {
    // Initial fetch
    api.get(`/temi/locations/${TEMI_SERIAL}`)
      .then(({ data }) => setLocations(data.savedRooms?.length ? data.savedRooms : FALLBACK_LOCATIONS))
      .catch(() => setLocations(FALLBACK_LOCATIONS));

    // Real-time location updates from Temi robot
    const socket = io(import.meta.env.VITE_SOCKET_URL || '', { withCredentials: true });
    socket.on('temi:locations_synced', ({ serial, locations: newLocs }) => {
      if (serial === TEMI_SERIAL && newLocs?.length) {
        setLocations(newLocs);
        setLiveUpdate(true);
        toast.success(`Temi map updated — ${newLocs.length} locations`, { duration: 3000 });
        setTimeout(() => setLiveUpdate(false), 5000);
      }
    });

    return () => socket.disconnect();
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/visitor/preplanned', form);
      setResult(data);
      toast.success('Visit created! Invitation sent to visitor.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create visit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Schedule a Visit</h1>
            <p className="text-sm text-gray-500">Create a pre-planned visit and send QR invite</p>
          </div>
        </div>

        <div className="p-6 max-w-2xl">
          {!result ? (
            <form onSubmit={handleSubmit} className="card space-y-5">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus size={18} className="text-primary-600" /> Visitor Details
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input value={form.visitorName} onChange={set('visitorName')} required className="input" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={form.visitorCompany} onChange={set('visitorCompany')} className="input pl-8" placeholder="Acme Corp" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={form.visitorEmail} onChange={set('visitorEmail')} required className="input pl-8" placeholder="visitor@example.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={form.visitorPhone} onChange={set('visitorPhone')} className="input pl-8" placeholder="+91 9876543210" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date & Time *</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} required className="input pl-8" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Meeting Room
                    {liveUpdate && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                        <Wifi size={10} /> Live
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select value={form.meetingRoom} onChange={set('meetingRoom')} className="input pl-8">
                      <option value="">Select room ({locations.length} available)</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Visit *</label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3 text-gray-400" />
                  <textarea value={form.purpose} onChange={set('purpose')} required rows={2} className="input pl-8 resize-none" placeholder="Business meeting, Interview, Demo..." />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className="input resize-none" placeholder="Any special instructions..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                  {loading && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />}
                  {loading ? 'Creating...' : 'Create Visit & Send Invite'}
                </button>
                <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          ) : (
            <div className="card text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <UserPlus size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Visit Scheduled!</h2>
              <p className="text-gray-500 text-sm">
                An invitation email has been sent to <strong>{form.visitorEmail}</strong>.
                The visitor will fill in their details and receive a QR code.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left text-sm">
                <p className="font-medium text-gray-700 mb-1">Visitor Registration Link:</p>
                <a href={result.secureLink} target="_blank" rel="noreferrer"
                  className="text-primary-600 break-all hover:underline text-xs">
                  {result.secureLink}
                </a>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button onClick={() => { setResult(null); setForm({ visitorName:'',visitorEmail:'',visitorPhone:'',visitorCompany:'',purpose:'',scheduledAt:'',meetingRoom:'',notes:'' }); }}
                  className="btn-secondary">Create Another</button>
                <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
