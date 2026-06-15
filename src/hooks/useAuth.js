import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const isDev = process.env.NODE_ENV === 'development'

export function AuthProvider({ children }) {
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('salon_client')
      if (stored) setClient(JSON.parse(stored))
    } catch(e) {}
    setLoading(false)
  }, [])

  async function getSettings(...keys) {
    try {
      const { data } = await supabase.from('salon_settings').select('key,value').in('key', keys)
      return Object.fromEntries((data||[]).map(r => [r.key, r.value]))
    } catch(e) { return {} }
  }

  async function sendWhatsApp(phone, message) {
    const cfg = await getSettings('whatsapp_api_url','whatsapp_api_key','whatsapp_instance')
    if (!cfg.whatsapp_api_url) {
      if (isDev) console.log('[DEV] WhatsApp para', phone, ':', message)
      return
    }
    try {
      await fetch(`${cfg.whatsapp_api_url}/message/sendText/${cfg.whatsapp_instance}`, {
        method: 'POST',
        headers: { 'apikey': cfg.whatsapp_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: `55${phone}`, text: message })
      })
    } catch(e) {
      if (isDev) console.error('WhatsApp error:', e)
    }
  }

  async function sendOTP(phone) {
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { data, error } = await supabase.from('clients')
      .upsert({ phone, otp, otp_expires_at: expires }, { onConflict: 'phone' })
      .select().single()
    if (error) throw error
    const cfg = await getSettings('salon_name')
    await sendWhatsApp(phone,
      `Olá! Seu código de acesso para *${cfg.salon_name || 'o salão'}* é: *${otp}*\n\nVálido por 10 minutos. Não compartilhe.`
    )
    // Mostra OTP na tela enquanto WhatsApp não configurado
    if (!cfg.whatsapp_api_url) sessionStorage.setItem('_otp_temp', otp)
  }

  async function verifyOTP(phone, otp) {
    const { data, error } = await supabase.from('clients').select('*')
      .eq('phone', phone).eq('otp', otp)
      .gte('otp_expires_at', new Date().toISOString()).single()
    if (error || !data) throw new Error('Código inválido ou expirado')
    await supabase.from('clients').update({ otp: null }).eq('id', data.id)
    const clientData = { id: data.id, name: data.name, phone: data.phone }
    setClient(clientData)
    localStorage.setItem('salon_client', JSON.stringify(clientData))
    return clientData
  }

  async function updateName(name) {
    if (!client) return
    const { error } = await supabase.from('clients').update({ name }).eq('id', client.id)
    if (error) throw error
    const updated = { ...client, name }
    setClient(updated)
    localStorage.setItem('salon_client', JSON.stringify(updated))
  }

  function logout() {
    setClient(null)
    try { localStorage.removeItem('salon_client') } catch(e) {}
  }

  return (
    <AuthContext.Provider value={{ client, loading, sendOTP, verifyOTP, updateName, logout, sendWhatsApp, getSettings }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
