import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Clock, CheckCircle, BarChart2, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, subDays } from 'date-fns';
import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const from = subDays(new Date(), range).toISOString();
        const { data } = await api.get(`/admin/analytics?from=${from}`);
        setAnalytics(data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchAnalytics();
  }, [range]);

  if (loading) return (
    <div className="flex h-screen"><Sidebar />
      <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
    </div>
  );

  const statusData = analytics?.byStatus?.map((s) => ({
    name: s.status?.replace(/_/g, ' '),
    value: parseInt(s.count),
  })) || [];

  const typeData = analytics?.byType?.map((t) => ({
    name: t.visit_type === 'pre_planned' ? 'Pre-Planned' : 'Walk-In',
    value: parseInt(t.count),
  })) || [];

  const checkedIn = analytics?.byStatus?.find((s) => s.status === 'checked_in');
  const completed = analytics?.byStatus?.find((s) => s.status === 'completed');

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Admin Overview</h1>
            <p className="text-sm text-gray-500">System analytics and insights</p>
          </div>
          <select value={range} onChange={(e) => setRange(parseInt(e.target.value))}
            className="input w-36 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Visits" value={analytics?.totalVisits || 0} icon={Users} color="bg-primary-600" />
            <StatCard label="Checked In" value={parseInt(checkedIn?.count || 0)} icon={CheckCircle} color="bg-green-500" />
            <StatCard label="Completed" value={parseInt(completed?.count || 0)} icon={TrendingUp} color="bg-blue-500" />
            <StatCard label="Peak Hour" value={analytics?.peakHours?.[0] ? `${analytics.peakHours[0].hour}:00` : '—'}
              icon={Clock} color="bg-purple-500" sub="Most visits" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-6">
            {/* Daily trend */}
            <div className="card col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-primary-600" /> Daily Visit Trend
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.dailyTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }}
                    tickFormatter={(d) => format(new Date(d), 'dd MMM')} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Visit type split */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-primary-600" /> Visit Types
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {typeData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak hours + Top employees */}
          <div className="grid grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Peak Arrival Hours</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analytics?.peakHours || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v, 'Visitors']} labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Top Hosts</h3>
              <div className="space-y-3">
                {(analytics?.topEmployees || []).slice(0, 6).map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-bold">{i + 1}</div>
                      <span className="text-sm text-gray-700">{e.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-primary-200" style={{ width: `${Math.max(40, (e.visit_count / (analytics.topEmployees[0]?.visit_count || 1)) * 80)}px` }}>
                        <div className="h-full bg-primary-600 rounded-full" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-6 text-right">{e.visit_count}</span>
                    </div>
                  </div>
                ))}
                {!analytics?.topEmployees?.length && <p className="text-sm text-gray-400">No data yet</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
