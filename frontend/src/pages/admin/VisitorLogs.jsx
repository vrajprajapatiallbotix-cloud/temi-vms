import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import Sidebar from '../../components/common/Sidebar';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';

export default function VisitorLogs() {
  const [visits, setVisits] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', type: '', search: '' });

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50, ...filters });
      const { data } = await api.get(`/admin/visits?${params}`);
      setVisits(data.visits);
      setTotal(data.total);
    } catch {}
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const exportCSV = () => {
    const headers = ['Visitor', 'Company', 'Host', 'Purpose', 'Type', 'Status', 'Check-in', 'Check-out', 'Date'];
    const rows = visits.map((v) => [
      v.visitor_name, v.company || '', v.employee_name, v.purpose,
      v.visit_type, v.status,
      v.checked_in_at ? format(new Date(v.checked_in_at), 'dd/MM/yyyy HH:mm') : '',
      v.checked_out_at ? format(new Date(v.checked_out_at), 'dd/MM/yyyy HH:mm') : '',
      format(new Date(v.created_at), 'dd/MM/yyyy'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'visitor-logs.csv'; a.click();
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Visitor Logs</h1>
            <p className="text-sm text-gray-500">{total} total records</p>
          </div>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="card mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter size={16} className="text-gray-400" />
              <select value={filters.status} onChange={setFilter('status')} className="input w-36 text-sm">
                <option value="">All Status</option>
                {['pending','approved','declined','checked_in','completed','expired'].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select value={filters.type} onChange={setFilter('type')} className="input w-36 text-sm">
                <option value="">All Types</option>
                <option value="pre_planned">Pre-Planned</option>
                <option value="impromptu">Walk-In</option>
              </select>
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Search..." className="input pl-8 text-sm"
                  value={filters.search} onChange={setFilter('search')} />
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            {loading ? <LoadingSpinner className="py-8" /> : (
              <>
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="border-b text-left">
                      {['Visitor', 'Company', 'Host', 'Purpose', 'Type', 'Status', 'Check-in', 'Date'].map((h) => (
                        <th key={h} className="pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visits.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900 whitespace-nowrap">{v.visitor_name}</td>
                        <td className="py-3 pr-4 text-gray-500">{v.company || '—'}</td>
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{v.employee_name}</td>
                        <td className="py-3 pr-4 text-gray-500 max-w-32 truncate">{v.purpose}</td>
                        <td className="py-3 pr-4"><StatusBadge status={v.visit_type} /></td>
                        <td className="py-3 pr-4"><StatusBadge status={v.status} /></td>
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {v.checked_in_at ? format(new Date(v.checked_in_at), 'dd MMM, HH:mm') : '—'}
                        </td>
                        <td className="py-3 text-gray-400 whitespace-nowrap">
                          {format(new Date(v.created_at), 'dd MMM yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visits.length === 0 && (
                  <div className="text-center py-12 text-gray-400">No records found</div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary text-sm px-3 py-1">Prev</button>
                      <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary text-sm px-3 py-1">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
