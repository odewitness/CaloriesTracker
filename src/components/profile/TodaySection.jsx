import React from 'react'
import { Lightbulb, ArrowUp, ArrowDown } from 'lucide-react'
import { Row, ToggleSwitch, SectionScreen } from './primitives'
import { TODAY_SECTION_LABELS } from '../../lib/todaySections'

// Écran de détail « Page du jour » : ce qui s'affiche sur l'écran principal.
// Sauvegarde immédiate.
export default function TodaySection({ manquesEnabled, onToggleManques, sectionsOrder, onReorder, onBack }) {
  const move = (from, to) => {
    if (to < 0 || to >= sectionsOrder.length) return
    const next = [...sectionsOrder]
    const [k] = next.splice(from, 1)
    next.splice(to, 0, k)
    onReorder(next)
  }

  return (
    <SectionScreen title="Page du jour" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <Row icon={<Lightbulb size={18} />} label="Manques du jour et suggestions">
          <ToggleSwitch checked={manquesEnabled} onClick={onToggleManques} />
        </Row>
      </div>

      <div className="section-title">Ordre des sections</div>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        {sectionsOrder.map((key, i) => (
          <div
            key={key}
            style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}
          >
            <div style={{ flex: 1, fontSize: 14 }}>{TODAY_SECTION_LABELS[key] || key}</div>
            <button
              onClick={() => move(i, i - 1)}
              disabled={i === 0}
              aria-label="Monter"
              style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: i === 0 ? 0.35 : 1 }}
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => move(i, i + 1)}
              disabled={i === sectionsOrder.length - 1}
              aria-label="Descendre"
              style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: i === sectionsOrder.length - 1 ? 0.35 : 1 }}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5 }}>
        L'ordre choisi s'applique à tous les jours. Chaque bloc n'apparaît que
        s'il a du contenu : « Phase du cycle » si le suivi de cycle est activé,
        « Activité » si le suivi du sport est activé, « À combler aujourd'hui »
        le jour même et si l'option ci-dessus est activée. La carte « Eau » se
        masque depuis l'écran « Hydratation ».
      </div>
    </SectionScreen>
  )
}
