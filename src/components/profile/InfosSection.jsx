import React from 'react'
import { User, Calendar, Ruler } from 'lucide-react'
import { Row, SectionScreen, SaveBar } from './primitives'

// Écran de détail « Mes informations » : prénom, nom, âge, sexe, taille.
// L'email n'est plus ici (il est affiché une seule fois, dans l'en-tête du hub).
// Le poids et les mensurations ont leur propre entrée dans le hub.
export default function InfosSection({ prenom, nom, age, sexe, tailleCm, onChange, dirty, saving, onSave, onBack }) {
  return (
    <SectionScreen title="Mes informations" onBack={onBack}>
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <Row icon={<User size={18} />} label="Prénom">
          <input className="input-sm" style={{ width: 130, textAlign: 'left' }} value={prenom} onChange={e => onChange('prenom', e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<User size={18} />} label="Nom">
          <input className="input-sm" style={{ width: 130, textAlign: 'left' }} value={nom} onChange={e => onChange('nom', e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<Calendar size={18} />} label="Âge">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input className="input-sm" type="number" style={{ width: 64 }} value={age} onChange={e => onChange('age', e.target.value)} placeholder="—" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ans</span>
          </div>
        </Row>
        <Row icon={<User size={18} />} label="Sexe">
          <div style={{ display: 'flex', gap: 4 }}>
            {[['F', 'Femme'], ['H', 'Homme']].map(([key, label]) => (
              <button key={key} onClick={() => onChange('sexe', key)} style={{
                padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
                background: sexe === key ? 'var(--green)' : 'var(--gray-bg)',
                color: sexe === key ? 'white' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}>
                {label}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={<Ruler size={18} />} label="Taille">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input className="input-sm" type="number" style={{ width: 64 }} value={tailleCm} onChange={e => onChange('tailleCm', e.target.value)} placeholder="—" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>cm</span>
          </div>
        </Row>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
        Ces informations servent au calculateur de besoins caloriques (écran « Objectifs nutritionnels »).
      </div>

      <SaveBar visible={dirty} onSave={onSave} saving={saving} label="Enregistrer mes infos" />
    </SectionScreen>
  )
}
