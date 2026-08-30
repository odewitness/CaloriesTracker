import React, { useState } from 'react'
import { ToggleSwitch } from './profile/primitives'
import { PERIOD_FLOW, PERIOD_SYMPTOMS } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// CyclePeriodDayLog (Palier 8) — saisie du jour, dans la pastille de phase de
// la page du jour : marquer/retirer CE jour comme jour de règles, son
// intensité de flux, et ses symptômes (prédéfinis + texte libre). Contrairement
// à CycleSection (Profil), qui saisit l'intensité par bloc entier, ici tout
// porte sur `dateStr` uniquement — un seul jour à la fois.
// Données privées : la table `regles` est filtrée par RLS "own", donc
// invisibles pour quiconque d'autre.
// ─────────────────────────────────────────────────────────────────────────────
export default function CyclePeriodDayLog({ isPeriodDay, intensite, symptomes, onToggleDay, onSetIntensite, onSetSymptomes }) {
  const [customText, setCustomText] = useState('')
  const list = symptomes || []
  const customEntries = list.filter(s => !PERIOD_SYMPTOMS.some(p => p.key === s))

  const toggleSymptom = (key) => {
    onSetSymptomes(list.includes(key) ? list.filter(s => s !== key) : [...list, key])
  }
  const removeCustom = (s) => onSetSymptomes(list.filter(x => x !== s))
  const addCustom = () => {
    const v = customText.trim()
    if (!v || list.includes(v)) return
    onSetSymptomes([...list, v])
    setCustomText('')
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontSize: 11.5, fontWeight: 700 }}>Jour de règles</div>
        <ToggleSwitch checked={isPeriodDay} onClick={onToggleDay} />
      </div>

      {isPeriodDay && (
        <>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginBottom: 5 }}>Intensité du flux</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PERIOD_FLOW.map(f => (
                <button
                  key={f.key}
                  onClick={() => onSetIntensite(intensite === f.key ? null : f.key)}
                  className="chip"
                  style={{
                    flex: 1, textAlign: 'center', padding: '4px 6px', fontSize: 10.5,
                    background: intensite === f.key ? 'var(--coral)' : 'var(--gray-bg)',
                    color: intensite === f.key ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginBottom: 5 }}>
              Symptômes — visible seulement par toi
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {PERIOD_SYMPTOMS.map(s => {
                const active = list.includes(s.key)
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSymptom(s.key)}
                    className="chip"
                    style={{
                      fontSize: 10.5, padding: '4px 8px',
                      background: active ? 'var(--purple, #8b5cf6)' : 'var(--gray-bg)',
                      color: active ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
              {customEntries.map(s => (
                <button
                  key={s}
                  onClick={() => removeCustom(s)}
                  className="chip"
                  style={{ fontSize: 10.5, padding: '4px 8px', background: 'var(--purple, #8b5cf6)', color: 'white' }}
                  title="Touche pour retirer"
                >
                  {s} ✕
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                placeholder="Autre symptôme…"
                style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 11.5, fontFamily: 'var(--font)', background: 'var(--gray-bg)', outline: 'none' }}
              />
              <button
                onClick={addCustom}
                disabled={!customText.trim()}
                className="chip"
                style={{ fontSize: 10.5, padding: '4px 10px', opacity: customText.trim() ? 1 : 0.5 }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
