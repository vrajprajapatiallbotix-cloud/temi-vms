import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, User, Building, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Sidebar from '../../components/common/Sidebar';
import StatusBadge from '../../components/common/StatusBadge';
import QRDisplay from '../../components/common/QRDisplay';
import NotificationBell from '../../components/common/NotificationBell';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function ApprovalCard({ visit, onAction }) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onAction(visit.id, 'approve');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await onAction(visit.id, 'decline', reason);
    } finally {
      setLoading(false);
      setShowDecline(false);
    }
  };

  return (
    <div className="card border-l-4 border-l-yellow-400">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{visit.visitor_name}</h3>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1 flex-wrap">
              {visit.company && <span className="flex items-center gap-1"><Building size={12} />{visit.company}</span>}
              {visit.visitor_phone && <span className="flex items-center gap-1"><Phone size={12} />{visit.visitor_phone}</span>}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Purpose:</span> {visit.purpose}
            </p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Clock size={12} />
              {formatDistanceToNow(new Date(visit.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <StatusBadge status={visit.status} />
      </div>

      {visit.status === 'pending' && (
        <div className="mt-4 pt-4 border-t">
          {!showDecline ? (
            <div className="flex gap-3">
              <button onClick={handleApprove} disabled={loading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                <CheckCircle size={15} /> Approve
              </button>
              <button onClick={() => setShowDecline(true)} disabled={loading}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <XCircle size={15} /> Decline
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for declining (optional)"
                rows={2} className="input resize-none text-sm" />
              <div className="flex gap-2">
                <button onClick={handleDecline} disabled={loading}
                  className="btn-danger text-sm flex items-center gap-1">
                  <XCircle size={14} /> Confirm Decline
                </button>
                <button onClick={() => setShowDecline(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VisitApprovals({ socket }) {
  const [pending, setPending] = useState([]);
  const [allVisits, setAllVisits] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [approvedQR, setApprovedQR] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, allRes] = await Promise.all([
        api.get('/employee/visits/pending'),
        api.get('/employee/visits'),
      ]);
      setPending(pendingRes.data);
      setAllVisits(allRes.data.visits);
    } catch {
      toast.error('Failed to load visits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('visit:request', fetchData);
    return () => socket.off('visit:request', fetchData);
  }, [socket, fetchData]);

  const handleAction = async (visitId, action, reason) => {
    try {
      const { data } = await api.post('/employee/approve', { visitId, action, declineReason: reason });
      toast.success(action === 'approve' ? 'Visit approved! QR sent to visitor.' : 'Visit declined.');
      if (action === 'approve' && data.qrImage) {
        setApprovedQR({ qrImage: data.qrImage, expiresAt: data.expiresAt });
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  if (loading) return (
    <div className="flex h-screen"><Sidebar />
      <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Visit Approvals</h1>
            <p className="text-sm text-gray-500">Approve or decline visitor requests</p>
          </div>
          <NotificationBell socket={socket} />
        </div>

        <div className="p-6">
          {approvedQR && (
            <div className="mb-6 card bg-green-50 border-green-200">
              <div className="flex items-start gap-4">
                <QRDisplay qrImage={approvedQR.qrImage} expiresAt={approvedQR.expiresAt} visitorName="Approved Visitor" />
                <div>
                  <h3 className="font-semibold text-green-900">Visit Approved!</h3>
                  <p className="text-sm text-green-700 mt-1">QR code has been sent to the visitor's email. They can also scan below.</p>
                  <button onClick={() => setApprovedQR(null)} className="mt-3 text-sm text-green-600 hover:underline">Dismiss</button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            {[['pending', `Pending (${pending.length})`], ['all', 'All Visits']].map(([k, l]) => (
              <button key={k} onClick={() => setActiveTab(k)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>

          {activeTab === 'pending' ? (
            <div className="space-y-4">
              {pending.length === 0 ? (
                <div className="card text-center py-16 text-gray-400">
                  <CheckCircle size={40} className="mx-auto mb-2 opacity-30" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                pending.map((v) => <ApprovalCard key={v.id} visit={v} onAction={handleAction} />)
              )}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {['Visitor', 'Company', 'Purpose', 'Type', 'Status', 'Date'].map((h) => (
                      <th key={h} className="pb-3 font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="py-3 font-medium">{v.visitor_name}</td>
                      <td className="py-3 text-gray-500">{v.company || '—'}</td>
                      <td className="py-3 text-gray-500 max-w-32 truncate">{v.purpose}</td>
                      <td className="py-3"><StatusBadge status={v.visit_type} /></td>
                      <td className="py-3"><StatusBadge status={v.status} /></td>
                      <td className="py-3 text-gray-500">
                        {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
