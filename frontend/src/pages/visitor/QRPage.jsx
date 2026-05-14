import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRDisplay from '../../components/common/QRDisplay';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';

export default function QRPage() {
  const { visitId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQR = async () => {
      try {
        const res = await api.get(`/qr/${visitId}/image`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'QR not found');
      } finally {
        setLoading(false);
      }
    };
    fetchQR();
  }, [visitId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card max-w-sm text-center">
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <QRDisplay qrImage={data?.qrImage} expiresAt={data?.expiresAt} />
    </div>
  );
}
