import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabaseClient'

export default function LeadsPage() {
  const [leads, setLeads] = useState([])

  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase.from('leads').select('*')
      setLeads(data || [])
    }
    fetchLeads()
  }, [])

  const safe = (v) => (v && v !== '' ? v : 'N/A')
  const hotLeads = leads.filter(l => l.lead_warmth === 'hot')
  const warmLeads = leads.filter(l => l.lead_warmth === 'warm')
  const coldLeads = leads.filter(l => l.lead_warmth === 'cold')

  const LeadsTable = ({ title, color, list }) => (
    <div style={{ marginBottom: 30, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: 22, margin: '0 0 10px', color: '#000' }}>{title}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#000' }}>
        <thead style={{ background: color }}>
          <tr>
            <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Name</th>
            <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Phone</th>
            <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Email</th>
            <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Reason</th>
            <th style={{ border: '1px solid #d1d5db', padding: 8 }}>Appointment</th>
          </tr>
        </thead>
        <tbody>
          {list.length > 0 ? (
            list.slice(-10).reverse().map(lead => (
              <tr key={lead.id}>
                <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.name)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.phone_number)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.email)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.reason_for_call)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: 8 }}>{safe(lead.appointment_details)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: 10 }}>No {title.toLowerCase()}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, padding: 20, width: '100%', minHeight: '100vh', backgroundColor: '#e0f2fe' }}>
        <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#000' }}>Leads</h1>
        <LeadsTable title="🔥 Hot Leads" color="#fecaca" list={hotLeads} />
        <LeadsTable title="🌤️ Warm Leads" color="#fde68a" list={warmLeads} />
        <LeadsTable title="❄️ Cold Leads" color="#bfdbfe" list={coldLeads} />
      </main>
    </div>
  )
}
