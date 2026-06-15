import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function ProfilePage() {
  const { client, logout } = useAuth()
  const [salonInfo, setSalonInfo] = useState({})

  useEffect(() => {
    supabase.from('salon_settings').select('key,value')
      .in('key',['salon_name','salon_phone','salon_address'])
      .then(({data})=>{
        if(data) setSalonInfo(Object.fromEntries(data.map(r=>[r.key,r.value])))
      })
  },[])

  return (
    <div className="page">
      <div className="page-header"><h2>Perfil</h2></div>

      <div className="card" style={{textAlign:'center',padding:'1.5rem 1rem',marginTop:12}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'var(--primary-50)',color:'var(--primary-800)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:500,fontSize:24,margin:'0 auto 12px'}}>
          {(client?.name||'?')[0].toUpperCase()}
        </div>
        <div style={{fontWeight:500,fontSize:16}}>{client?.name||'Sem nome'}</div>
        <div style={{fontSize:13,color:'var(--gray-500)',marginTop:4}}>
          <i className="ti ti-device-mobile" aria-hidden="true" style={{fontSize:14,verticalAlign:'-2px',marginRight:4}}/>
          {client?.phone}
        </div>
      </div>

      {(salonInfo.salon_name||salonInfo.salon_phone||salonInfo.salon_address) && (
        <div className="card" style={{marginTop:8}}>
          {salonInfo.salon_name&&(
            <p style={{fontWeight:500,color:'var(--gray-700)',fontSize:15,marginBottom:10}}>
              <i className="ti ti-scissors" aria-hidden="true" style={{fontSize:16,verticalAlign:'-2px',marginRight:6,color:'var(--primary-800)'}}/>
              {salonInfo.salon_name}
            </p>
          )}
          {[
            salonInfo.salon_phone   && ['ti-phone',    salonInfo.salon_phone],
            salonInfo.salon_address && ['ti-map-pin',  salonInfo.salon_address],
          ].filter(Boolean).map(([icon,val])=>(
            <p key={icon} style={{fontSize:13,color:'var(--gray-500)',marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
              <i className={`ti ${icon}`} aria-hidden="true" style={{fontSize:15,color:'var(--gray-500)'}}/>
              {val}
            </p>
          ))}
        </div>
      )}

      <div style={{marginTop:24}}>
        <button className="btn btn-danger" onClick={logout} style={{width:'100%'}}>
          <i className="ti ti-logout" aria-hidden="true" style={{fontSize:16}}/>
          Sair da conta
        </button>
      </div>
    </div>
  )
}
