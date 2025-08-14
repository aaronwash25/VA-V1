import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabaseClient'

export default function CallLogsPage() {
  const [leads, setLeads] = useState([])

  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase.from('leads').select('*')
      setLeads(data || [])
    }
    fetchLeads()
  }, [])

  const safe = (v) => (v && v !== '' ? v : 'N/A')

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, padding: 20, width: '100%', minHeight: '100vh', backgroundColor: '#e0f2fe' }}>
        <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#000' }}>Call Logs</h1>

        <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#000' }}>
            <thead style={{ background: '#e5e7eb' }}>
              <tr>
                <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Caller Name</th>
                <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Phone</th>
                <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Date/Time</th>
                <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Lead Warmth</th>
                <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Appointment?</th>
                <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(-20).reverse().map(lead => (
                <tr key={lead.id}>
                  <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.name)}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.phone_number)}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: 8 }}>
                    {lead.timestamp ? new Date(lead.timestamp).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.lead_warmth)}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: 8 }}>
                    {lead.appointment_details ? '✅' : '❌'}
                  </td>
                  <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.summary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
