import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import SalonGallery from '../components/SalonGallery'

const CAT_ICONS = { 'Cabelo':'✂️','Depilação':'🪮','Estética':'✨','Unhas':'💅','Massagem':'💆','Sobrancelha':'🤨','Outra':'⭐' }
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const AV = { purple:'av-purple', pink:'av-pink', teal:'av-teal', amber:'av-amber', blue:'av-blue' }

export default function HomePage({ onBook, salonName, branding }) {
  const { client } = useAuth()
  const [services, setServices] = useState([])
  const [professionals, setProfessionals] = useState([])
  const [gallery, setGallery] = useState([])
  const [nextAppt, setNextAppt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Todos')

  useEffect(() => {
    Promise.all([
      supabase.from('services').select('*').eq('active',true).order('category').order('name'),
      supabase.from('professionals').select('*').eq('active',true).order('name'),
      supabase.from('appointments')
        .select('*, services(name), professionals(name)')
        .eq('client_id', client.id).eq('status','confirmed')
        .gte('date', new Date().toISOString().slice(0,10))
        .order('date').order('time').limit(1),
      supabase.from('salon_gallery').select('*').eq('active',true).order('order_index').order('created_at'),
    ]).then(([sv,pr,ap,gal]) => {
      setServices(sv.data||[])
      setProfessionals(pr.data||[])
      setNextAppt(ap.data?.[0]||null)
      setGallery(gal.data||[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const bg     = branding?.primary_color   || '#042C53'
  const accent = branding?.accent_color    || '#B5D4F4'
  const logo   = branding?.logo_url        || ''
  const categories = ['Todos', ...new Set(services.map(s => s.category))]
  const filtered = activeCategory==='Todos' ? services : services.filter(s => s.category===activeCategory)

  const greeting = () => { const h=new Date().getHours(); return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite' }

  return (
    <div style={{ flex:1, overflowY:'auto', paddingBottom:'5rem' }}>

      {/* Hero */}
      <div style={{ background:bg, padding:'18px 20px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          {logo
            ? <img src={logo} alt={salonName} onError={e=>e.target.style.display='none'}
                style={{ width:42, height:42, borderRadius:10, objectFit:'cover', border:`0.5px solid ${accent}30`, flexShrink:0 }}/>
            : <div style={{ width:42, height:42, borderRadius:10, background:`${accent}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className="ti ti-scissors" aria-hidden="true" style={{ fontSize:20, color:accent }}/>
              </div>
          }
          <div>
            <p style={{ fontSize:12, color:`${accent}70` }}>{greeting()},</p>
            <p style={{ fontSize:16, fontWeight:500, color:accent }}>{client?.name?.split(' ')[0]||'cliente'}!</p>
          </div>
        </div>

        {nextAppt && (
          <div style={{ background:`${accent}15`, borderRadius:12, padding:'12px 14px', border:`0.5px solid ${accent}30`, marginBottom:12 }}>
            <p style={{ fontSize:11, color:`${accent}80`, fontWeight:500, marginBottom:4 }}>📅 PRÓXIMO AGENDAMENTO</p>
            <p style={{ fontSize:14, fontWeight:500, color:accent }}>{nextAppt.services?.name}</p>
            <p style={{ fontSize:12, color:`${accent}90`, marginTop:2 }}>
              {nextAppt.professionals?.name} · {(() => { const d=new Date(nextAppt.date+'T12:00:00'); return `${d.getDate()} de ${MONTHS[d.getMonth()]} às ${nextAppt.time?.slice(0,5)}` })()}
            </p>
          </div>
        )}

        <button onClick={onBook}
          style={{ width:'100%', padding:'13px', background:accent, border:'none', borderRadius:10, color:bg, fontSize:14, fontWeight:500, display:'flex', alignItems:'center', justifyContent:'center', gap:8, cursor:'pointer', fontFamily:'inherit' }}>
          <i className="ti ti-calendar-plus" aria-hidden="true" style={{ fontSize:18 }}/>
          {nextAppt ? 'Fazer novo agendamento' : 'Agendar agora'}
        </button>
      </div>

      {/* Galeria */}
      {gallery.length > 0 && <SalonGallery photos={gallery}/>}

      <div style={{ padding:'0 1.25rem' }}>

        {/* Equipe */}
        {professionals.length > 0 && <>
          <p style={{ fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--gray-500)', margin:'1.25rem 0 0.75rem' }}>Nossa equipe</p>
          <div style={{ display:'flex', gap:14, overflowX:'auto', paddingBottom:8, scrollbarWidth:'none' }}>
            {professionals.map(p => (
              <div key={p.id} style={{ flexShrink:0, textAlign:'center', cursor:'pointer', minWidth:64 }} onClick={onBook}>
                {p.photo_url
                  ? <img src={p.photo_url} alt={p.name} onError={e=>e.target.style.display='none'}
                      style={{ width:60, height:60, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--gray-100)', display:'block', margin:'0 auto 6px' }}/>
                  : <div style={{ width:60, height:60, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:500, fontSize:16, margin:'0 auto 6px', border:'2px solid var(--gray-100)' }}
                      className={AV[p.color]||'av-blue'}>{p.initials}</div>
                }
                <p style={{ fontSize:12, fontWeight:500, color:'var(--gray-700)' }}>{p.name.split(' ')[0]}</p>
                <p style={{ fontSize:10, color:'var(--gray-500)', marginTop:1 }}>{p.role}</p>
              </div>
            ))}
          </div>
        </>}

        {/* Serviços */}
        <p style={{ fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--gray-500)', margin:'1.25rem 0 0.75rem' }}>Nossos serviços</p>

        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:10, marginBottom:4, scrollbarWidth:'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ flexShrink:0, padding:'6px 14px', borderRadius:99, border:'0.5px solid',
                borderColor: activeCategory===cat ? bg : 'var(--gray-100)',
                background: activeCategory===cat ? bg : '#fff',
                color: activeCategory===cat ? accent : 'var(--gray-500)',
                fontSize:12, fontWeight: activeCategory===cat?500:400,
                cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
              {cat==='Todos' ? 'Todos' : `${CAT_ICONS[cat]||'⭐'} ${cat}`}
            </button>
          ))}
        </div>

        {loading && <div className="loading">Carregando...</div>}

        {!loading && filtered.map(s => (
          <div key={s.id} onClick={onBook}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:'0.5px solid var(--gray-100)', borderRadius:12, marginBottom:8, cursor:'pointer', background:'#fff', transition:'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='var(--gray-300)'}
            onMouseLeave={e => e.currentTarget.style.borderColor='var(--gray-100)'}>
            <div style={{ width:40, height:40, borderRadius:10, background:'var(--gray-50)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
              {CAT_ICONS[s.category]||'⭐'}
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)' }}>{s.name}</p>
              <p style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>{s.duration_min} min</p>
            </div>
            <p style={{ fontSize:14, fontWeight:500, color:'var(--gray-700)', flexShrink:0 }}>R$ {Number(s.price).toFixed(0)}</p>
            <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize:16, color:'var(--gray-300)' }}/>
          </div>
        ))}

        {!loading && filtered.length===0 && (
          <div className="empty">Nenhum serviço nesta categoria.</div>
        )}
      </div>
    </div>
  )
}
