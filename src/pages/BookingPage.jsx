import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS = ['D','S','T','Q','Q','S','S']
const AV_COLORS = { purple:'av-purple', pink:'av-pink', teal:'av-teal', amber:'av-amber', blue:'av-blue' }

export default function BookingPage({ onDone }) {
  const { client, sendWhatsApp, getSettings } = useAuth()
  const [step, setStep] = useState(1)
  const [professionals, setProfessionals] = useState([])
  const [profServices, setProfServices] = useState([])
  const [allServices, setAllServices] = useState([])
  const [workingHours, setWorkingHours] = useState({})
  const [sel, setSel] = useState({ prof:null, service:null, price:null, date:null, time:null })
  const [takenSlots, setTakenSlots] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [loading, setLoading] = useState(false)
  const [loadingSvcs, setLoadingSvcs] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    supabase.from('professionals').select('*').eq('active',true).then(({data})=>setProfessionals(data||[]))
    supabase.from('services').select('*').eq('active',true).then(({data})=>setAllServices(data||[]))
    supabase.from('working_hours').select('*').then(({data})=>{
      if(data) setWorkingHours(Object.fromEntries(data.map(r=>[r.day_of_week,r])))
    })
  },[])

  useEffect(()=>{
    if(!sel.prof) return
    if(sel.prof.id==='any'){ setProfServices(allServices); return }
    setLoadingSvcs(true)
    supabase.from('professional_services').select('service_id,custom_price,services(*)')
      .eq('professional_id',sel.prof.id)
      .then(({data})=>{
        setProfServices((data||[]).map(r=>({
          ...r.services,
          displayPrice: r.custom_price!==null ? r.custom_price : r.services.price,
          hasCustomPrice: r.custom_price!==null && r.custom_price!==r.services.price
        })))
        setLoadingSvcs(false)
      })
  },[sel.prof,allServices])

  useEffect(()=>{ if(sel.date && sel.service) loadSlots() },[sel.date,sel.prof,sel.service])

  function genSlots(open,close,dur){
    const s=[]
    const [oh,om]=open.split(':').map(Number)
    const [ch,cm]=close.split(':').map(Number)
    let c=oh*60+om; const e=ch*60+cm
    while(c+dur<=e){ s.push(`${String(Math.floor(c/60)).padStart(2,'0')}:${String(c%60).padStart(2,'0')}`); c+=30 }
    return s
  }

  async function loadSlots(){
    const dow=new Date(sel.date+'T12:00:00').getDay()
    const wh=workingHours[dow]
    if(!wh||!wh.is_open){ setAvailableSlots([]); setTakenSlots([]); return }
    const slots=genSlots(wh.open_time.slice(0,5),wh.close_time.slice(0,5),sel.service?.duration_min||30)
    setAvailableSlots(slots)
    let q=supabase.from('appointments').select('time').eq('date',sel.date).neq('status','cancelled')
    if(sel.prof?.id&&sel.prof.id!=='any') q=q.eq('professional_id',sel.prof.id)
    const {data:appts}=await q
    const {data:blocked}=await supabase.from('blocked_slots').select('time,all_day').eq('date',sel.date)
    if(blocked?.some(b=>b.all_day)){ setTakenSlots(slots); return }
    setTakenSlots([...(appts||[]),...(blocked||[]).filter(b=>b.time)].map(r=>r.time?.slice(0,5)))
  }

  function isDayOff(dateStr){
    const wh=workingHours[new Date(dateStr+'T12:00:00').getDay()]
    return !wh||!wh.is_open
  }

  function changeMonth(d){
    let m=calMonth+d,y=calYear
    if(m>11){m=0;y++} if(m<0){m=11;y--}
    setCalMonth(m); setCalYear(y)
    setSel(s=>({...s,date:null,time:null})); setAvailableSlots([]); setTakenSlots([])
  }

  function renderCalendar(){
    const first=new Date(calYear,calMonth,1).getDay()
    const dim=new Date(calYear,calMonth+1,0).getDate()
    const today=new Date(); const cells=[]
    for(let i=0;i<first;i++) cells.push(<div key={`e${i}`}/>)
    for(let d=1;d<=dim;d++){
      const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dd=new Date(calYear,calMonth,d)
      const isPast=dd<new Date(today.getFullYear(),today.getMonth(),today.getDate())
      const isOff=isDayOff(ds), isSel=sel.date===ds
      const isToday=dd.toDateString()===today.toDateString()
      cells.push(
        <div key={d} className={`cal-day${isPast||isOff?' disabled':''}${isSel?' selected':''}${isToday&&!isSel?' today':''}`}
          title={isOff&&!isPast?'Fechado':''}
          onClick={()=>!(isPast||isOff)&&setSel(s=>({...s,date:ds,time:null}))}>
          {d}
        </div>
      )
    }
    return cells
  }

  async function confirmBooking(){
    setLoading(true)
    try {
      const code='AG-'+(1000+Math.floor(Math.random()*9000))
      const profId=sel.prof?.id==='any'?null:sel.prof?.id
      const {error}=await supabase.from('appointments').insert({
        client_id:client.id, service_id:sel.service.id, professional_id:profId,
        date:sel.date, time:sel.time+':00', price_charged:sel.price,
        status:'confirmed', code, reminder_sent:false
      })
      if(error) throw error

      const d=new Date(sel.date+'T12:00:00')
      const profName=sel.prof?.id==='any'?'a profissional':sel.prof?.name
      const firstName=client.name?.split(' ')[0]||'cliente'
      const dateStr=`${d.getDate()} de ${MONTHS[d.getMonth()]}`
      const dayName=['domingo','segunda','terça','quarta','quinta','sexta','sábado'][d.getDay()]

      // Mensagem humana para o cliente
      await sendWhatsApp(client.phone,
        `✅ *Agendamento confirmado!*\n\n` +
        `Olá, ${firstName}! ${profName} te espera na *${dayName}, ${dateStr}* às *${sel.time}* para o *${sel.service.name.toLowerCase()}*.\n\n` +
        `💰 Valor: R$ ${Number(sel.price).toFixed(2)}\n🔑 Código: ${code}\n\n` +
        `Para cancelar, acesse o app. Até lá! 💙`
      )

      // Notificação para o salão
      const cfg=await getSettings('notify_admin_new_booking','notify_admin_message','admin_whatsapp')
      if(cfg.notify_admin_new_booking==='true'&&cfg.admin_whatsapp){
        const msg=(cfg.notify_admin_message||'📅 Novo agendamento!\n👤 {nome}\n✂️ {servico} com {profissional}\n📆 {data} às {horario}\n💰 R$ {valor}')
          .replace('{nome}',client.name||'').replace('{telefone}',client.phone||'')
          .replace('{servico}',sel.service.name).replace('{profissional}',sel.prof?.name||'A definir')
          .replace('{data}',dateStr).replace('{horario}',sel.time)
          .replace('{valor}',Number(sel.price).toFixed(2))
        await sendWhatsApp(cfg.admin_whatsapp.replace(/\D/g,''),msg)
      }

      setDone({ code, profName, dateStr, dayName, time:sel.time, service:sel.service.name, price:sel.price })
    } catch(e){ alert('Erro ao confirmar: '+e.message) }
    finally{ setLoading(false) }
  }

  const grouped=profServices.reduce((a,s)=>{if(!a[s.category])a[s.category]=[];a[s.category].push(s);return a},{})

  // ── Success screen ─────────────────────────────────────────────────────
  if(done) return (
    <div className="success-wrap page">
      <div className="success-icon-wrap">
        <i className="ti ti-check" aria-hidden="true" />
      </div>
      <h2 style={{fontSize:20,fontWeight:500,marginBottom:8}}>Agendado com sucesso!</h2>
      <p style={{fontSize:14,color:'var(--gray-500)',lineHeight:1.7,marginBottom:16}}>
        <strong>{done.profName}</strong> te espera na <strong>{done.dayName}, {done.dateStr}</strong> às <strong>{done.time}</strong> para o <strong>{done.service.toLowerCase()}</strong>.
      </p>
      <div style={{display:'inline-block',background:'var(--gray-50)',border:'0.5px solid var(--gray-100)',borderRadius:'var(--radius-sm)',padding:'7px 18px',fontSize:13,fontWeight:500,letterSpacing:'0.08em',color:'var(--gray-700)',marginBottom:12}}>
        {done.code}
      </div>
      <p style={{fontSize:12,color:'var(--gray-500)',marginBottom:24}}>
        <i className="ti ti-brand-whatsapp" aria-hidden="true" style={{fontSize:14,verticalAlign:'-2px',marginRight:4,color:'var(--success-600)'}} />
        Confirmação enviada por WhatsApp
      </p>
      <div style={{display:'flex',gap:10}}>
        <button className="btn btn-outline" style={{flex:1,fontSize:13}} onClick={()=>{setDone(null);setStep(1);setSel({prof:null,service:null,price:null,date:null,time:null});onDone()}}>
          Ver meus horários
        </button>
        <button className="btn btn-primary" style={{flex:1,fontSize:13,borderRadius:'var(--radius-md)'}} onClick={()=>{setDone(null);setStep(1);setSel({prof:null,service:null,price:null,date:null,time:null})}}>
          Novo agendamento
        </button>
      </div>
    </div>
  )

  return (
    <div className="page">

      {/* PASSO 1 — Profissional */}
      {step===1&&<>
        <div className="page-header">
          <h2>Com quem?</h2>
          <div className="steps" style={{marginTop:8}}>
            {[1,2,3,4].map(i=><div key={i} className={`step-dot${i===1?' active':''}`}/>)}
            <span style={{fontSize:11,color:'var(--gray-500)',marginLeft:6}}>Escolha a profissional</span>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginTop:4}}>
          {professionals.map(p=>(
            <div key={p.id} className={`card card-interactive${sel.prof?.id===p.id?' selected':''}`}
              style={{textAlign:'center',padding:'1rem 0.75rem'}}
              onClick={()=>setSel(x=>({...x,prof:p,service:null,price:null}))}>
              <div style={{width:44,height:44,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:500,fontSize:14,margin:'0 auto 8px'}}
                className={AV_COLORS[p.color]||'av-blue'}>
                {p.initials}
              </div>
              <div style={{fontWeight:500,fontSize:13,color:sel.prof?.id===p.id?'var(--primary-800)':'var(--gray-700)'}}>{p.name}</div>
              <div style={{fontSize:11,color:'var(--gray-500)',marginTop:1}}>{p.role}</div>
            </div>
          ))}
          <div className={`card card-interactive${sel.prof?.id==='any'?' selected':''}`}
            style={{textAlign:'center',padding:'1rem 0.75rem',borderStyle:'dashed'}}
            onClick={()=>setSel(x=>({...x,prof:{id:'any',name:'Sem preferência'},service:null,price:null}))}>
            <i className="ti ti-sparkles" aria-hidden="true" style={{fontSize:26,color:'var(--gray-500)',display:'block',marginBottom:8}}/>
            <div style={{fontWeight:500,fontSize:13}}>Sem preferência</div>
            <div style={{fontSize:11,color:'var(--gray-500)',marginTop:1}}>Primeira disponível</div>
          </div>
        </div>
        <button className="btn btn-primary" style={{marginTop:12}} disabled={!sel.prof} onClick={()=>setStep(2)}>
          Continuar <i className="ti ti-arrow-right" aria-hidden="true" style={{fontSize:16}}/>
        </button>
      </>}

      {/* PASSO 2 — Serviço */}
      {step===2&&<>
        <button className="back-btn" onClick={()=>setStep(1)}>
          <i className="ti ti-arrow-left" aria-hidden="true"/> Profissional
        </button>
        <div className="page-header">
          <h2>Qual serviço?</h2>
          {sel.prof?.id!=='any'&&<p>Serviços de <strong>{sel.prof?.name}</strong></p>}
          <div className="steps" style={{marginTop:8}}>
            {[1,2,3,4].map(i=><div key={i} className={`step-dot${i===2?' active':i<2?' done':''}`}/>)}
            <span style={{fontSize:11,color:'var(--gray-500)',marginLeft:6}}>Escolha o serviço</span>
          </div>
        </div>
        {loadingSvcs&&<div className="loading">Carregando...</div>}
        {!loadingSvcs&&profServices.length===0&&(
          <div className="empty">
            <i className="ti ti-mood-empty" aria-hidden="true" style={{fontSize:36,display:'block',marginBottom:12}}/>
            Nenhum serviço disponível.
            <br/>
            <button className="btn btn-outline" style={{marginTop:12,width:'auto',padding:'8px 16px'}} onClick={()=>setStep(1)}>Escolher outra profissional</button>
          </div>
        )}
        {!loadingSvcs&&Object.entries(grouped).map(([cat,items])=>(
          <div key={cat}>
            <p className="section-title">{cat}</p>
            {items.map(s=>{
              const isSel=sel.service?.id===s.id
              return (
                <div key={s.id} className={`card card-interactive${isSel?' selected':''}`}
                  style={{display:'flex',alignItems:'center',gap:12}}
                  onClick={()=>setSel(x=>({...x,service:s,price:s.displayPrice??s.price}))}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:14,color:isSel?'var(--primary-800)':'var(--gray-700)'}}>{s.name}</div>
                    <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>{s.duration_min} min</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:500,fontSize:14,color:isSel?'var(--primary-800)':'var(--gray-700)'}}>R$ {Number(s.displayPrice??s.price).toFixed(0)}</div>
                    {s.hasCustomPrice&&<div style={{fontSize:10,color:'var(--gray-500)',textDecoration:'line-through'}}>R$ {Number(s.price).toFixed(0)}</div>}
                  </div>
                  <div style={{width:18,height:18,borderRadius:'50%',border:`0.5px solid ${isSel?'var(--primary-600)':'var(--gray-300)'}`,background:isSel?'var(--primary-800)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {isSel&&<i className="ti ti-check" aria-hidden="true" style={{fontSize:11,color:'#fff'}}/>}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {!loadingSvcs&&profServices.length>0&&(
          <button className="btn btn-primary" style={{marginTop:8}} disabled={!sel.service} onClick={()=>setStep(3)}>
            Continuar <i className="ti ti-arrow-right" aria-hidden="true" style={{fontSize:16}}/>
          </button>
        )}
      </>}

      {/* PASSO 3 — Data e hora */}
      {step===3&&<>
        <button className="back-btn" onClick={()=>setStep(2)}>
          <i className="ti ti-arrow-left" aria-hidden="true"/> Serviço
        </button>
        <div className="page-header">
          <h2>Quando?</h2>
          <div className="steps" style={{marginTop:8}}>
            {[1,2,3,4].map(i=><div key={i} className={`step-dot${i===3?' active':i<3?' done':''}`}/>)}
            <span style={{fontSize:11,color:'var(--gray-500)',marginLeft:6}}>Data e horário</span>
          </div>
        </div>
        <p className="section-title">Data</p>
        <div className="cal-header">
          <button className="cal-nav-btn" onClick={()=>changeMonth(-1)}>
            <i className="ti ti-chevron-left" aria-hidden="true"/>
          </button>
          <span style={{fontWeight:500,fontSize:14}}>{MONTHS[calMonth]} {calYear}</span>
          <button className="cal-nav-btn" onClick={()=>changeMonth(1)}>
            <i className="ti ti-chevron-right" aria-hidden="true"/>
          </button>
        </div>
        <div className="cal-grid">{DAYS.map((d,i)=><div key={i} className="cal-label">{d}</div>)}</div>
        <div className="cal-grid" style={{marginTop:4}}>{renderCalendar()}</div>
        {sel.date&&availableSlots.length===0&&(
          <p style={{fontSize:13,color:'var(--gray-500)',textAlign:'center',marginTop:20,padding:'0 1rem'}}>
            Nenhum horário disponível neste dia.
          </p>
        )}
        {sel.date&&availableSlots.length>0&&<>
          <p className="section-title">
            Horários disponíveis
            <span style={{fontSize:11,fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--gray-500)',marginLeft:8}}>
              ({availableSlots.length - takenSlots.filter(t=>availableSlots.includes(t)).length} livres)
            </span>
          </p>
          <div className="time-grid">
            {availableSlots.map(t=>(
              <button key={t} className={`time-btn${takenSlots.includes(t)?' taken':''}${sel.time===t?' selected':''}`}
                onClick={()=>!takenSlots.includes(t)&&setSel(x=>({...x,time:t}))}>
                {t}
              </button>
            ))}
          </div>
        </>}
        <button className="btn btn-primary" style={{marginTop:16}} disabled={!sel.date||!sel.time} onClick={()=>setStep(4)}>
          Continuar <i className="ti ti-arrow-right" aria-hidden="true" style={{fontSize:16}}/>
        </button>
      </>}

      {/* PASSO 4 — Confirmar */}
      {step===4&&<>
        <button className="back-btn" onClick={()=>setStep(3)}>
          <i className="ti ti-arrow-left" aria-hidden="true"/> Data e horário
        </button>
        <div className="page-header">
          <h2>Confirmar</h2>
          <div className="steps" style={{marginTop:8}}>
            {[1,2,3,4].map(i=><div key={i} className={`step-dot${i===4?' active':i<4?' done':''}`}/>)}
            <span style={{fontSize:11,color:'var(--gray-500)',marginLeft:6}}>Último passo</span>
          </div>
        </div>
        <p className="section-title">Resumo do agendamento</p>
        <div className="summary-box" style={{marginBottom:16}}>
          {[
            ['Profissional', sel.prof?.name],
            ['Serviço', sel.service?.name],
            ['Duração', sel.service?.duration_min+' min'],
            ['Data', (()=>{ const d=new Date(sel.date+'T12:00:00'); return `${d.getDate()} de ${MONTHS[d.getMonth()]}` })()],
            ['Horário', sel.time],
          ].map(([l,v])=>(
            <div key={l} className="summary-row"><span className="label">{l}</span><span className="value">{v}</span></div>
          ))}
          <hr className="summary-divider"/>
          <div className="summary-row summary-total">
            <span className="label" style={{fontWeight:500}}>Total</span>
            <span className="value">R$ {Number(sel.price).toFixed(2)}</span>
          </div>
        </div>
        <p className="section-title">Seus dados</p>
        <div style={{display:'flex',alignItems:'center',gap:12,background:'var(--gray-50)',borderRadius:'var(--radius-md)',padding:'12px 14px',marginBottom:20}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:'var(--primary-50)',color:'var(--primary-800)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:500,fontSize:16,flexShrink:0}}>
            {(client?.name||'?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{fontWeight:500,fontSize:14}}>{client?.name}</div>
            <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>
              <i className="ti ti-device-mobile" aria-hidden="true" style={{fontSize:13,verticalAlign:'-2px',marginRight:3}}/>
              {client?.phone}
            </div>
          </div>
        </div>
        <button className="btn btn-primary" disabled={loading} onClick={confirmBooking}>
          <i className="ti ti-check" aria-hidden="true" style={{fontSize:16}}/>
          {loading ? 'Confirmando...' : 'Confirmar agendamento'}
        </button>
      </>}
    </div>
  )
}
