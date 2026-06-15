import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const DAYS_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
const statusLabel = { confirmed:'Confirmado', pending:'Pendente', cancelled:'Cancelado', done:'Concluído' }
const statusClass = { confirmed:'badge-confirmed', pending:'badge-pending', cancelled:'badge-cancelled', done:'badge-done' }
const PC = { purple:['#EEEDFE','#3C3489'], pink:['#FBEAF0','#721F3E'], teal:['#E1F5EE','#085041'], amber:['#FAEEDA','#633806'], blue:['#E6F1FB','#0C447C'] }
const CAT_ICONS = { 'Cabelo':'✂️','Depilação':'🪮','Estética':'✨','Unhas':'💅','Massagem':'💆','Sobrancelha':'🤨','Outra':'⭐' }

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pwdInput, setPwdInput] = useState('')
  const [adminPwd, setAdminPwd] = useState('salon2024')
  const [tab, setTab] = useState('today')
  const [appointments, setAppointments] = useState([])
  const [services, setServices] = useState([])
  const [professionals, setProfessionals] = useState([])
  const [clients, setClients] = useState([])
  const [profServiceMap, setProfServiceMap] = useState({})
  const [settings, setSettings] = useState({})
  const [workingHours, setWorkingHours] = useState([])
  const [stats, setStats] = useState({today:0,week:0,month:0,revenue:0,avgRating:'-',reviews:0})
  const [loading, setLoading] = useState(false)
  const [editService, setEditService] = useState(null)
  const [editProf, setEditProf] = useState(null)
  const [openProfId, setOpenProfId] = useState(null)
  const [blockModal, setBlockModal] = useState(null)
  const [calDate, setCalDate] = useState(new Date().toISOString().slice(0,10))
  const [calAppts, setCalAppts] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [manualModal, setManualModal] = useState(false)
  const [manualForm, setManualForm] = useState({clientPhone:'',clientName:'',profId:'',serviceId:'',date:'',time:'',notes:''})
  const [reportFrom, setReportFrom] = useState(new Date().toISOString().slice(0,8)+'01')
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0,10))
  const [newPwd, setNewPwd] = useState('')
  const [newPwd2, setNewPwd2] = useState('')

  function login() {
    if (pwdInput === adminPwd) setAuthed(true)
    else alert('Senha incorreta')
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0,10)
    const weekAgo = new Date(Date.now()-7*86400000).toISOString().slice(0,10)
    const monthStart = new Date().toISOString().slice(0,8)+'01'
    const [apRes,svRes,prRes,clRes,psRes,stRes,whRes] = await Promise.all([
      supabase.from('appointments').select('*,clients(name,phone),services(name,price,duration_min),professionals(name,color)').order('date',{ascending:false}).order('time',{ascending:true}),
      supabase.from('services').select('*').order('category').order('name'),
      supabase.from('professionals').select('*').order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('professional_services').select('*'),
      supabase.from('salon_settings').select('*'),
      supabase.from('working_hours').select('*').order('day_of_week'),
    ])
    const aps=apRes.data||[]
    setAppointments(aps); setServices(svRes.data||[]); setProfessionals(prRes.data||[])
    setClients(clRes.data||[]); setWorkingHours(whRes.data||[])
    const st = Object.fromEntries((stRes.data||[]).map(r=>[r.key,r.value]))
    setSettings(st)
    if (st.admin_password_hash) setAdminPwd(st.admin_password_hash)
    const psMap={}
    ;(psRes.data||[]).forEach(r=>{if(!psMap[r.professional_id])psMap[r.professional_id]={};psMap[r.professional_id][r.service_id]=r.custom_price})
    setProfServiceMap(psMap)
    const active=aps.filter(a=>a.status!=='cancelled')
    const rated=aps.filter(a=>a.rating)
    setStats({
      today:active.filter(a=>a.date===today).length,
      week:active.filter(a=>a.date>=weekAgo).length,
      month:active.filter(a=>a.date>=monthStart).length,
      revenue:active.reduce((s,a)=>s+Number(a.price_charged||a.services?.price||0),0),
      avgRating:rated.length?(rated.reduce((s,a)=>s+a.rating,0)/rated.length).toFixed(1):'-',
      reviews:rated.length,
    })
    setLoading(false)
  }, [])

  useEffect(()=>{if(authed)fetchAll()},[authed,fetchAll])
  useEffect(()=>{if(tab==='calendar')fetchCalAppts()},[calDate,tab])

  async function fetchCalAppts() {
    const {data}=await supabase.from('appointments')
      .select('*,clients(name,phone),services(name,duration_min,price),professionals(name,initials,color)')
      .eq('date',calDate).neq('status','cancelled').order('time')
    setCalAppts(data||[])
  }

  async function updateStatus(id,status) { await supabase.from('appointments').update({status}).eq('id',id); fetchAll() }

  // ── Manual booking ──────────────────────────────────────────────────────
  async function saveManualBooking() {
    const {clientPhone,clientName,profId,serviceId,date,time,notes}=manualForm
    if(!clientPhone||!serviceId||!date||!time){alert('Preencha todos os campos obrigatórios');return}
    // upsert client
    let clientId
    const {data:existing}=await supabase.from('clients').select('id').eq('phone',clientPhone.replace(/\D/g,'')).single()
    if(existing){clientId=existing.id}
    else{
      const {data:nc}=await supabase.from('clients').insert({phone:clientPhone.replace(/\D/g,''),name:clientName||'Cliente'}).select().single()
      clientId=nc.id
    }
    if(!clientId){alert('Erro ao localizar cliente');return}
    const svc=services.find(s=>s.id===serviceId)
    const prof=professionals.find(p=>p.id===profId)
    const price=(prof&&profServiceMap[prof.id]?.[serviceId])??svc?.price
    const code='AG-'+(1000+Math.floor(Math.random()*9000))
    await supabase.from('appointments').insert({
      client_id:clientId,service_id:serviceId,
      professional_id:profId||null,date,time:time+':00',
      price_charged:price,status:'confirmed',code,notes:notes||null,reminder_sent:false
    })
    setManualModal(false)
    setManualForm({clientPhone:'',clientName:'',profId:'',serviceId:'',date:'',time:'',notes:''})
    fetchAll()
  }

  // ── Services ───────────────────────────────────────────────────────────
  async function saveService(s) {
    if(!s.name||!s.category){alert('Preencha nome e categoria');return}
    let err
    if(s.id){const r=await supabase.from('services').update({name:s.name,category:s.category,duration_min:Number(s.duration_min),price:Number(s.price),active:s.active}).eq('id',s.id);err=r.error}
    else{const r=await supabase.from('services').insert({name:s.name,category:s.category,duration_min:Number(s.duration_min),price:Number(s.price),active:true});err=r.error}
    if(err){alert('Erro ao salvar: '+err.message);return}
    setEditService(null); fetchAll()
  }

  // ── Professionals ──────────────────────────────────────────────────────
  async function saveProf(p) {
    if(!p.name||!p.initials){alert('Preencha nome e iniciais');return}
    let err
    if(p.id){const r=await supabase.from('professionals').update({name:p.name,role:p.role,initials:p.initials.toUpperCase().slice(0,2),color:p.color,active:p.active}).eq('id',p.id);err=r.error}
    else{const r=await supabase.from('professionals').insert({name:p.name,role:p.role,initials:p.initials.toUpperCase().slice(0,2),color:p.color||'purple',active:true});err=r.error}
    if(err){alert('Erro ao salvar: '+err.message);return}
    setEditProf(null); fetchAll()
  }

  async function toggleProfService(profId,svcId,on) {
    let err
    if(on){const r=await supabase.from('professional_services').delete().eq('professional_id',profId).eq('service_id',svcId);err=r.error}
    else{const r=await supabase.from('professional_services').insert({professional_id:profId,service_id:svcId,custom_price:null});err=r.error}
    if(err){alert('Erro: '+err.message);return}
    fetchAll()
  }
  async function setProfPrice(profId,svcId,price) {
    await supabase.from('professional_services').update({custom_price:price===''?null:Number(price)}).eq('professional_id',profId).eq('service_id',svcId)
    fetchAll()
  }

  // ── Blocking ───────────────────────────────────────────────────────────
  async function saveBlock(b) {
    await supabase.from('blocked_slots').insert({professional_id:b.profId||null,date:b.date,time:b.allDay?null:b.time+':00',all_day:b.allDay,reason:b.reason||null})
    setBlockModal(null); fetchAll()
  }

  // ── Settings ───────────────────────────────────────────────────────────
  async function saveSetting(key,value) {
    const {error}=await supabase.from('salon_settings').update({value}).eq('key',key)
    if(error){alert('Erro ao salvar: '+error.message);return}
    fetchAll()
  }
  async function saveWorkingHour(dow,field,value) { await supabase.from('working_hours').update({[field]:value}).eq('day_of_week',dow); fetchAll() }

  async function changePassword() {
    if(newPwd.length<4){alert('Senha deve ter ao menos 4 caracteres');return}
    if(newPwd!==newPwd2){alert('As senhas não coincidem');return}
    await saveSetting('admin_password_hash',newPwd)
    setAdminPwd(newPwd); setNewPwd(''); setNewPwd2('')
    alert('Senha alterada com sucesso!')
  }

  // ── Commission calc ────────────────────────────────────────────────────
  const commissionPct = parseFloat(settings.commission_pct||'0')
  const commissionEnabled = settings.commission_enabled==='true'

  // ── Report ─────────────────────────────────────────────────────────────
  const reportData=appointments.filter(a=>a.status!=='cancelled'&&a.date>=reportFrom&&a.date<=reportTo)
  const reportRevenue=reportData.reduce((s,a)=>s+Number(a.price_charged||a.services?.price||0),0)
  const reportByProf=reportData.reduce((acc,a)=>{
    const n=a.professionals?.name||'Sem profissional'
    if(!acc[n])acc[n]={count:0,revenue:0,commission:0}
    const rev=Number(a.price_charged||a.services?.price||0)
    acc[n].count++; acc[n].revenue+=rev
    acc[n].commission+=commissionEnabled?rev*commissionPct/100:0
    return acc
  },{})
  const reportByService=reportData.reduce((acc,a)=>{
    const n=a.services?.name||'?'
    if(!acc[n])acc[n]={count:0,revenue:0}
    acc[n].count++; acc[n].revenue+=Number(a.price_charged||a.services?.price||0)
    return acc
  },{})

  if(!authed) return (
    <div className="page" style={{display:'flex',flexDirection:'column',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{fontSize:40,textAlign:'center',marginBottom:16}}>🔐</div>
      <h2 style={{textAlign:'center',marginBottom:20}}>Painel Admin</h2>
      <div className="form-group"><label className="form-label">Senha</label>
        <input className="form-input" type="password" value={pwdInput} onChange={e=>setPwdInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} autoFocus/>
      </div>
      <button className="btn btn-primary" onClick={login}>Entrar</button>
    </div>
  )

  const today=new Date().toISOString().slice(0,10)
  const displayAps=tab==='today'?appointments.filter(a=>a.date===today):appointments
  const TABS=[['today','Hoje'],['all','Todos'],['calendar','Agenda'],['services','Serviços'],['team','Equipe'],['clients','Clientes'],['report','Financeiro'],['reviews','Avaliações'],['settings','Config']]

  return (
    <div className="page">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <h2>Painel Admin</h2>
        <button className="btn btn-outline" style={{padding:'6px 12px',fontSize:12,marginTop:8,width:'auto'}} onClick={()=>setAuthed(false)}>Sair</button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,margin:'0.5rem 0 1rem'}}>
        {[['Hoje',stats.today],['Semana',stats.week],['Mês',stats.month],['Receita','R$'+stats.revenue.toFixed(0)],['Nota',stats.avgRating],['Reviews',stats.reviews]].map(([l,v])=>(
          <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value" style={{fontSize:18,color:'var(--gray-700)'}}>{v}</div></div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',overflowX:'auto',borderBottom:'1px solid var(--gray-100)',margin:'0 -1.25rem',padding:'0 1.25rem',gap:12,marginTop:4}}>
        {TABS.map(([k,label])=>(
          <button key={k} onClick={()=>setTab(k)} style={{background:'none',border:'none',borderBottom:tab===k?'2px solid var(--primary)':'2px solid transparent',padding:'8px 0',fontSize:12,fontWeight:tab===k?600:400,color:tab===k?'var(--primary-text)':'var(--gray-500)',cursor:'pointer',marginBottom:-1,fontFamily:'inherit',whiteSpace:'nowrap',flexShrink:0}}>{label}</button>
        ))}
      </div>

      {loading&&<div className="loading">Carregando...</div>}

      {/* TODAY / ALL */}
      {(tab==='today'||tab==='all')&&!loading&&<>
        <div style={{display:'flex',gap:8,marginTop:12,marginBottom:4}}>
          <button className="btn btn-outline" style={{width:'auto',padding:'7px 14px',fontSize:12}} onClick={()=>setManualModal(true)}>+ Agendamento manual</button>
        </div>
        {displayAps.length===0&&<div className="empty">Nenhum agendamento {tab==='today'?'hoje':''}.</div>}
        {displayAps.map(ap=>{
          const d=new Date(ap.date+'T12:00:00')
          return (
            <div key={ap.id} className="card" style={{fontSize:13}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div><div style={{fontWeight:600,fontSize:14}}>{ap.clients?.name||'Cliente'}</div><div style={{color:'var(--gray-500)',fontSize:12}}>📱 {ap.clients?.phone}</div></div>
                <span className={`badge ${statusClass[ap.status]||'badge-done'}`}>{statusLabel[ap.status]}</span>
              </div>
              <div style={{color:'var(--gray-500)',marginBottom:4}}>✂️ {ap.services?.name} · {ap.professionals?.name||'A definir'}</div>
              <div style={{color:'var(--gray-500)',marginBottom:ap.rating?4:8}}>📅 {d.getDate()}/{d.getMonth()+1} às {ap.time?.slice(0,5)} · R$ {Number(ap.price_charged||ap.services?.price).toFixed(2)} {ap.reminder_sent&&<span style={{fontSize:10,background:'var(--gray-100)',borderRadius:99,padding:'1px 6px',marginLeft:4}}>🔔 lembrete enviado</span>}</div>
              {ap.rating&&<div style={{marginBottom:8}}>{'⭐'.repeat(ap.rating)} <span style={{fontSize:11,color:'var(--gray-500)'}}>{ap.review}</span></div>}
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {ap.status!=='done'&&ap.status!=='cancelled'&&<button className="btn btn-outline" style={{padding:'5px 10px',fontSize:12,width:'auto'}} onClick={()=>updateStatus(ap.id,'done')}>✓ Concluído</button>}
                {ap.status==='confirmed'&&<button className="btn btn-danger" style={{padding:'5px 10px',fontSize:12,width:'auto'}} onClick={()=>updateStatus(ap.id,'cancelled')}>✕ Cancelar</button>}
                {ap.status==='cancelled'&&<button className="btn btn-outline" style={{padding:'5px 10px',fontSize:12,width:'auto'}} onClick={()=>updateStatus(ap.id,'confirmed')}>↩ Restaurar</button>}
              </div>
            </div>
          )
        })}
      </>}

      {/* CALENDAR */}
      {tab==='calendar'&&!loading&&<>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:12,marginBottom:8}}>
          <button className="btn btn-outline" style={{width:'auto',padding:'8px 12px',fontSize:12}} onClick={()=>{const d=new Date(calDate);d.setDate(d.getDate()-1);setCalDate(d.toISOString().slice(0,10))}}>‹</button>
          <input type="date" value={calDate} onChange={e=>setCalDate(e.target.value)} style={{flex:1,padding:'8px 10px',border:'1px solid var(--gray-300)',borderRadius:'var(--radius-sm)',fontSize:14,fontFamily:'inherit'}}/>
          <button className="btn btn-outline" style={{width:'auto',padding:'8px 12px',fontSize:12}} onClick={()=>{const d=new Date(calDate);d.setDate(d.getDate()+1);setCalDate(d.toISOString().slice(0,10))}}>›</button>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:13,color:'var(--gray-500)'}}>{calAppts.length} agendamentos</span>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline" style={{width:'auto',padding:'6px 10px',fontSize:12}} onClick={()=>setManualModal(true)}>+ Manual</button>
            <button className="btn btn-outline" style={{width:'auto',padding:'6px 10px',fontSize:12}} onClick={()=>setBlockModal({date:calDate,allDay:false,time:'09:00',profId:'',reason:''})}>🚫 Bloquear</button>
          </div>
        </div>
        {calAppts.length===0&&<div className="empty">Nenhum agendamento neste dia.</div>}
        {calAppts.map(ap=>{
          const [bg,fg]=PC[ap.professionals?.color]||PC.purple
          return (
            <div key={ap.id} className="card" style={{display:'flex',gap:10,padding:'0.75rem 1rem'}}>
              <div style={{background:bg,color:fg,borderRadius:'var(--radius-sm)',padding:'4px 8px',fontSize:13,fontWeight:600,flexShrink:0,alignSelf:'flex-start'}}>{ap.time?.slice(0,5)}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:13}}>{ap.clients?.name}</div>
                <div style={{fontSize:12,color:'var(--gray-500)'}}>{ap.services?.name} · {ap.professionals?.name}</div>
                <div style={{fontSize:12,color:'var(--gray-500)'}}>R$ {Number(ap.price_charged||ap.services?.price).toFixed(2)} · {ap.services?.duration_min}min</div>
              </div>
              <span className={`badge ${statusClass[ap.status]}`}>{statusLabel[ap.status]}</span>
            </div>
          )
        })}
      </>}

      {/* SERVICES */}
      {tab==='services'&&!loading&&<>
        <button className="btn btn-outline" style={{marginTop:12,width:'auto',padding:'8px 16px'}} onClick={()=>setEditService({name:'',category:'Cabelo',duration_min:30,price:50,active:true})}>+ Novo serviço</button>
        {services.map(s=>(
          <div key={s.id} className="card" style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:20}}>{CAT_ICONS[s.category]||'⭐'}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:500}}>{s.name}</div>
              <div style={{fontSize:12,color:'var(--gray-500)'}}>{s.category} · {s.duration_min} min · R$ {Number(s.price).toFixed(2)}</div>
              {!s.active&&<span className="badge badge-cancelled" style={{marginTop:4}}>Inativo</span>}
            </div>
            <button className="btn btn-outline" style={{padding:'5px 10px',fontSize:12,width:'auto'}} onClick={()=>setEditService({...s})}>Editar</button>
          </div>
        ))}
        {editService&&<ServiceModal s={editService} onChange={setEditService} onSave={saveService} onClose={()=>setEditService(null)}/>}
      </>}

      {/* TEAM */}
      {tab==='team'&&!loading&&<>
        <button className="btn btn-outline" style={{marginTop:12,width:'auto',padding:'8px 16px'}} onClick={()=>setEditProf({name:'',role:'',initials:'',color:'purple',active:true})}>+ Nova profissional</button>
        {professionals.map(p=>{
          const [bg,fg]=PC[p.color]||PC.purple, isOpen=openProfId===p.id
          const profSvcs=profServiceMap[p.id]||{}
          return (
            <div key={p.id} className="card" style={{padding:0,overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'0.75rem 1rem',cursor:'pointer'}} onClick={()=>setOpenProfId(isOpen?null:p.id)}>
                <div style={{width:36,height:36,borderRadius:'50%',background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:13,flexShrink:0}}>{p.initials}</div>
                <div style={{flex:1}}><div style={{fontWeight:500}}>{p.name}</div><div style={{fontSize:12,color:'var(--gray-500)'}}>{p.role} · {Object.keys(profSvcs).length} serv.</div></div>
                <button className="btn btn-outline" style={{padding:'4px 8px',fontSize:11,width:'auto'}} onClick={e=>{e.stopPropagation();setEditProf({...p})}}>Editar</button>
                <span style={{color:'var(--gray-500)',fontSize:14}}>{isOpen?'▲':'▼'}</span>
              </div>
              {isOpen&&(
                <div style={{borderTop:'1px solid var(--gray-100)',background:'var(--gray-50)',padding:'0.75rem 1rem'}}>
                  <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--gray-500)',marginBottom:8}}>Serviços e preços</p>
                  {services.map(s=>{
                    const on=s.id in profSvcs, cp=profSvcs[s.id]
                    const disp=cp!==null&&cp!==undefined?cp:s.price
                    return (
                      <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'0.5px solid var(--gray-100)'}}>
                        <input type="checkbox" checked={on} onChange={()=>toggleProfService(p.id,s.id,on)} style={{width:16,height:16,cursor:'pointer',accentColor:'var(--primary)'}}/>
                        <span style={{flex:1,fontSize:13,color:on?'var(--gray-700)':'var(--gray-500)'}}>{CAT_ICONS[s.category]} {s.name}</span>
                        <input type="number" disabled={!on} value={disp} onChange={e=>setProfPrice(p.id,s.id,e.target.value)}
                          style={{width:72,padding:'4px 8px',border:'0.5px solid var(--gray-300)',borderRadius:'var(--radius-sm)',fontSize:13,textAlign:'right',opacity:on?1:0.4,background:'#fff',fontFamily:'inherit'}}/>
                        <span style={{fontSize:10,color:cp!==null&&cp!==s.price?'var(--primary-text)':'var(--gray-500)',minWidth:32}}>{cp!==null&&cp!==s.price?'custom':'padrão'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {editProf&&<ProfModal p={editProf} onChange={setEditProf} onSave={saveProf} onClose={()=>setEditProf(null)}/>}
      </>}

      {/* CLIENTS */}
      {tab==='clients'&&!loading&&<>
        <div style={{marginTop:12,marginBottom:8}}>
          <input className="form-input" placeholder="Buscar por nome ou telefone..." value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/>
        </div>
        {clients.filter(c=>!clientSearch||c.name?.toLowerCase().includes(clientSearch.toLowerCase())||c.phone?.includes(clientSearch)).map(c=>{
          const appts=appointments.filter(a=>a.client_id===c.id)
          const done=appts.filter(a=>a.status==='done')
          const totalSpent=done.reduce((s,a)=>s+Number(a.price_charged||a.services?.price||0),0)
          const isOpen=selectedClient?.id===c.id
          return (
            <div key={c.id} className="card card-interactive" onClick={()=>setSelectedClient(isOpen?null:c)}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary-text)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:14,flexShrink:0}}>{(c.name||'?')[0].toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,fontSize:14}}>{c.name||'Sem nome'}</div>
                  <div style={{fontSize:12,color:'var(--gray-500)'}}>📱 {c.phone} · {appts.length} agend. · R$ {totalSpent.toFixed(0)} total</div>
                </div>
                <span style={{color:'var(--gray-500)'}}>{isOpen?'▲':'▼'}</span>
              </div>
              {isOpen&&(
                <div style={{marginTop:12,borderTop:'1px solid var(--gray-100)',paddingTop:12}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:10}}>
                    {[['Concluídos',done.length],['Total',`R$${totalSpent.toFixed(0)}`],['Média',`R$${done.length?Math.round(totalSpent/done.length):0}`]].map(([l,v])=>(
                      <div key={l} style={{background:'var(--gray-50)',borderRadius:'var(--radius-sm)',padding:'8px',textAlign:'center'}}>
                        <div style={{fontSize:16,fontWeight:600}}>{v}</div>
                        <div style={{fontSize:11,color:'var(--gray-500)'}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',color:'var(--gray-500)',marginBottom:6}}>Últimos atendimentos</p>
                  {appts.slice(0,5).map(ap=>(
                    <div key={ap.id} style={{fontSize:12,padding:'5px 0',borderBottom:'0.5px solid var(--gray-100)',display:'flex',justifyContent:'space-between'}}>
                      <span>{ap.services?.name}</span>
                      <span style={{color:'var(--gray-500)'}}>{ap.date} {ap.time?.slice(0,5)} <span className={`badge ${statusClass[ap.status]}`}>{statusLabel[ap.status]}</span></span>
                    </div>
                  ))}
                  {c.notes&&<p style={{fontSize:12,color:'var(--gray-500)',marginTop:8}}>📝 {c.notes}</p>}
                </div>
              )}
            </div>
          )
        })}
      </>}

      {/* FINANCIAL REPORT */}
      {tab==='report'&&!loading&&<>
        <div style={{display:'flex',gap:8,marginTop:12,marginBottom:12}}>
          <div style={{flex:1}}><label className="form-label">De</label><input type="date" className="form-input" value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/></div>
          <div style={{flex:1}}><label className="form-label">Até</label><input type="date" className="form-input" value={reportTo} onChange={e=>setReportTo(e.target.value)}/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:12}}>
          <div className="stat-card"><div className="stat-label">Agendamentos</div><div className="stat-value">{reportData.length}</div></div>
          <div className="stat-card"><div className="stat-label">Receita total</div><div className="stat-value" style={{fontSize:16}}>R$ {reportRevenue.toFixed(2)}</div></div>
        </div>
        <p className="section-title">Por profissional {commissionEnabled&&`(comissão ${commissionPct}%)`}</p>
        {Object.entries(reportByProf).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name,d])=>(
          <div key={name} className="card" style={{padding:'0.7rem 1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontWeight:500,fontSize:13}}>{name}</div><div style={{fontSize:12,color:'var(--gray-500)'}}>{d.count} atend.</div></div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:600,color:'var(--success)'}}>R$ {d.revenue.toFixed(2)}</div>
                {commissionEnabled&&<div style={{fontSize:11,color:'var(--gray-500)'}}>Comissão: R$ {d.commission.toFixed(2)}</div>}
              </div>
            </div>
          </div>
        ))}
        <p className="section-title">Por serviço</p>
        {Object.entries(reportByService).sort((a,b)=>b[1].count-a[1].count).map(([name,d])=>(
          <div key={name} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.7rem 1rem'}}>
            <div><div style={{fontWeight:500,fontSize:13}}>{name}</div><div style={{fontSize:12,color:'var(--gray-500)'}}>{d.count}x</div></div>
            <div style={{fontWeight:600,color:'var(--success)'}}>R$ {d.revenue.toFixed(2)}</div>
          </div>
        ))}
      </>}

      {/* REVIEWS */}
      {tab==='reviews'&&!loading&&<>
        <div style={{display:'flex',alignItems:'center',gap:12,margin:'12px 0',background:'var(--gray-50)',borderRadius:'var(--radius-md)',padding:'0.75rem 1rem'}}>
          <div style={{fontSize:28,fontWeight:700}}>{stats.avgRating}</div>
          <div><div style={{fontSize:16}}>{'⭐'.repeat(Math.round(Number(stats.avgRating)||0))}</div><div style={{fontSize:12,color:'var(--gray-500)'}}>{stats.reviews} avaliações</div></div>
        </div>
        {appointments.filter(a=>a.rating).length===0&&<div className="empty">Nenhuma avaliação ainda.</div>}
        {appointments.filter(a=>a.rating).map(ap=>(
          <div key={ap.id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <div style={{fontWeight:500,fontSize:14}}>{ap.clients?.name}</div>
              <div style={{fontSize:14}}>{'⭐'.repeat(ap.rating)}</div>
            </div>
            <div style={{fontSize:12,color:'var(--gray-500)',marginBottom:4}}>{ap.services?.name} · {ap.date}</div>
            {ap.review&&<div style={{fontSize:13,color:'var(--gray-700)',fontStyle:'italic'}}>"{ap.review}"</div>}
          </div>
        ))}
      </>}

      {/* SETTINGS */}
      {tab==='settings'&&!loading&&<>
        <p className="section-title">Identidade visual</p>
        <div className="form-group">
          <label className="form-label">URL da logomarca</label>
          <div style={{display:'flex',gap:8}}>
            <input className="form-input" defaultValue={settings.logo_url||''} id="s-logo_url"
              placeholder="https://... (link direto para a imagem)"/>
            <button className="btn btn-outline" style={{width:'auto',padding:'8px 14px',flexShrink:0}}
              onClick={()=>saveSetting('logo_url',document.getElementById('s-logo_url').value)}>Salvar</button>
          </div>
          {settings.logo_url&&<img src={settings.logo_url} alt="Logo" style={{width:60,height:60,borderRadius:10,objectFit:'cover',marginTop:8,border:'0.5px solid var(--gray-100)'}}/>}
          <p style={{fontSize:11,color:'var(--gray-500)',marginTop:6}}>
            💡 Suba sua logo no <strong>Imgur</strong> (imgur.com) ou <strong>Cloudinary</strong> (cloudinary.com) gratuitamente e cole o link aqui.
          </p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
          {[['primary_color','Cor principal'],['secondary_color','Cor secundária'],['accent_color','Cor do texto']].map(([key,label])=>(
            <div key={key}>
              <label className="form-label">{label}</label>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <input type="color" defaultValue={settings[key]||'#042C53'} id={`s-${key}`}
                  style={{width:36,height:36,borderRadius:6,border:'0.5px solid var(--gray-300)',cursor:'pointer',padding:2}}/>
                <button className="tiny-btn primary" style={{flex:1,padding:'6px 8px'}}
                  onClick={()=>saveSetting(key,document.getElementById(`s-${key}`).value)}>Ok</button>
              </div>
            </div>
          ))}
        </div>
        <p className="section-title">Informações do salão</p>
        {[['salon_name','Nome do salão'],['salon_phone','Telefone'],['salon_address','Endereço'],['admin_whatsapp','WhatsApp da dona (notificações)']].map(([key,label])=>(
          <div key={key} className="form-group">
            <label className="form-label">{label}</label>
            <div style={{display:'flex',gap:8}}>
              <input className="form-input" defaultValue={settings[key]||''} id={`s-${key}`} placeholder={key==='admin_whatsapp'?'81999990000':''}/>
              <button className="btn btn-outline" style={{width:'auto',padding:'8px 14px',flexShrink:0}} onClick={()=>saveSetting(key,document.getElementById(`s-${key}`).value)}>Salvar</button>
            </div>
          </div>
        ))}

        <p className="section-title">WhatsApp (Evolution API)</p>
        {[['whatsapp_api_url','URL da API'],['whatsapp_api_key','API Key'],['whatsapp_instance','Nome da instância']].map(([key,label])=>(
          <div key={key} className="form-group">
            <label className="form-label">{label}</label>
            <div style={{display:'flex',gap:8}}>
              <input className="form-input" defaultValue={settings[key]||''} id={`s-${key}`}/>
              <button className="btn btn-outline" style={{width:'auto',padding:'8px 14px',flexShrink:0}} onClick={()=>saveSetting(key,document.getElementById(`s-${key}`).value)}>Salvar</button>
            </div>
          </div>
        ))}
        <div style={{background:'var(--primary-light)',borderRadius:'var(--radius-md)',padding:'0.75rem 1rem',fontSize:12,color:'var(--primary-text)',marginBottom:12}}>
          💡 Guia de instalação gratuita: <strong>evolution-api.com</strong>
        </div>

        <p className="section-title">Notificações</p>
        <div className="form-group">
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,cursor:'pointer',marginBottom:8}}>
            <input type="checkbox" checked={settings.notify_admin_new_booking==='true'} onChange={e=>saveSetting('notify_admin_new_booking',e.target.checked?'true':'false')} style={{accentColor:'var(--primary)'}}/>
            Notificar o salão quando chegar novo agendamento
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">Mensagem para o salão</label>
          <textarea id="s-notify_admin_message" defaultValue={settings.notify_admin_message||''} style={{width:'100%',padding:'9px 12px',border:'1px solid var(--gray-300)',borderRadius:'var(--radius-sm)',fontSize:13,fontFamily:'inherit',minHeight:80,resize:'vertical'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
            <span style={{fontSize:11,color:'var(--gray-500)'}}>Variáveis: {'{nome} {telefone} {servico} {profissional} {data} {horario} {valor}'}</span>
            <button className="btn btn-outline" style={{width:'auto',padding:'5px 10px',fontSize:11}} onClick={()=>saveSetting('notify_admin_message',document.getElementById('s-notify_admin_message').value)}>Salvar</button>
          </div>
        </div>

        <p className="section-title">Lembrete automático para clientes</p>
        <div className="form-group">
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,cursor:'pointer',marginBottom:8}}>
            <input type="checkbox" checked={settings.reminder_enabled==='true'} onChange={e=>saveSetting('reminder_enabled',e.target.checked?'true':'false')} style={{accentColor:'var(--primary)'}}/>
            Ativar lembrete automático
          </label>
        </div>
        <div className="form-group">
          <label className="form-label">Enviar quantas horas antes?</label>
          <div style={{display:'flex',gap:8}}>
            <input type="number" className="form-input" id="s-reminder_hours_before" defaultValue={settings.reminder_hours_before||'24'} min="1" max="72" style={{maxWidth:120}}/>
            <span style={{lineHeight:'42px',color:'var(--gray-500)',fontSize:14}}>horas antes</span>
            <button className="btn btn-outline" style={{width:'auto',padding:'8px 14px',flexShrink:0}} onClick={()=>saveSetting('reminder_hours_before',document.getElementById('s-reminder_hours_before').value)}>Salvar</button>
          </div>
          <p style={{fontSize:11,color:'var(--gray-500)',marginTop:4}}>Exemplo: 24h antes = lembrete no dia anterior. 2h antes = lembrete 2 horas antes do horário.</p>
        </div>
        <div className="form-group">
          <label className="form-label">Mensagem do lembrete</label>
          <textarea id="s-reminder_message" defaultValue={settings.reminder_message||''} style={{width:'100%',padding:'9px 12px',border:'1px solid var(--gray-300)',borderRadius:'var(--radius-sm)',fontSize:13,fontFamily:'inherit',minHeight:90,resize:'vertical'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
            <span style={{fontSize:11,color:'var(--gray-500)'}}>Variáveis: {'{nome} {servico} {profissional} {horario} {data}'}</span>
            <button className="btn btn-outline" style={{width:'auto',padding:'5px 10px',fontSize:11}} onClick={()=>saveSetting('reminder_message',document.getElementById('s-reminder_message').value)}>Salvar</button>
          </div>
        </div>
        <div style={{background:'var(--primary-light)',borderRadius:'var(--radius-md)',padding:'0.75rem 1rem',fontSize:12,color:'var(--primary-text)',marginBottom:12}}>
          💡 O lembrete é enviado pela <strong>Edge Function</strong> do Supabase. Configure um cron job para chamar <code>send-reminders</code> diariamente. Instruções no arquivo <code>supabase.js</code>.
        </div>

        <p className="section-title">Comissões</p>
        <div className="form-group">
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,cursor:'pointer',marginBottom:8}}>
            <input type="checkbox" checked={settings.commission_enabled==='true'} onChange={e=>saveSetting('commission_enabled',e.target.checked?'true':'false')} style={{accentColor:'var(--primary)'}}/>
            Calcular comissão no relatório financeiro
          </label>
        </div>
        {settings.commission_enabled==='true'&&(
          <div className="form-group">
            <label className="form-label">Percentual de comissão (%)</label>
            <div style={{display:'flex',gap:8}}>
              <input type="number" className="form-input" id="s-commission_pct" defaultValue={settings.commission_pct||'40'} min="1" max="100" style={{maxWidth:120}}/>
              <span style={{lineHeight:'42px',color:'var(--gray-500)',fontSize:14}}>% por serviço</span>
              <button className="btn btn-outline" style={{width:'auto',padding:'8px 14px',flexShrink:0}} onClick={()=>saveSetting('commission_pct',document.getElementById('s-commission_pct').value)}>Salvar</button>
            </div>
          </div>
        )}

        <p className="section-title">Horário de funcionamento</p>
        {workingHours.map(wh=>(
          <div key={wh.day_of_week} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid var(--gray-100)'}}>
            <label style={{display:'flex',alignItems:'center',gap:6,width:90,flexShrink:0,cursor:'pointer'}}>
              <input type="checkbox" checked={wh.is_open} onChange={e=>saveWorkingHour(wh.day_of_week,'is_open',e.target.checked)} style={{accentColor:'var(--primary)'}}/>
              <span style={{fontSize:13,fontWeight:wh.is_open?500:400,color:wh.is_open?'var(--gray-700)':'var(--gray-500)'}}>{DAYS_FULL[wh.day_of_week]}</span>
            </label>
            {wh.is_open?<>
              <input type="time" value={wh.open_time?.slice(0,5)||'08:00'} onChange={e=>saveWorkingHour(wh.day_of_week,'open_time',e.target.value)} style={{flex:1,padding:'5px 8px',border:'1px solid var(--gray-300)',borderRadius:'var(--radius-sm)',fontSize:13,fontFamily:'inherit'}}/>
              <span style={{fontSize:12,color:'var(--gray-500)'}}>até</span>
              <input type="time" value={wh.close_time?.slice(0,5)||'18:00'} onChange={e=>saveWorkingHour(wh.day_of_week,'close_time',e.target.value)} style={{flex:1,padding:'5px 8px',border:'1px solid var(--gray-300)',borderRadius:'var(--radius-sm)',fontSize:13,fontFamily:'inherit'}}/>
            </>:<span style={{fontSize:12,color:'var(--gray-500)'}}>Fechado</span>}
          </div>
        ))}

        <p className="section-title">Segurança — Alterar senha do admin</p>
        <div className="form-group"><label className="form-label">Nova senha</label><input type="password" className="form-input" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="Mínimo 4 caracteres"/></div>
        <div className="form-group"><label className="form-label">Confirmar nova senha</label><input type="password" className="form-input" value={newPwd2} onChange={e=>setNewPwd2(e.target.value)}/></div>
        <button className="btn btn-primary" onClick={changePassword} disabled={!newPwd||newPwd!==newPwd2}>Alterar senha</button>
        <div style={{height:32}}/>
      </>}

      {/* BLOCK MODAL */}
      {blockModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-end',zIndex:100}}>
          <div style={{background:'#fff',borderRadius:'16px 16px 0 0',padding:'1.5rem',width:'100%',maxWidth:480,margin:'0 auto'}}>
            <h3 style={{marginBottom:16}}>Bloquear horário</h3>
            <div className="form-group"><label className="form-label">Data</label><input type="date" className="form-input" value={blockModal.date} onChange={e=>setBlockModal(b=>({...b,date:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Profissional (vazio = todas)</label>
              <select className="form-input" value={blockModal.profId} onChange={e=>setBlockModal(b=>({...b,profId:e.target.value}))}>
                <option value="">Todas</option>
                {professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,cursor:'pointer'}}>
              <input type="checkbox" checked={blockModal.allDay} onChange={e=>setBlockModal(b=>({...b,allDay:e.target.checked}))}/>
              Bloquear dia inteiro
            </label></div>
            {!blockModal.allDay&&<div className="form-group"><label className="form-label">Horário</label><input type="time" className="form-input" value={blockModal.time} onChange={e=>setBlockModal(b=>({...b,time:e.target.value}))}/></div>}
            <div className="form-group"><label className="form-label">Motivo (opcional)</label><input className="form-input" placeholder="Ex.: Folga, reunião..." value={blockModal.reason} onChange={e=>setBlockModal(b=>({...b,reason:e.target.value}))}/></div>
            <div style={{display:'flex',gap:10,marginTop:12}}>
              <button className="btn btn-outline" onClick={()=>setBlockModal(null)} style={{flex:1}}>Cancelar</button>
              <button className="btn btn-primary" onClick={()=>saveBlock(blockModal)} style={{flex:1}}>Bloquear</button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL BOOKING MODAL */}
      {manualModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-end',zIndex:100}}>
          <div style={{background:'#fff',borderRadius:'16px 16px 0 0',padding:'1.5rem',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'85vh',overflowY:'auto'}}>
            <h3 style={{marginBottom:4}}>Agendamento manual</h3>
            <p style={{fontSize:13,color:'var(--gray-500)',marginBottom:16}}>Para clientes que ligam ou aparecem pessoalmente</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Telefone do cliente *</label><input className="form-input" placeholder="81999990000" value={manualForm.clientPhone} onChange={e=>setManualForm(f=>({...f,clientPhone:e.target.value}))}/></div>
              <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Nome do cliente</label><input className="form-input" placeholder="Ex.: Maria Silva" value={manualForm.clientName} onChange={e=>setManualForm(f=>({...f,clientName:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Profissional</label>
                <select className="form-input" value={manualForm.profId} onChange={e=>setManualForm(f=>({...f,profId:e.target.value}))}>
                  <option value="">A definir</option>
                  {professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Serviço *</label>
                <select className="form-input" value={manualForm.serviceId} onChange={e=>setManualForm(f=>({...f,serviceId:e.target.value}))}>
                  <option value="">Selecione</option>
                  {services.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Data *</label><input type="date" className="form-input" value={manualForm.date} onChange={e=>setManualForm(f=>({...f,date:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Horário *</label><input type="time" className="form-input" value={manualForm.time} onChange={e=>setManualForm(f=>({...f,time:e.target.value}))}/></div>
              <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Observações</label><input className="form-input" placeholder="Ex.: cliente prefere produto X" value={manualForm.notes} onChange={e=>setManualForm(f=>({...f,notes:e.target.value}))}/></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button className="btn btn-outline" onClick={()=>setManualModal(false)} style={{flex:1}}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveManualBooking} style={{flex:1}}>Confirmar agendamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ServiceModal({s,onChange,onSave,onClose}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-end',zIndex:100}}>
      <div style={{background:'#fff',borderRadius:'16px 16px 0 0',padding:'1.5rem',width:'100%',maxWidth:480,margin:'0 auto'}}>
        <h3 style={{marginBottom:16}}>{s.id?'Editar':'Novo'} serviço</h3>
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={s.name} onChange={e=>onChange(p=>({...p,name:e.target.value}))}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="form-group"><label className="form-label">Categoria</label>
            <select className="form-input" value={s.category} onChange={e=>onChange(p=>({...p,category:e.target.value}))}>
              {['Cabelo','Depilação','Estética','Unhas','Massagem','Sobrancelha','Outra'].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Duração (min)</label><input type="number" className="form-input" value={s.duration_min} onChange={e=>onChange(p=>({...p,duration_min:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Preço (R$)</label><input type="number" className="form-input" value={s.price} onChange={e=>onChange(p=>({...p,price:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-input" value={s.active?'1':'0'} onChange={e=>onChange(p=>({...p,active:e.target.value==='1'}))}>
              <option value="1">Ativo</option><option value="0">Inativo</option>
            </select>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:4}}>
          <button className="btn btn-outline" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>onSave(s)} style={{flex:1}}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

function ProfModal({p,onChange,onSave,onClose}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-end',zIndex:100}}>
      <div style={{background:'#fff',borderRadius:'16px 16px 0 0',padding:'1.5rem',width:'100%',maxWidth:480,margin:'0 auto'}}>
        <h3 style={{marginBottom:16}}>{p.id?'Editar':'Nova'} profissional</h3>
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={p.name} onChange={e=>onChange(x=>({...x,name:e.target.value}))}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="form-group"><label className="form-label">Função</label><input className="form-input" value={p.role} onChange={e=>onChange(x=>({...x,role:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Iniciais</label><input className="form-input" value={p.initials} maxLength={2} style={{textTransform:'uppercase'}} onChange={e=>onChange(x=>({...x,initials:e.target.value.toUpperCase()}))}/></div>
          <div className="form-group"><label className="form-label">Cor</label>
            <select className="form-input" value={p.color} onChange={e=>onChange(x=>({...x,color:e.target.value}))}>
              {[['purple','Roxo'],['pink','Rosa'],['teal','Verde'],['amber','Âmbar'],['blue','Azul']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-input" value={p.active?'1':'0'} onChange={e=>onChange(x=>({...x,active:e.target.value==='1'}))}>
              <option value="1">Ativa</option><option value="0">Inativa</option>
            </select>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:4}}>
          <button className="btn btn-outline" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>onSave(p)} style={{flex:1}}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
