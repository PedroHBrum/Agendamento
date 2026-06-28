import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function ImageUpload({ bucket, currentUrl, onUpload, label='Foto', size=72, round=true }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
  const [error, setError] = useState('')
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Selecione uma imagem (JPG, PNG...)'); return }
    if (file.size > 5*1024*1024) { setError('Imagem muito grande. Máximo 5MB.'); return }
    setError(''); setUploading(true)
    try {
      setPreview(URL.createObjectURL(file))
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error: upErr } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl:'3600', upsert:false })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
      setPreview(urlData.publicUrl)
      onUpload(urlData.publicUrl)
    } catch(e) {
      setError('Erro ao enviar: ' + (e.message||'tente novamente'))
      setPreview(currentUrl||'')
    } finally { setUploading(false) }
  }

  const br = round ? '50%' : 10

  return (
    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <div onClick={() => !uploading && inputRef.current?.click()}
          style={{ width:size, height:size, borderRadius:br, border:'2px dashed var(--gray-300)', background:'var(--gray-50)', display:'flex', alignItems:'center', justifyContent:'center', cursor:uploading?'wait':'pointer', overflow:'hidden', position:'relative' }}>
          {preview
            ? <img src={preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => setPreview('')}/>
            : <div style={{ textAlign:'center' }}>
                <i className="ti ti-camera" aria-hidden="true" style={{ fontSize:22, color:'var(--gray-300)', display:'block', marginBottom:2 }}/>
                <span style={{ fontSize:10, color:'var(--gray-300)' }}>Toque</span>
              </div>
          }
          {uploading && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:br }}>
              <i className="ti ti-loader-2" aria-hidden="true" style={{ fontSize:20, color:'#fff', animation:'spin 1s linear infinite' }}/>
            </div>
          )}
        </div>
        {preview && !uploading && (
          <button onClick={() => { setPreview(''); onUpload(''); if(inputRef.current) inputRef.current.value='' }}
            style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'var(--danger-600)', border:'2px solid #fff', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>✕</button>
        )}
      </div>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:13, fontWeight:500, color:'var(--gray-700)', marginBottom:4 }}>{label}</p>
        <button onClick={() => !uploading && inputRef.current?.click()} disabled={uploading}
          style={{ fontSize:12, padding:'6px 12px', border:'0.5px solid var(--gray-300)', borderRadius:'var(--radius-sm)', background:'#fff', color:'var(--gray-700)', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-upload" aria-hidden="true" style={{ fontSize:14 }}/>
          {uploading ? 'Enviando...' : preview ? 'Trocar foto' : 'Escolher foto'}
        </button>
        <p style={{ fontSize:10, color:'var(--gray-500)', marginTop:4 }}>JPG ou PNG · máx 5MB</p>
        {error && <p style={{ fontSize:11, color:'var(--danger-600)', marginTop:4 }}>{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile}/>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
