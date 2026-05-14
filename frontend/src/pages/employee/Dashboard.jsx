import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, CheckSquare, Clock, Users, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import Sidebar from '../../components/common/Sidebar';
import StatusBadge from '../../components/common/StatusBadge';
import NotificationBell from '../../components/common/NotificationBell';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard({ socket }) {
  const { user } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, checkedIn: 0, today: 0 });
  const [loading, setLoading] = useState(true);

  const fetchVisits = useCallback(async () => {
    try {
      const { data } = await api.get('/employee/visits?limit=10');
      setVisits(data.visits);
      setStats({
        total: data.total,
        pending: data.visits.filter((v) => v.status === 'pending').length,
        checkedIn: data.visits.filter((v) => v.status === 'checked_in').length,
        today: data.visits.filter((v) => {
          const d = new Date(v.created_at);
          const now = new Date();
          return d.toDateString() === now.toDateString();
        }).length,
      });
    } catch {
      toast.error('Failed to load visits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchVisits();
    socket.on('visit:checked_in', handler);
    socket.on('visit:approved', handler);
    return () => { socket.off('visit:checked_in', handler); socket.off('visit:approved', handler); };
  }, [socket, fetchVisits]);

  if (loading) return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell socket={socket} />
            <Link to="/visits/new" className="btn-primary flex items-center gap-2 text-sm">
              <UserPlus size={16} /> New Visit
            </Link>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Visits" value={stats.total} icon={Users} color="bg-primary-600" />
            <StatCard label="Today" value={stats.today} icon={Calendar} color="bg-green-500" />
            <StatCard label="Pending" value={stats.pending} icon={Clock} color="bg-yellow-500" />
            <StatCard label="Checked In" value={stats.checkedIn} icon={CheckSquare} color="bg-blue-500" />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/visits/new" className="card hover:border-primary-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">Schedule a Visit</div>
                  <div className="text-sm text-gray-500 mt-1">Invite a visitor with QR code</div>
                </div>
                <ArrowRight size={20} className="text-gray-300 group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>
            <Link to="/visits/approvals" className="card hover:border-primary-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">Pending Approvals</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {stats.pending > 0 ? `${stats.pending} visitor(s) waiting` : 'No pending approvals'}
                  </div>
                </div>
                <ArrowRight size={20} className="text-gray-300 group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>
          </div>

          {/* Recent Visits */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Visits</h2>
              <Link to="/visits/approvals" className="text-sm text-primary-600 hover:underline">View all</Link>
            </div>

            {visits.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users size={40} className="mx-auto mb-2 opacity-30" />
                <p>No visits yet. Create your first visit!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-3 font-medium text-gray-500">Visitor</th>
                      <th className="pb-3 font-medium text-gray-500">Company</th>
                      <th className="pb-3 font-medium text-gray-500">Purpose</th>
                      <th className="pb-3 font-medium text-gray-500">Type</th>
                      <th className="pb-3 font-medium text-gray-500">Status</th>
                      <th className="pb-3 font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visits.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{v.visitor_name}</td>
                        <td className="py-3 text-gray-500">{v.company || '—'}</td>
                        <td className="py-3 text-gray-500 max-w-32 truncate">{v.purpose}</td>
                        <td className="py-3"><StatusBadge status={v.visit_type} /></td>
                        <td className="py-3"><StatusBadge status={v.status} /></td>
                        <td className="py-3 text-gray-500">
                          {format(new Date(v.created_at), 'dd MMM, hh:mm a')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
