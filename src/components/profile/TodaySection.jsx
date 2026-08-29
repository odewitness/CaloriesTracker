import React from 'react'
import { Lightbulb } from 'lucide-react'
import { Row, ToggleSwitch, SectionScreen } from './primitives'

// Écran de détail « Page du jour » : ce qui s'affiche sur l'écran principal.
// Sauvegarde immédiate.
export default function TodaySection({ manquesEnabled, onToggleManques, onBack }) {
  return (
    <SectionScreen title="Page du jour" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <Row icon={<Lightbulb size={18} />} label="Manques du jour et suggestions">
          <ToggleSwitch checked={manquesEnabled} onClick={onToggleManques} />
        </Row>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5 }}>
        La carte « Eau » sur la page du jour se règle dans l'écran « Hydratation ».
      </div>
    </SectionScreen>
  )
}
