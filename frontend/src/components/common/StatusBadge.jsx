import React from 'react';

const CONFIG = {
  pending:    { label: 'Pending',    classes: 'bg-yellow-100 text-yellow-800' },
  approved:   { label: 'Approved',   classes: 'bg-green-100 text-green-800' },
  declined:   { label: 'Declined',   classes: 'bg-red-100 text-red-800' },
  checked_in: { label: 'Checked In', classes: 'bg-blue-100 text-blue-800' },
  completed:  { label: 'Completed',  classes: 'bg-gray-100 text-gray-700' },
  expired:    { label: 'Expired',    classes: 'bg-gray-100 text-gray-400' },
  pre_planned:{ label: 'Pre-Planned',classes: 'bg-indigo-100 text-indigo-800' },
  impromptu:  { label: 'Walk-In',    classes: 'bg-orange-100 text-orange-800' },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || { label: status, classes: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`badge ${cfg.classes}`}>{cfg.label}</span>
  );
}
