import { useState, useEffect } from 'react'
import './index.css'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import BookingPage from './pages/BookingPage'
import MyAppointmentsPage from './pages/MyAppointmentsPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

const SALON_NAME = process.env.REACT_APP_SALON_NAME || 'Meu Salão'

function Shell() {
  const { client, loading } = useAuth()
  const [tab, setTab] = useState('booking')
  const [branding, setBranding] = useState({})

  useEffect(() => {
    import('./lib/supabase').then(({supabase}) => {
      supabase.from('salon_settings').select('key,value')
        .in('key',['primary_color','secondary_color','accent_color','logo_url'])
        .then(({data}) => {
          if(data) {
            const b = Object.fromEntries(data.map(r=>[r.key,r.value]))
            setBranding(b)
            if(b.primary_color) {
              document.documentElement.style.setProperty('--primary-900', b.primary_color)
              document.documentElement.style.setProperty('--primary-800', b.secondary_color||b.primary_color)
            }
          }
        })
    })
  }, [])

  if (loading) return (
    <div className="loading" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <i className="ti ti-scissors" style={{ fontSize: 24, color: 'var(--primary-800)' }} aria-hidden="true" />
      Carregando...
    </div>
  )

  if (!client) return <LoginPage onLogin={() => setTab('booking')} salonName={SALON_NAME} />

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }
  const firstName = client.name?.split(' ')[0] || 'cliente'

  return (
    <div className="app-wrapper">
      {tab !== 'admin' && (
        <div className="app-topbar">
          <div className="app-topbar-row">
            <div>
              <h1>✂️ {SALON_NAME}</h1>
              <p>{greeting()}, {firstName}!</p>
            </div>
            {tab === 'booking' && (
              <i className="ti ti-scissors" aria-hidden="true" style={{ fontSize: 22, color: 'var(--primary-200)' }} />
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'booking'      && <BookingPage onDone={() => setTab('appointments')} />}
        {tab === 'appointments' && <MyAppointmentsPage />}
        {tab === 'profile'      && <ProfilePage />}
        {tab === 'admin'        && <AdminPage />}
      </div>

      <nav className="bottom-nav">
        {[
          ['booking',      'ti-calendar-plus', 'Agendar'],
          ['appointments', 'ti-clock',         'Meus horários'],
          ['profile',      'ti-user',          'Perfil'],
          ['admin',        'ti-lock',          'Admin'],
        ].map(([key, icon, label]) => (
          <button key={key} className={`nav-item${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            <i className={`ti ${icon}`} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>
}
