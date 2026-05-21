import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, Bot, BarChart3, Plus, RefreshCw, CheckCircle,
  XCircle, Edit2, Trash2, Globe, Phone, Mail, Shield, Activity,
  TrendingUp, Eye, Layers,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'text-primary-600', bg = 'bg-primary-50' }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ── Create Org Modal ───────────────────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', slug: '', domain: '', email: '', phone: '', address: '',
    plan: 'standard', maxEmployees: 100,
    adminName: '', adminEmail: '', adminPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/platform/organizations', form);
      toast.success(`Organization "${data.organization.name}" created`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 size={20} className="text-primary-600" /> New Organization
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><XCircle size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Organization Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input value={form.name} onChange={set('name')} required className={inputCls} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Slug * (URL-friendly)</label>
                <input value={form.slug} onChange={set('slug')} required className={inputCls} placeholder="acme-corp" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Domain</label>
                <input value={form.domain} onChange={set('domain')} className={inputCls} placeholder="acme.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={set('email')} className={inputCls} placeholder="admin@acme.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input value={form.phone} onChange={set('phone')} className={inputCls} placeholder="+91 ..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
                <select value={form.plan} onChange={set('plan')} className={inputCls}>
                  <option value="standard">Standard</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input value={form.address} onChange={set('address')} className={inputCls} placeholder="Office address" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Employees</label>
                <input type="number" value={form.maxEmployees} onChange={set('maxEmployees')} className={inputCls} min={1} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Org Super Admin Account</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Admin Name</label>
                <input value={form.adminName} onChange={set('adminName')} className={inputCls} placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Admin Email *</label>
                <input type="email" value={form.adminEmail} onChange={set('adminEmail')} required className={inputCls} placeholder="john@acme.com" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Admin Password *</label>
                <input type="password" value={form.adminPassword} onChange={set('adminPassword')} required minLength={8} className={inputCls} placeholder="Min 8 characters" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Creating…' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Org Row ────────────────────────────────────────────────────────────────
function OrgRow({ org, onToggle }) {
  const planBadge = {
    enterprise: 'bg-purple-100 text-purple-700',
    professional: 'bg-blue-100 text-blue-700',
    standard: 'bg-gray-100 text-gray-600',
  }[org.plan] || 'bg-gray-100 text-gray-600';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {org.name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{org.name}</p>
            <p className="text-xs text-gray-400">{org.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{org.email || '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${planBadge}`}>
          {org.plan}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 font-medium">{org.active_employees ?? 0}</td>
      <td className="px-4 py-3 text-sm text-gray-700 font-medium">{org.visits_last_30d ?? 0}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          org.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        }`}>
          {org.is_active ? <CheckCircle size={10} /> : <XCircle size={10} />}
          {org.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(org)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            org.is_active
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {org.is_active ? 'Deactivate' : 'Reactivate'}
        </button>
      </td>
    </tr>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function PlatformDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, orgsRes] = await Promise.all([
        api.get('/platform/analytics'),
        api.get('/platform/organizations'),
      ]);
      setAnalytics(analyticsRes.data);
      setOrgs(orgsRes.data.organizations || []);
    } catch {
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleOrg = async (org) => {
    try {
      await api.put(`/platform/organizations/${org.id}`, { isActive: !org.is_active });
      toast.success(`Organization ${org.is_active ? 'deactivated' : 'reactivated'}`);
      fetchData();
    } catch { toast.error('Failed to update organization'); }
  };

  const filtered = orgs.filter((o) =>
    !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-dark shadow-lg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
            <Layers size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Platform Admin</h1>
            <p className="text-gray-400 text-xs">Temi VMS · Global Management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white text-sm font-medium">{user?.name}</p>
            <p className="text-gray-400 text-xs flex items-center gap-1 justify-end">
              <Shield size={10} /> Platform Super Admin
            </p>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-gray-400 hover:text-white text-xs px-3 py-1.5 border border-white/10 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="Total Organizations"
            value={analytics?.organizations?.total} color="text-primary-600" bg="bg-primary-50" />
          <StatCard icon={Activity} label="Active Organizations"
            value={analytics?.organizations?.active} color="text-green-600" bg="bg-green-50" />
          <StatCard icon={Users} label="Total Users"
            value={analytics?.totalUsers} color="text-blue-600" bg="bg-blue-50" />
          <StatCard icon={Bot} label="Temi Robots"
            value={analytics?.totalRobots} color="text-purple-600" bg="bg-purple-50" />
        </div>

        {/* Today's activity per org */}
        {analytics?.recentActivity?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-600" /> Today's Visits by Organization
            </h3>
            <div className="flex flex-wrap gap-2">
              {analytics.recentActivity.map((row) => (
                <div key={row.org_name}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">{row.org_name}</span>
                  <span className="text-xs bg-primary-100 text-primary-700 font-bold px-2 py-0.5 rounded-full">
                    {row.visits_today}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizations Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 size={18} className="text-primary-600" /> Organizations
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{orgs.length}</span>
            </h2>
            <div className="flex items-center gap-3">
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary-500 w-44"
                placeholder="Search orgs…"
              />
              <button onClick={fetchData} className="btn-secondary flex items-center gap-1.5 text-sm">
                <RefreshCw size={14} /> Refresh
              </button>
              <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <Plus size={14} /> New Org
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Organization', 'Email', 'Plan', 'Employees', 'Visits (30d)', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      {search ? 'No organizations match your search' : 'No organizations yet — create one above'}
                    </td>
                  </tr>
                ) : filtered.map((org) => (
                  <OrgRow key={org.id} org={org} onToggle={toggleOrg} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Platform Credentials */}
        <div className="card border border-amber-200 bg-amber-50">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Shield size={16} /> Platform Credentials
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-amber-700 w-32 font-medium">Platform Admin</span>
              <code className="bg-white border border-amber-200 px-3 py-1 rounded text-gray-800 font-mono text-xs">platform@vms.com</code>
              <code className="bg-white border border-amber-200 px-3 py-1 rounded text-gray-800 font-mono text-xs">Platform@2024</code>
            </div>
          </div>
        </div>
      </main>

      {showCreate && (
        <CreateOrgModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
