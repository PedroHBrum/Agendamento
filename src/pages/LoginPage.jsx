import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function LoginPage({ onLogin, salonName }) {
  const { sendOTP, verifyOTP, updateName } = useAuth()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['','','','','',''])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(false)
  const [devCode, setDevCode] = useState('')
  const [branding, setBranding] = useState({ logo_url:'', primary_color:'#042C53', secondary_color:'#185FA5', accent_color:'#B5D4F4' })
  const inputRefs = useRef([])

  useEffect(() => {
    supabase.from('salon_settings').select('key,value')
      .in('key',['logo_url','primary_color','secondary_color','accent_color'])
      .then(({data}) => {
        if (data?.length) setBranding(prev => ({...prev, ...Object.fromEntries(data.map(r=>[r.key,r.value]))}))
      })
  }, [])

  useEffect(() => {
    let t
    if (countdown > 0) t = setTimeout(() => setCountdown(c => c-1), 1000)
    else if (step === 'otp') setCanResend(true)
    return () => clearTimeout(t)
  }, [countdown, step])

  function formatPhone(v) {
    const d = v.replace(/\D/g,'').slice(0,11)
    if (d.length<=2) return d
    if (d.length<=7) return `(${d.slice(0,2)}) ${d.slice(2)}`
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  }

  async function handleSend() {
    const digits = phone.replace(/\D/g,'')
    if (digits.length < 10) { setError('Digite um número válido com DDD'); return }
    setError(''); setLoading(true)
    try {
      const result = await sendOTP(digits)
      setDevCode(result?.otp || '')
      setStep('otp'); setCountdown(600); setCanResend(false)
      setTimeout(() => inputRefs.current[0]?.focus(), 150)
    } catch(e) { setError('Erro ao enviar. Verifique sua conexão e tente novamente.') }
    finally { setLoading(false) }
  }

  function handleOtpChange(idx, val) {
    const v = val.replace(/\D/g,'').slice(-1)
    const next = [...otp]; next[idx] = v; setOtp(next)
    if (v && idx < 5) inputRefs.current[idx+1]?.focus()
    if (next.every(d => d !== '')) handleVerify(next.join(''))
  }

  function handleOtpKey(idx, e) {
    if (e.key==='Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx-1]?.focus()
  }

  async function handleVerify(code) {
    const digits = phone.replace(/\D/g,'')
    setError(''); setLoading(true)
    try {
      const clientData = await verifyOTP(digits, code || otp.join(''))
      if (!clientData.name) { setStep('name'); setLoading(false); return }
      onLogin()
    } catch(e) {
      setError('Código inválido ou expirado. Tente novamente.')
      setOtp(['','','','','','']); setDevCode('')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!canResend) return
    setLoading(true); setError(''); setDevCode('')
    try {
      const result = await sendOTP(phone.replace(/\D/g,''))
      setDevCode(result?.otp || '')
      setOtp(['','','','','','']); setCountdown(600); setCanResend(false)
      setTimeout(() => inputRefs.current[0]?.focus(), 150)
    } catch(e) { setError('Erro ao reenviar.') }
    finally { setLoading(false) }
  }

  async function handleName() {
    if (name.trim().length < 2) { setError('Digite seu nome completo'); return }
    setLoading(true)
    try { await updateName(name.trim()); onLogin() }
    catch(e) { setError('Erro ao salvar. Tente novamente.') }
    finally { setLoading(false) }
  }

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const bg = branding.primary_color || '#042C53'
  const bgMid = branding.secondary_color || '#185FA5'
  const accent = branding.accent_color || '#B5D4F4'
  const logo = branding.logo_url || ''

  return (
    <div className="app-wrapper">
      <div style={{ background:bg, padding:'32px 20px 28px', textAlign:'center' }}>
        {logo
          ? <img src={logo} alt={salonName} onError={e=>e.target.style.display='none'}
              style={{ width:72, height:72, borderRadius:16, objectFit:'cover', margin:'0 auto 14px', display:'block', border:`0.5px solid ${bgMid}` }}/>
          : <div style={{ width:56, height:56, borderRadius:14, background:bgMid, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
              <i className="ti ti-scissors" aria-hidden="true" style={{ fontSize:26, color:accent }}/>
            </div>
        }
        <h1 style={{ fontSize:20, fontWeight:500, color:accent, marginBottom:5 }}>{salonName}</h1>
        <p style={{ fontSize:13, color:`${accent}99`, lineHeight:1.5 }}>
          {step==='phone' && 'Agende seu horário em menos de 2 minutos'}
          {step==='otp'   && `Código enviado para ${phone}`}
          {step==='name'  && 'Quase lá! Como devemos te chamar?'}
        </p>
      </div>

      <div style={{ padding:'1.5rem 1.25rem', flex:1 }}>
        {step==='phone' && <>
          <div className="form-group">
            <label className="form-label">Seu WhatsApp</label>
            <div style={{ position:'relative' }}>
              <i className="ti ti-device-mobile" aria-hidden="true" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--gray-500)' }}/>
              <input className="form-input" style={{ paddingLeft:36 }} type="tel"
                placeholder="(81) 9 0000-0000" value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                onKeyDown={e => e.key==='Enter' && handleSend()} autoFocus/>
            </div>
          </div>
          {error && <p style={{ color:'var(--danger-600)', fontSize:13, marginBottom:12 }}>{error}</p>}
          <button className="btn btn-primary" style={{ background:bg }} onClick={handleSend} disabled={loading}>
            <i className="ti ti-brand-whatsapp" aria-hidden="true" style={{ fontSize:16 }}/>
            {loading ? 'Enviando...' : 'Receber código por WhatsApp'}
          </button>
          <p style={{ fontSize:12, color:'var(--gray-500)', textAlign:'center', marginTop:16, lineHeight:1.6 }}>
            <i className="ti ti-lock" aria-hidden="true" style={{ fontSize:13, verticalAlign:'-2px', marginRight:4 }}/>
            Seus dados estão seguros
          </p>
        </>}

        {step==='otp' && <>
          {devCode && (
            <div style={{ background:'#FAEEDA', border:'2px solid #EF9F27', borderRadius:12, padding:'14px 16px', marginBottom:20, textAlign:'center' }}>
              <p style={{ fontSize:12, color:'#633806', fontWeight:500, marginBottom:8 }}>
                ⚠️ WhatsApp ainda não configurado — use este código:
              </p>
              <div style={{ background:'#fff', borderRadius:8, padding:'12px 0', border:'1px solid #EF9F27' }}>
                <p style={{ fontSize:36, fontWeight:700, letterSpacing:'0.3em', color:'#042C53', fontFamily:'monospace' }}>{devCode}</p>
              </div>
              <p style={{ fontSize:11, color:'#BA7517', marginTop:8 }}>Este aviso desaparece quando o WhatsApp estiver ativo</p>
            </div>
          )}
          <p style={{ fontSize:14, color:'var(--gray-700)', marginBottom:12 }}>
            Digite os 6 dígitos {devCode ? 'acima' : 'enviados para o seu WhatsApp'}:
          </p>
          <div className="otp-boxes">
            {otp.map((digit, i) => (
              <input key={i} ref={el => inputRefs.current[i] = el}
                style={{ width:42, height:52, textAlign:'center', fontSize:22, fontWeight:500,
                  border:`${digit?'1.5px':'0.5px'} solid ${digit?bg:'var(--gray-300)'}`,
                  borderRadius:'var(--radius-sm)', background:digit?`${bg}15`:'#fff',
                  color:digit?bg:'var(--gray-700)', fontFamily:'inherit', outline:'none', transition:'all 0.1s' }}
                type="tel" maxLength={1} value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKey(i, e)} disabled={loading}/>
            ))}
          </div>
          {countdown > 0 && (
            <p style={{ fontSize:12, color:'var(--gray-500)', textAlign:'center', marginBottom:16 }}>
              <i className="ti ti-clock" aria-hidden="true" style={{ fontSize:13, verticalAlign:'-2px', marginRight:4 }}/>
              Válido por {fmt(countdown)}
            </p>
          )}
          {error && <p style={{ color:'var(--danger-600)', fontSize:13, marginBottom:12, textAlign:'center' }}>{error}</p>}
          <button className="btn btn-primary" style={{ marginBottom:10, background:bg }}
            onClick={() => handleVerify()} disabled={loading || otp.some(d => !d)}>
            {loading ? 'Verificando...' : 'Confirmar código'}
          </button>
          <button className="btn btn-outline" onClick={handleResend} disabled={!canResend||loading} style={{ opacity:canResend?1:0.4 }}>
            {canResend ? 'Reenviar código' : `Reenviar em ${fmt(countdown)}`}
          </button>
          <button className="back-btn" style={{ marginTop:12, display:'block' }}
            onClick={() => { setStep('phone'); setOtp(['','','','','','']); setError(''); setDevCode('') }}>
            <i className="ti ti-arrow-left" aria-hidden="true"/> Usar outro número
          </button>
        </>}

        {step==='name' && <>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>👋</div>
            <p style={{ fontSize:15, fontWeight:500, color:'var(--gray-700)', marginBottom:4 }}>Bem-vinda!</p>
            <p style={{ fontSize:13, color:'var(--gray-500)', lineHeight:1.6 }}>Para personalizarmos seus agendamentos,<br/>precisamos saber seu nome.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Seu nome completo</label>
            <input className="form-input" type="text" placeholder="Ex.: Maria Silva"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleName()} autoFocus/>
          </div>
          {error && <p style={{ color:'var(--danger-600)', fontSize:13, marginBottom:12 }}>{error}</p>}
          <button className="btn btn-primary" style={{ background:bg }}
            onClick={handleName} disabled={loading || name.trim().length < 2}>
            {loading ? 'Salvando...' : 'Entrar'}
            <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize:16 }}/>
          </button>
        </>}
      </div>
    </div>
  )
}
