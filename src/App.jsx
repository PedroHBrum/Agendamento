import { useState, useEffect } from 'react'
import './index.css'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'
import MyAppointmentsPage from './pages/MyAppointmentsPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

const SALON_NAME = process.env.REACT_APP_SALON_NAME || 'Meu Salão'

function Shell() {
  const { client, loading } = useAuth()
  const [tab, setTab] = useState('home')
  const [branding, setBranding] = useState({})
  const [newAppts, setNewAppts] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminEntry, setShowAdminEntry] = useState(false)
  const [adminPwdInput, setAdminPwdInput] = useState('')
  const [adminPwdError, setAdminPwdError] = useState('')

  useEffect(() => {
    supabase.from('salon_settings').select('key,value')
      .in('key',['primary_color','secondary_color','accent_color','logo_url'])
      .then(({data}) => {
        if (data) {
          const b = Object.fromEntries(data.map(r=>[r.key,r.value]))
          setBranding(b)
          if (b.primary_color) {
            document.documentElement.style.setProperty('--primary-900', b.primary_color)
            document.documentElement.style.setProperty('--primary-800', b.secondary_color||b.primary_color)
          }
        }
      })
  }, [])

  useEffect(() => {
    if (!client || !isAdmin) return
    const today = new Date().toISOString().slice(0,10)
    const fetchCount = () => supabase.from('appointments')
      .select('id', {count:'exact', head:true})
      .eq('date', today).eq('status','confirmed')
      .then(({count}) => setNewAppts(count||0))
    fetchCount()
    const interval = setInterval(fetchCount, 120000)
    return () => clearInterval(interval)
  }, [client, isAdmin])

  async function handleAdminLogin() {
    setAdminPwdError('')
    const { data } = await supabase.from('salon_settings')
      .select('value').eq('key','admin_password_hash').single()
    const correct = data?.value || 'salon2024'
    if (adminPwdInput === correct) {
      setIsAdmin(true)
      setShowAdminEntry(false)
      setAdminPwdInput('')
      setTab('admin')
    } else {
      setAdminPwdError('Senha incorreta')
    }
  }

  if (loading) return (
    <div className="loading" style={{minHeight:'100vh',justifyContent:'center',flexDirection:'column',gap:12}}>
      <i className="ti ti-scissors" style={{fontSize:32,color:'var(--primary-800)'}} aria-hidden="true"/>
      <span style={{fontSize:14,color:'var(--gray-500)'}}>Carregando...</span>
    </div>
  )

  if (!client) return <LoginPage onLogin={()=>setTab('home')} salonName={SALON_NAME}/>

  const topbarTitle = {
    booking: 'Novo agendamento',
    appointments: 'Meus horários',
    profile: 'Perfil',
  }

  return (
    <div className="app-wrapper">

      {/* Topbar — home não tem (ela tem hero próprio), admin tem próprio */}
      {tab !== 'home' && tab !== 'admin' && (
        <div className="app-topbar">
          <div className="app-topbar-row">
            <div>
              <h1>✂️ {SALON_NAME}</h1>
              <p>{topbarTitle[tab]||''}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'admin' && (
        <div className="app-topbar">
          <div className="app-topbar-row">
            <div>
              <h1>🔐 Painel Admin</h1>
              <p>{SALON_NAME}</p>
            </div>
            {newAppts > 0 && (
              <div style={{background:'var(--warning-200)',borderRadius:99,padding:'4px 10px',fontSize:12,fontWeight:500,color:'var(--warning-800)'}}>
                {newAppts} hoje
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
        {tab==='home'         && <HomePage onBook={()=>setTab('booking')} salonName={SALON_NAME} branding={branding}/>}
        {tab==='booking'      && <BookingPage onDone={()=>setTab('appointments')}/>}
        {tab==='appointments' && <MyAppointmentsPage/>}
        {tab==='profile'      && <ProfilePage/>}
        {tab==='admin'        && isAdmin && <AdminPage onLogout={()=>{setIsAdmin(false);setTab('home')}}/>}
      </div>

      {/* Bottom Nav — Admin oculto, aparece só após login */}
      <nav className="bottom-nav">
        {[
          ['home',         'ti-home-2',       'Início'],
          ['booking',      'ti-calendar-plus','Agendar'],
          ['appointments', 'ti-clock',        'Horários'],
          ['profile',      'ti-user',         'Perfil'],
        ].map(([key, icon, label]) => (
          <button key={key} className={`nav-item${tab===key?' active':''}`} onClick={()=>setTab(key)}>
            <i className={`ti ${icon}`} aria-hidden="true"/>
            {label}
          </button>
        ))}

        {/* Botão admin — sempre visível mas pede senha */}
        <button className={`nav-item${tab==='admin'?' active':''}`}
          onClick={()=> isAdmin ? setTab('admin') : setShowAdminEntry(true)}>
          <div style={{position:'relative',display:'inline-flex'}}>
            <i className="ti ti-lock" aria-hidden="true"/>
            {isAdmin && newAppts > 0 && (
              <div style={{position:'absolute',top:-4,right:-6,width:16,height:16,borderRadius:'50%',background:'var(--danger-600)',color:'#fff',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {newAppts > 9 ? '9+' : newAppts}
              </div>
            )}
          </div>
          Admin
        </button>
      </nav>

      {/* Modal de senha admin */}
      {showAdminEntry && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',zIndex:200}}
          onClick={()=>{setShowAdminEntry(false);setAdminPwdInput('');setAdminPwdError('')}}>
          <div style={{background:'#fff',borderRadius:'16px 16px 0 0',padding:'1.5rem',width:'100%',maxWidth:480,margin:'0 auto'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{fontSize:36,marginBottom:8}}>🔐</div>
              <h3 style={{fontSize:16,fontWeight:500}}>Acesso administrativo</h3>
              <p style={{fontSize:13,color:'var(--gray-500)',marginTop:4}}>Exclusivo para funcionários do salão</p>
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" placeholder="Digite a senha"
                value={adminPwdInput} onChange={e=>setAdminPwdInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleAdminLogin()} autoFocus/>
            </div>
            {adminPwdError && <p style={{color:'var(--danger-600)',fontSize:13,marginBottom:12}}>{adminPwdError}</p>}
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-outline" style={{flex:1}}
                onClick={()=>{setShowAdminEntry(false);setAdminPwdInput('');setAdminPwdError('')}}>
                Cancelar
              </button>
              <button className="btn btn-primary" style={{flex:1}} onClick={handleAdminLogin} disabled={!adminPwdInput}>
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return <AuthProvider><Shell/></AuthProvider>
}
