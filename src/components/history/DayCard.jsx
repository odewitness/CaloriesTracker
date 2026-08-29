import React from 'react'
import { EyeOff } from 'lucide-react'
import { dayStatus, STATUS_COLOR } from '../../lib/history'

// Carte d'un jour dans le détail des onglets Semaine / Mois. `id` permet au
// graphique de tendance de scroller jusqu'ici ; `highlight` déclenche un halo
// bref après le clic sur la barre correspondante.
export default function DayCard({ dateStr, entries, goalKcal, excluded, highlight }) {
  const kcal = entries.reduce((s, e) => s + (e.energie_kcal || 0), 0)
  const prot = entries.reduce((s, e) => s + (e.proteines || 0), 0)
  const gluc = entries.reduce((s, e) => s + (e.glucides || 0), 0)
  const lip  = entries.reduce((s, e) => s + (e.lipides || 0), 0)
  const diff = Math.round(kcal - goalKcal)
  const pct  = Math.min(100, (kcal / goalKcal) * 100)
  const color = STATUS_COLOR[dayStatus(kcal, goalKcal)] || 'var(--green)'

  const d = new Date(dateStr + 'T12:00:00')
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <div
      id={`hist-day-${dateStr}`}
      className="card"
      style={{
        padding: '13px 16px', marginBottom: 8, opacity: excluded ? 0.55 : 1,
        outline: highlight ? '2px solid var(--green)' : '2px solid transparent',
        transition: 'outline-color .3s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{label}</div>
            {excluded && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', background: 'var(--gray-bg)', borderRadius: 6, padding: '2px 6px' }}>
                <EyeOff size={9} /> Exclu
              </span>
            )}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 1 }}>{Math.round(kcal)} kcal</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            <span className="c-prot">P {Math.round(prot)}g</span>&nbsp;
            <span className="c-gluc">G {Math.round(gluc)}g</span>&nbsp;
            <span className="c-lip">L {Math.round(lip)}g</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{diff <= 0 ? `−${Math.abs(diff)}` : `+${diff}`} kcal</div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>{entries.length} aliment{entries.length > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
    </div>
  )
}
