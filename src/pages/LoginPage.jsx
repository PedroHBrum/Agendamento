import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function LoginPage({ onLogin, salonName }) {
  const { sendOTP, verifyOTP, updateName } = useAuth()
  const [step, setStep] = useState('phone') // phone | otp | name
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['','','','','',''])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(false)
  const [devOtpHint, setDevOtpHint] = useState('')
  const [branding, setBranding] = useState({ logo_url:'', primary_color:'#042C53', secondary_color:'#185FA5', accent_color:'#B5D4F4' })
  const inputRefs = useRef([])

  useEffect(() => {
    supabase.from('salon_settings').select('key,value')
      .in('key',['logo_url','primary_color','secondary_color','accent_color'])
      .then(({data}) => {
        if(data && data.length > 0) {
          const b = Object.fromEntries(data.map(r=>[r.key,r.value]))
          setBranding(prev => ({...prev, ...b}))
          // Apply CSS variables dynamically
          if(b.primary_color) document.documentElement.style.setProperty('--brand-primary', b.primary_color)
          if(b.secondary_color) document.documentElement.style.setProperty('--brand-secondary', b.secondary_color)
        }
      })
  }, [])

  useEffect(() => {
    let timer
    if(countdown > 0) { timer = setTimeout(() => setCountdown(c => c-1), 1000) }
    else if(step === 'otp') setCanResend(true)
    return () => clearTimeout(timer)
  }, [countdown, step])

  function formatPhone(val) {
    const d = val.replace(/\D/g,'').slice(0,11)
    if(d.length<=2) return d
    if(d.length<=7) return `(${d.slice(0,2)}) ${d.slice(2)}`
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  }

  async function handleSendOTP() {
    const digits = phone.replace(/\D/g,'')
    if(digits.length < 10) { setError('Digite um número válido com DDD'); return }
    setError(''); setLoading(true)
    try {
      await sendOTP(digits)
      setStep('otp')
      setCountdown(600)
      setCanResend(false)
      const tempOtp = sessionStorage.getItem('_otp_temp')
      if(tempOtp) { setDevOtpHint(tempOtp); sessionStorage.removeItem('_otp_temp') }
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch(e) { setError('Erro ao enviar. Tente novamente.') }
    finally { setLoading(false) }
  }

  function handleOtpChange(idx, val) {
    const v = val.replace(/\D/g,'').slice(-1)
    const next = [...otp]; next[idx] = v; setOtp(next)
    if(v && idx < 5) inputRefs.current[idx+1]?.focus()
    if(next.every(d => d !== '')) handleVerify(next.join(''))
  }

  function handleOtpKeyDown(idx, e) {
    if(e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx-1]?.focus()
  }

  async function handleVerify(code) {
    const digits = phone.replace(/\D/g,'')
    setError(''); setLoading(true)
    try {
      const clientData = await verifyOTP(digits, code || otp.join(''))
      if(!clientData.name) { setStep('name'); setLoading(false); return }
      onLogin()
    } catch(e) {
      setError('Código inválido ou expirado.')
      setOtp(['','','','','',''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
      setLoading(false)
    }
  }

  async function handleResend() {
    if(!canResend) return
    const digits = phone.replace(/\D/g,'')
    setLoading(true); setError('')
    try {
      await sendOTP(digits)
      setOtp(['','','','','',''])
      setCountdown(600); setCanResend(false)
      const tempOtp = sessionStorage.getItem('_otp_temp')
      if(tempOtp) { setDevOtpHint(tempOtp); sessionStorage.removeItem('_otp_temp') }
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch(e) { setError('Erro ao reenviar.') }
    finally { setLoading(false) }
  }

  async function handleSaveName() {
    if(name.trim().length < 2) { setError('Digite seu nome completo'); return }
    setLoading(true)
    try { await updateName(name.trim()); onLogin() }
    catch(e) { setError('Erro ao salvar.') }
    finally { setLoading(false) }
  }

  const formatCountdown = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const bg = branding.primary_color || '#042C53'
  const bgMid = branding.secondary_color || '#185FA5'
  const accent = branding.accent_color || '#B5D4F4'

  return (
    <div className="app-wrapper">
      {/* Hero com logo e cores da marca */}
      <div style={{ background: bg, padding:'32px 20px 28px', textAlign:'center' }}>
        {branding.logo_url ? (
          <img src={branding.logo_url} alt={salonName}
            style={{ width:72, height:72, borderRadius:16, objectFit:'cover', margin:'0 auto 14px', display:'block', border:`0.5px solid ${bgMid}` }}
            onError={e => e.target.style.display='none'}
          />
        ) : (
          <div style={{ width:56, height:56, borderRadius:14, background:bgMid, border:`0.5px solid ${accent}30`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <i className="ti ti-scissors" aria-hidden="true" style={{ fontSize:26, color:accent }} />
          </div>
        )}
        <h1 style={{ fontSize:20, fontWeight:500, color:accent, marginBottom:5 }}>{salonName}</h1>
        <p style={{ fontSize:13, color:`${accent}99`, lineHeight:1.5 }}>
          {step === 'phone' && 'Agende seu horário em menos de 2 minutos'}
          {step === 'otp'   && `Código enviado para ${phone}`}
          {step === 'name'  && 'Como devemos te chamar?'}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding:'1.5rem 1.25rem', flex:1 }}>

        {/* STEP: phone */}
        {step === 'phone' && <>
          <div className="form-group">
            <label className="form-label">Seu WhatsApp</label>
            <div style={{ position:'relative' }}>
              <i className="ti ti-device-mobile" aria-hidden="true" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--gray-500)' }} />
              <input className="form-input" style={{ paddingLeft:36 }} type="tel"
                placeholder="(81) 9 0000-0000" value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                onKeyDown={e => e.key==='Enter' && handleSendOTP()} autoFocus />
            </div>
          </div>
          {error && <p style={{ color:'var(--danger-600)', fontSize:13, marginBottom:12 }}>{error}</p>}
          <button className="btn btn-primary" style={{ background:bg }} onClick={handleSendOTP} disabled={loading}>
            <i className="ti ti-brand-whatsapp" aria-hidden="true" style={{ fontSize:16 }} />
            {loading ? 'Enviando...' : 'Receber código por WhatsApp'}
          </button>
          <p style={{ fontSize:12, color:'var(--gray-500)', textAlign:'center', marginTop:16, lineHeight:1.6 }}>
            <i className="ti ti-lock" aria-hidden="true" style={{ fontSize:13, verticalAlign:'-2px', marginRight:4 }} />
            Seus dados estão seguros e não são compartilhados
          </p>
        </>}

        {/* STEP: otp */}
        {step === 'otp' && <>
          <p style={{ fontSize:14, color:'var(--gray-700)', marginBottom:8 }}>
            Digite os 6 dígitos enviados para o seu WhatsApp
          </p>

          {/* OTP hint quando WhatsApp não configurado */}
          {devOtpHint && (
            <div style={{ background:'#FAEEDA', border:'1px solid #EF9F27', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:14, textAlign:'center' }}>
              <p style={{ fontSize:11, color:'#633806', marginBottom:4, fontWeight:500 }}>
                ⚠️ WhatsApp não configurado — use este código:
              </p>
              <p style={{ fontSize:26, fontWeight:700, letterSpacing:'0.25em', color:'#633806' }}>{devOtpHint}</p>
            </div>
          )}

          <div className="otp-boxes">
            {otp.map((digit, i) => (
              <input key={i} ref={el => inputRefs.current[i] = el}
                style={{ width:42, height:52, textAlign:'center', fontSize:22, fontWeight:500,
                  border:`${digit?'1.5px':'0.5px'} solid ${digit?bg:'var(--gray-300)'}`,
                  borderRadius:'var(--radius-sm)', background: digit?`${bg}15`:'#fff',
                  color: digit?bg:'var(--gray-700)', fontFamily:'inherit', outline:'none' }}
                type="tel" maxLength={1} value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)} disabled={loading} />
            ))}
          </div>

          {countdown > 0 && (
            <p style={{ fontSize:12, color:'var(--gray-500)', textAlign:'center', marginBottom:16 }}>
              <i className="ti ti-clock" aria-hidden="true" style={{ fontSize:13, verticalAlign:'-2px', marginRight:4 }} />
              Válido por {formatCountdown(countdown)}
            </p>
          )}
          {error && <p style={{ color:'var(--danger-600)', fontSize:13, marginBottom:12, textAlign:'center' }}>{error}</p>}
          <button className="btn btn-primary" style={{ marginBottom:10, background:bg }}
            onClick={() => handleVerify()} disabled={loading || otp.some(d => !d)}>
            {loading ? 'Verificando...' : 'Confirmar código'}
          </button>
          <button className="btn btn-outline" onClick={handleResend} disabled={!canResend || loading}
            style={{ opacity: canResend?1:0.4 }}>
            {canResend ? 'Reenviar código' : `Reenviar em ${formatCountdown(countdown)}`}
          </button>
          <button className="back-btn" style={{ marginTop:12, display:'block' }}
            onClick={() => { setStep('phone'); setOtp(['','','','','','']); setError(''); setDevOtpHint('') }}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> Usar outro número
          </button>
        </>}

        {/* STEP: name — agora com campo obrigatório e mais amigável */}
        {step === 'name' && <>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>👋</div>
            <p style={{ fontSize:15, fontWeight:500, color:'var(--gray-700)', marginBottom:4 }}>Bem-vinda!</p>
            <p style={{ fontSize:13, color:'var(--gray-500)', lineHeight:1.6 }}>
              Para personalizar seus agendamentos,<br/>precisamos saber seu nome.
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Seu nome completo</label>
            <input className="form-input" type="text" placeholder="Ex.: Maria Silva"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleSaveName()} autoFocus />
          </div>
          {error && <p style={{ color:'var(--danger-600)', fontSize:13, marginBottom:12 }}>{error}</p>}
          <button className="btn btn-primary" style={{ background:bg }} onClick={handleSaveName} disabled={loading || name.trim().length < 2}>
            {loading ? 'Salvando...' : 'Entrar'}
            <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize:16 }} />
          </button>
          <p style={{ fontSize:12, color:'var(--gray-500)', textAlign:'center', marginTop:12 }}>
            Seu nome aparece nos seus agendamentos
          </p>
        </>}

      </div>
    </div>
  )
}
