import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, XCircle } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function KioskQRScanner({ onValidated, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | scanning | validating | done
  const [error, setError] = useState(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (code?.data) {
      handleToken(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, []); // eslint-disable-line

  const handleToken = async (token) => {
    setStatus('validating');
    stopCamera();
    try {
      const { data } = await api.post('/qr/validate', { token },
        { headers: { 'x-temi-api-key': import.meta.env.VITE_TEMI_API_KEY || 'temi_internal_api_key' } }
      );
      setStatus('done');
      onValidated(data);
    } catch (err) {
      const code = err.response?.data?.code || 'QR_INVALID';
      const msg = err.response?.data?.error || 'Invalid QR code';
      setError({ code, msg });
      setStatus('error');
    }
  };

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setStatus('scanning');
          rafRef.current = requestAnimationFrame(scanFrame);
        }
      })
      .catch(() => {
        setStatus('error');
        setError({ code: 'CAMERA', msg: 'Camera access denied. Please allow camera permissions.' });
      });
    return () => { mounted = false; stopCamera(); };
  }, [scanFrame, stopCamera]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-dark rounded-2xl overflow-hidden w-full max-w-md relative">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-primary-600">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Camera size={18} /> Scan Your QR Code
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-white/70 hover:text-white">
            <XCircle size={22} />
          </button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan frame overlay */}
          {status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-52 h-52 border-4 border-primary-400 rounded-xl relative">
                {/* Corner accents */}
                {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                  <div key={i} className={`absolute w-5 h-5 border-primary-400 ${pos} ${i < 2 ? 'border-t-4' : 'border-b-4'} ${i % 2 === 0 ? 'border-l-4' : 'border-r-4'}`} />
                ))}
                {/* Scan line animation */}
                <div className="absolute inset-x-0 h-0.5 bg-primary-400/80 animate-bounce top-1/2" />
              </div>
            </div>
          )}

          {/* Status overlays */}
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-white text-center">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm">Starting camera...</p>
              </div>
            </div>
          )}
          {status === 'validating' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-white text-center">
                <div className="w-8 h-8 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium">Validating QR code...</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom status bar */}
        <div className="px-5 py-4">
          {status === 'scanning' && (
            <p className="text-center text-gray-300 text-sm">Hold your QR code steady in the frame</p>
          )}
          {status === 'error' && error && (
            <div className="text-center">
              <p className="text-red-400 font-medium text-sm">{error.msg}</p>
              {error.code !== 'CAMERA' && (
                <button onClick={() => { setError(null); setStatus('scanning'); rafRef.current = requestAnimationFrame(scanFrame); }}
                  className="mt-3 btn-primary text-sm">Try Again</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
