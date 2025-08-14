import React, { useState, useEffect, useMemo } from 'react';
import { Phone, Users, Calendar, TrendingUp, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const isFilled = (v) => !!(v && v.trim() && v.trim().toLowerCase() !== 'optional')
const titleCase = (s) => {
  if (!s) return ''
  const t = s.trim().toLowerCase()
  if (t === 'optional') return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const DashboardContent = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) throw error
        setRows(data || [])

        const { count: total } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
        setTotalCount(total || 0)

        const since = new Date()
        since.setDate(since.getDate() - 7)
        const { count: new7 } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since.toISOString())
        setNewCount(new7 || 0)
      } catch (e) {
        setError(e?.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    load()
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => load())
      .subscribe()
    return () => channel.unsubscribe()
  }, [])

  const kpiData = useMemo(() => {
    const total = rows.length || 0
    const appointments = rows.filter(r => isFilled(r.calendar_link) || isFilled(r.appointment_details)).length
    const counts = { hot: 0, warm: 0, cold: 0 }
    rows.forEach(r => {
      const w = (r.lead_warmth || '').trim().toLowerCase()
      if (w === 'hot') counts.hot++
      else if (w === 'warm') counts.warm++
      else if (w === 'cold') counts.cold++
    })
    const toPct = (n) => total ? Math.round((n / total) * 100) : 0
    return {
      totalCalls: totalCount,
      newLeads: newCount,
      appointments,
      leadWarmth: {
        hot: toPct(counts.hot),
        warm: toPct(counts.warm),
        cold: toPct(counts.cold),
      },
    }
  }, [rows, totalCount, newCount])

  const getWarmthBadgeColor = (warmth) => {
    switch (warmth) {
      case 'Hot': return 'bg-red-100 text-red-800 border-red-200'
      case 'Warm': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Cold': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) return <div className="h-screen grid place-items-center text-gray-600">Loading dashboard…</div>
  if (error) return <div className="h-screen grid place-items-center text-red-600">{error}</div>

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-56 bg-gray-800 text-white flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">FrameTech</h1>
          <p className="text-sm text-gray-300 mt-1">AI Voice Agent</p>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button className="w-full flex items-center px-4 py-3 text-left rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors">
                <TrendingUp className="w-5 h-5 mr-3" />
                Overview
              </button>
            </li>
            <li>
              <button className="w-full flex items-center px-4 py-3 text-left rounded-lg hover:bg-gray-700 transition-colors">
                <Users className="w-5 h-5 mr-3" />
                Leads
              </button>
            </li>
            <li>
              <button className="w-full flex items-center px-4 py-3 text-left rounded-lg hover:bg-gray-700 transition-colors">
                <Phone className="w-5 h-5 mr-3" />
                Call Logs
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <div className="flex-1 bg-sky-50">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
            <p className="text-gray-600 mt-2">Monitor your lead qualification performance</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Leads</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{kpiData.totalCalls}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">New (7 days)</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{kpiData.newLeads}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Appointments Booked</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{kpiData.appointments}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Lead Warmth Distribution (Recent)</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-600 font-medium">Hot</span>
                  <span className="text-sm font-bold text-gray-900">{kpiData.leadWarmth.hot}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-yellow-600 font-medium">Warm</span>
                  <span className="text-sm font-bold text-gray-900">{kpiData.leadWarmth.warm}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-600 font-medium">Cold</span>
                  <span className="text-sm font-bold text-gray-900">{kpiData.leadWarmth.cold}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Leads</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warmth</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appt</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{titleCase(r.name) || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{r.phone_number || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 truncate max-w-[280px]">{titleCase(r.reason_for_call) || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(r.created_at).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getWarmthBadgeColor(titleCase(r.lead_warmth))}`}>
                          {titleCase(r.lead_warmth) || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {isFilled(r.calendar_link) || isFilled(r.appointment_details) ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <X className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CompleteSystem = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Simple credentials - change these to whatever you want
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'password123';

  // Check if already logged in on component mount
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
  }, []);

  const handleLogin = () => {
    setLoading(true);
    setError('');

    setTimeout(() => {
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true');
        setError('');
      } else {
        setError('Invalid username or password');
      }
      setLoading(false);
    }, 500);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setUsername('');
    setPassword('');
    setError('');
  };

  // Login Page
  if (!isLoggedIn) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c)',
        backgroundSize: '400% 400%',
        animation: 'gradientMove 15s ease infinite',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <style jsx>{`
          @keyframes gradientMove {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `}</style>
        <div style={{
          background: 'white',
          borderRadius: '15px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          padding: '40px',
          width: '100%',
          maxWidth: '400px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#333',
              marginBottom: '10px' 
            }}>
              Client Portal
            </h1>
            <p style={{ color: '#666' }}>Please sign in to continue</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500', 
              color: '#333' 
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.3s',
                color: '#000'
              }}
              placeholder="Enter username"
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500', 
              color: '#333' 
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.3s',
                color: '#000'
              }}
              placeholder="Enter password"
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <div style={{
              background: '#fee',
              color: '#c33',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !username || !password}
            style={{
              width: '100%',
              background: loading ? '#999' : '#667eea',
              color: 'white',
              border: 'none',
              padding: '15px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div style={{ 
            textAlign: 'center', 
            marginTop: '20px', 
            fontSize: '12px', 
            color: '#999' 
          }}>
            Powered by FrameTech
          </div>
        </div>
      </div>
    );
  }

  // Dashboard with Logout Button
  return (
    <div className="relative">
      {/* Logout Button - positioned over dashboard */}
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Logout
      </button>
      
      {/* Your actual dashboard */}
      <DashboardContent />
    </div>
  );
};

export default CompleteSystem;