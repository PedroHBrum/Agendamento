import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const statusLabel = { confirmed:'Confirmado', pending:'Pendente', cancelled:'Cancelado', done:'Concluído' }
const statusClass = { confirmed:'badge-confirmed', pending:'badge-pending', cancelled:'badge-cancelled', done:'badge-done' }

export default function MyAppointmentsPage() {
  const { client } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [reviewModal, setReviewModal] = useState(null)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAppointments() }, [])

  async function fetchAppointments() {
    setLoading(true)
    const { data } = await supabase
      .from('appointments')
      .select('*, services(name,price,duration_min), professionals(name)')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
    setAppointments(data || [])
    setLoading(false)
  }

  async function cancelAppointment(id) {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
    setCancelConfirm(null)
    fetchAppointments()
  }

  async function submitReview() {
    if (!reviewModal) return
    setSaving(true)
    await supabase.from('appointments').update({
      rating, review: review.trim() || null,
      reviewed_at: new Date().toISOString()
    }).eq('id', reviewModal.id)
    setSaving(false)
    setReviewModal(null)
    setRating(5); setReview('')
    fetchAppointments()
  }

  function canCancel(ap) {
    return ap.status === 'confirmed' && new Date(ap.date + 'T' + ap.time) > new Date()
  }
  function canReview(ap) {
    return ap.status === 'done' && !ap.rating
  }

  if (loading) return <div className="loading">Carregando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Meus agendamentos</h2>
        <p style={{ fontSize:13, color:'var(--gray-500)', marginTop:4 }}>{appointments.length} no total</p>
      </div>

      {appointments.length === 0 && (
        <div className="empty">
          <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
          <p>Nenhum agendamento ainda.</p>
        </div>
      )}

      {appointments.map(ap => {
        const d = new Date(ap.date + 'T12:00:00')
        return (
          <div key={ap.id} className="card" style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <div style={{ background:'var(--primary-light)', borderRadius:'var(--radius-sm)', padding:'6px 10px', textAlign:'center', minWidth:44, flexShrink:0 }}>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--primary-text)', lineHeight:1 }}>{d.getDate()}</div>
              <div style={{ fontSize:11, color:'var(--primary-text)' }}>{MONTHS[d.getMonth()].slice(0,3)}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:500, fontSize:14 }}>{ap.services?.name}</div>
              <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>
                👩 {ap.professionals?.name || 'A definir'} · {ap.time?.slice(0,5)}
              </div>
              <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>
                💰 R$ {Number(ap.price_charged || ap.services?.price || 0).toFixed(2)}
              </div>
              <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span className={`badge ${statusClass[ap.status] || 'badge-done'}`}>{statusLabel[ap.status] || ap.status}</span>
                <span style={{ fontSize:11, color:'var(--gray-500)', fontFamily:'monospace' }}>{ap.code}</span>
              </div>
              {ap.rating && (
                <div style={{ marginTop:6, fontSize:13 }}>
                  {'⭐'.repeat(ap.rating)}
                  {ap.review && <span style={{ fontSize:12, color:'var(--gray-500)', marginLeft:4 }}>{ap.review}</span>}
                </div>
              )}

              {/* Botões de ação */}
              {(canCancel(ap) || canReview(ap)) && (
                <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                  {canCancel(ap) && cancelConfirm !== ap.id && (
                    <button className="tiny-btn danger"
                      onClick={() => setCancelConfirm(ap.id)}>
                      <i className="ti ti-x" aria-hidden="true"/> Cancelar
                    </button>
                  )}
                  {canReview(ap) && (
                    <button className="tiny-btn primary"
                      onClick={() => setReviewModal(ap)}>
                      <i className="ti ti-star" aria-hidden="true"/> Avaliar
                    </button>
                  )}
                </div>
              )}

              {/* Confirmar cancelamento inline (sem window.confirm) */}
              {cancelConfirm === ap.id && (
                <div style={{ marginTop:10, background:'var(--danger-light)', borderRadius:'var(--radius-sm)', padding:'10px 12px' }}>
                  <p style={{ fontSize:13, color:'var(--danger)', fontWeight:500, marginBottom:8 }}>
                    Confirmar cancelamento?
                  </p>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-outline" style={{ flex:1, padding:'6px', fontSize:12 }}
                      onClick={() => setCancelConfirm(null)}>
                      Não
                    </button>
                    <button style={{ flex:1, padding:'6px', fontSize:12, background:'var(--danger)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}
                      onClick={() => cancelAppointment(ap.id)}>
                      Sim, cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Modal de avaliação */}
      {reviewModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'flex-end', zIndex:100 }}>
          <div style={{ background:'#fff', borderRadius:'16px 16px 0 0', padding:'1.5rem', width:'100%', maxWidth:480, margin:'0 auto' }}>
            <h3 style={{ marginBottom:4 }}>Avaliar serviço</h3>
            <p style={{ fontSize:13, color:'var(--gray-500)', marginBottom:16 }}>{reviewModal.services?.name}</p>
            <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'center' }}>
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ fontSize:36, cursor:'pointer', opacity: n <= rating ? 1 : 0.3, transition:'opacity 0.15s' }}
                  onClick={() => setRating(n)}>⭐</span>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Comentário (opcional)</label>
              <input className="form-input" placeholder="Como foi o atendimento?" value={review}
                onChange={e => setReview(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
              <button className="btn btn-outline" onClick={() => setReviewModal(null)} style={{ flex:1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={submitReview} disabled={saving} style={{ flex:1 }}>
                {saving ? 'Enviando...' : 'Enviar avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
