import { useState, useEffect, useRef } from 'react'

export default function SalonGallery({ photos = [] }) {
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef(0)
  const intervalRef = useRef()
  const visible = photos.filter(p => p.url && p.active !== false)

  useEffect(() => {
    if (visible.length <= 1) return
    intervalRef.current = setInterval(() => setCurrent(c => (c+1) % visible.length), 4000)
    return () => clearInterval(intervalRef.current)
  }, [visible.length])

  if (visible.length === 0) return null

  function goTo(idx) { clearInterval(intervalRef.current); setCurrent(idx) }
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40)
      goTo(diff > 0 ? (current+1) % visible.length : (current-1+visible.length) % visible.length)
  }

  const photo = visible[current]

  return (
    <div style={{ position:'relative', height:200, overflow:'hidden', background:'var(--gray-100)' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <img src={photo.url} alt={photo.caption||'Salão'}
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
        onError={e => e.target.style.display='none'}/>
      {photo.caption && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,0.6))', padding:'24px 16px 12px' }}>
          <p style={{ color:'#fff', fontSize:13, fontWeight:500 }}>{photo.caption}</p>
        </div>
      )}
      {visible.length > 1 && (
        <div style={{ position:'absolute', bottom:10, left:0, right:0, display:'flex', justifyContent:'center', gap:6 }}>
          {visible.map((_,i) => (
            <div key={i} onClick={() => goTo(i)}
              style={{ width:i===current?18:7, height:7, borderRadius:99, background:i===current?'#fff':'rgba(255,255,255,0.5)', cursor:'pointer', transition:'all 0.25s' }}/>
          ))}
        </div>
      )}
      {visible.length > 1 && <>
        <button onClick={() => goTo((current-1+visible.length)%visible.length)}
          style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <button onClick={() => goTo((current+1)%visible.length)}
          style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
      </>}
    </div>
  )
}
