import React from 'react';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

export default function QRDisplay({ qrImage, expiresAt, visitorName }) {
  if (!qrImage) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `vms-qr-${visitorName?.replace(/\s+/g, '-') || 'code'}.png`;
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">QR Code</h3>
        {visitorName && <p className="text-sm text-gray-500">for {visitorName}</p>}
      </div>

      <img
        src={qrImage}
        alt="Visit QR Code"
        className="w-48 h-48 border-4 border-primary-600 rounded-xl"
      />

      {expiresAt && (
        <p className="text-xs text-gray-500 text-center">
          Valid until{' '}
          <span className="font-medium text-gray-700">
            {format(new Date(expiresAt), 'dd MMM yyyy, hh:mm a')}
          </span>
        </p>
      )}

      <button
        onClick={handleDownload}
        className="flex items-center gap-2 btn-secondary text-sm"
      >
        <Download size={14} />
        Download QR
      </button>
    </div>
  );
}
