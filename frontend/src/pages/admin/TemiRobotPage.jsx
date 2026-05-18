import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, MapPin, Wifi, WifiOff, Clock, RefreshCw, Navigation,
  Monitor, Briefcase, Users, Home, DoorOpen, TrendingUp,
  UserCheck, Zap, Coffee, Server, HelpCircle, Battery,
  CheckCircle, AlertCircle, Activity,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../api/axios';
import { io } from 'socket.io-client';
import useAuthStore from '../../store/authStore';

// Map room name keywords → lucide icon
const ROOM_ICON_MAP = [
  { keywords: ['reception', 'lobby', 'entrance', 'front'],   Icon: DoorOpen,    color: 'text-blue-500',   bg: 'bg-blue-50'   },
  { keywords: ['meeting', 'conference', 'board'],             Icon: Users,       color: 'text-purple-500', bg: 'bg-purple-50' },
  { keywords: ['director', 'ceo', 'office', 'management'],   Icon: Briefcase,   color: 'text-amber-500',  bg: 'bg-amber-50'  },
  { keywords: ['software', 'tech', 'it', 'dev', 'server'],   Icon: Monitor,     color: 'text-cyan-500',   bg: 'bg-cyan-50'   },
  { keywords: ['hr', 'human', 'people'],                     Icon: UserCheck,   color: 'text-green-500',  bg: 'bg-green-50'  },
  { keywords: ['sales'],                                     Icon: TrendingUp,  color: 'text-emerald-500',bg: 'bg-emerald-50'},
  { keywords: ['marketing', 'brand'],                        Icon: Zap,         color: 'text-pink-500',   bg: 'bg-pink-50'   },
  { keywords: ['home', 'base', 'dock', 'charge'],            Icon: Home,        color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { keywords: ['kitchen', 'pantry', 'cafe', 'canteen'],      Icon: Coffee,      color: 'text-orange-500', bg: 'bg-orange-50' },
  { keywords: ['wait', 'lounge', 'rest'],                    Icon: Clock,       color: 'text-gray-500',   bg: 'bg-gray-50'   },
  { keywords: ['nav', 'path', 'route'],                      Icon: Navigation,  color: 'text-teal-500',   bg: 'bg-teal-50'   },
];

function getRoomMeta(name) {
  const lower = name.toLowerCase();
  for (const entry of ROOM_ICON_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry;
  }
  return { Icon: MapPin, color: 'text-gray-400', bg: 'bg-gray-50' };
}

function formatRoomName(name) {
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }) {
  const online = status === 'online';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
    }`}>
      {online ? <Wifi size={11} /> : <WifiOff size={11} />}
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

function LocationCard({ name, index }) {
  const { Icon, color, bg } = getRoomMeta(name);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-all">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{formatRoomName(name)}</p>
        <p className="text-xs text-gray-400">Location {index + 1}</p>
      </div>
      <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
    </div>
  );
}

export default function TemiRobotPage() {
  const { user } = useAuthStore();
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [liveFlash, setLiveFlash] = useState(false);

  const fetchRobots = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/temi-robots');
      setRobots(data);
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchRobots();

    // Live updates from Temi
    const socket = io(import.meta.env.VITE_SOCKET_URL || '', { withCredentials: true });
    socket.emit('join', { userId: user?.id, role: user?.role });

    socket.on('temi:locations_synced', ({ serial, locations }) => {
      setLiveFlash(true);
      setTimeout(() => setLiveFlash(false), 2000);
      setRobots((prev) =>
        prev.map((r) =>
          r.serial_number === serial ? { ...r, saved_locations: locations } : r
        )
      );
    });

    return () => socket.disconnect();
  }, [fetchRobots, user]);

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
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Bot size={20} className="text-primary-600" /> Temi Robot
            </h1>
            <p className="text-sm text-gray-500">
              Live map locations &amp; robot status — refreshed {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {liveFlash && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-full animate-pulse">
                <Activity size={12} /> Live update received
              </span>
            )}
            <button
              onClick={fetchRobots}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {robots.length === 0 ? (
            <div className="card text-center py-12">
              <Bot size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No Temi robots registered yet</p>
              <p className="text-sm text-gray-400 mt-1">Start the Temi app — it will register automatically on first heartbeat.</p>
            </div>
          ) : (
            robots.map((robot) => {
              const locations = Array.isArray(robot.saved_locations)
                ? robot.saved_locations
                : (robot.saved_locations ? JSON.parse(robot.saved_locations) : []);

              const isOnline = robot.status === 'online';
              const lastSeen = robot.last_seen
                ? formatDistanceToNow(new Date(robot.last_seen), { addSuffix: true })
                : 'Never';

              return (
                <div key={robot.serial_number} className="space-y-4">

                  {/* Robot status card */}
                  <div className={`card border-l-4 ${isOnline ? 'border-l-green-500' : 'border-l-red-400'}`}>
                    <div className="flex flex-wrap items-center gap-6">
                      {/* Avatar */}
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        isOnline ? 'bg-green-50' : 'bg-gray-100'
                      }`}>
                        <Bot size={28} className={isOnline ? 'text-green-600' : 'text-gray-400'} />
                      </div>

                      {/* Identity */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-gray-900">
                            {robot.name || 'Temi Robot'}
                          </h2>
                          <StatusBadge status={robot.status} />
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Serial: <span className="font-mono text-gray-700">{robot.serial_number}</span>
                          {robot.location_name && (
                            <> &nbsp;·&nbsp; Location: <span className="font-medium text-gray-700">{robot.location_name}</span></>
                          )}
                        </p>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-6 text-sm flex-shrink-0">
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Last Seen</p>
                          <div className="flex items-center gap-1 text-gray-700 font-medium">
                            <Clock size={13} className="text-gray-400" />
                            {lastSeen}
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Current Task</p>
                          <span className="font-medium text-gray-700 capitalize">
                            {robot.current_task || 'Idle'}
                          </span>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Map Locations</p>
                          <span className="font-bold text-primary-600 text-lg">{locations.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Map locations grid */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Navigation size={16} className="text-primary-600" />
                        Saved Navigation Locations
                      </h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        {locations.length} room{locations.length !== 1 ? 's' : ''} on map
                      </span>
                    </div>

                    {locations.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No locations synced yet.</p>
                        <p className="text-xs mt-1">Launch the Temi app — locations sync automatically on startup.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {locations.map((loc, i) => (
                          <LocationCard key={loc} name={loc} index={i} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Raw location list for debugging / copy-paste */}
                  {locations.length > 0 && (
                    <div className="card bg-gray-900 text-gray-100">
                      <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                        Raw location names (exact strings Temi uses for navigation)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {locations.map((loc) => (
                          <code
                            key={loc}
                            className="text-xs bg-gray-800 text-green-400 px-2 py-1 rounded font-mono border border-gray-700"
                          >
                            {loc}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Credentials info card */}
          <div className="card border border-amber-200 bg-amber-50">
            <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertCircle size={16} /> Admin Credentials
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-amber-700 w-28 font-medium">Admin Email</span>
                <code className="bg-white border border-amber-200 px-3 py-1 rounded text-gray-800 font-mono text-xs">admin@vms.com</code>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-700 w-28 font-medium">Password</span>
                <code className="bg-white border border-amber-200 px-3 py-1 rounded text-gray-800 font-mono text-xs">Admin@123</code>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-700 w-28 font-medium">Alt Admin</span>
                <code className="bg-white border border-amber-200 px-3 py-1 rounded text-gray-800 font-mono text-xs">mayank@nanta.tech</code>
                <code className="bg-white border border-amber-200 px-3 py-1 rounded text-gray-800 font-mono text-xs">Employee@123</code>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
