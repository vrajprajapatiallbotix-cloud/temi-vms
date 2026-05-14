import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Shield, UserCheck, UserX } from 'lucide-react';
import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function EmployeeModal({ employee, onClose, onSaved }) {
  const isEdit = !!employee?.id;
  const [form, setForm] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    role: employee?.role || 'employee',
    department: employee?.department || '',
    phone: employee?.phone || '',
    deskLocation: employee?.desk_location || '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/admin/employees/${employee.id}`, form);
        toast.success('Employee updated');
      } else {
        if (!form.password) return toast.error('Password required');
        await api.post('/admin/employees', form);
        toast.success('Employee created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input value={form.name} onChange={set('name')} required className="input text-sm" placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={set('email')} required className="input text-sm" placeholder="jane@company.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select value={form.role} onChange={set('role')} className="input text-sm">
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
                <option value="security">Security</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <input value={form.department} onChange={set('department')} className="input text-sm" placeholder="Engineering" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={set('phone')} className="input text-sm" placeholder="+91 9876543210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Desk / Room</label>
              <input value={form.deskLocation} onChange={set('deskLocation')} className="input text-sm" placeholder="Desk 12, Floor 2" />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
              <input type="password" value={form.password} onChange={set('password')} required className="input text-sm" placeholder="Min 8 characters" />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm">
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/employees?search=${search}&limit=50`);
      setEmployees(data.employees);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { const t = setTimeout(fetchEmployees, 300); return () => clearTimeout(t); }, [fetchEmployees]);

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this employee?')) return;
    try {
      await api.delete(`/admin/employees/${id}`);
      toast.success('Employee deactivated');
      fetchEmployees();
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Employee Management</h1>
            <p className="text-sm text-gray-500">{total} employees</p>
          </div>
          <button onClick={() => setModal({})} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Add Employee
          </button>
        </div>

        <div className="p-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  className="input pl-8 text-sm" placeholder="Search employees..." />
              </div>
            </div>

            {loading ? <LoadingSpinner className="py-8" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      {['Name', 'Email', 'Role', 'Department', 'Desk', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="pb-3 font-medium text-gray-500 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{emp.name}</td>
                        <td className="py-3 pr-4 text-gray-500">{emp.email}</td>
                        <td className="py-3 pr-4">
                          <span className={`badge ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : emp.role === 'security' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                            <Shield size={10} className="mr-1" />
                            {emp.role}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-500">{emp.department || '—'}</td>
                        <td className="py-3 pr-4 text-gray-500">{emp.desk_location || '—'}</td>
                        <td className="py-3 pr-4">
                          {emp.is_active
                            ? <span className="flex items-center gap-1 text-green-600 text-xs"><UserCheck size={12} />Active</span>
                            : <span className="flex items-center gap-1 text-gray-400 text-xs"><UserX size={12} />Inactive</span>
                          }
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setModal(emp)} className="text-primary-600 hover:text-primary-800 p-1">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeactivate(emp.id)} className="text-red-500 hover:text-red-700 p-1">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {employees.length === 0 && (
                  <div className="text-center py-12 text-gray-400">No employees found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {modal !== null && (
        <EmployeeModal
          employee={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchEmployees(); }}
        />
      )}
    </div>
  );
}
