import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Sidebar() {
  const router = useRouter()

  const navItems = [
    { name: 'Overview', path: '/dashboard' },
    { name: 'Leads', path: '/leads' },
    { name: 'Call Logs', path: '/call-logs' }
  ]

  return (
    <aside style={{
      width: 220,
      height: '100vh',
      background: '#1f2937',
      color: '#fff',
      padding: 20,
      position: 'fixed'
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 30 }}>
        FrameTech
      </h2>
      <nav>
        {navItems.map(item => (
          <Link href={item.path} key={item.name} legacyBehavior>
            <a
              style={{
                display: 'block',
                padding: '10px 15px',
                marginBottom: 10,
                borderRadius: 6,
                background: router.pathname === item.path ? '#374151' : 'transparent',
                color: '#fff',
                textDecoration: 'none'
              }}
            >
              {item.name}
            </a>
          </Link>
        ))}
      </nav>
    </aside>
  )
}
