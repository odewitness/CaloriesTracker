import React from 'react'
import { Bell, Plus, X } from 'lucide-react'
import { ToggleSwitch, Stepper } from './profile/primitives'
import { WEEKDAYS } from './CalendarMonthGrid'
import { mergeReminder, hLabel } from '../lib/complementReminders'

// ─────────────────────────────────────────────────────────────────────────────
// ComplementReminderEditor — éditeur du `rappel` d'un complément, partagé entre
// la fiche complément (CustomFoodsSection), l'écran récap
// (ComplementRemindersSection) et la planification calendrier (PlanMealModal).
//
// value    — objet `rappel` (ou null) ; onChange reçoit l'objet normalisé complet
// pushGranted — si false, affiche un encart « active d'abord les notifications »
// compact  — masque le toggle « déjà noté » (utilisé dans PlanMealModal)
// ─────────────────────────────────────────────────────────────────────────────
export default function ComplementReminderEditor({ value, onChange, pushGranted, compact }) {
  const r = mergeReminder(value)
  const emit = (patch) => onChange(mergeReminder({ ...r, ...patch }))

  const addHeure = () => {
    const used = new Set(r.heures)
    let h = 8
    while (used.has(h) && h < 23) h++
    emit({ heures: [...r.heures, h] })
  }
  const setHeure = (i, h) => emit({ heures: r.heures.map((x, idx) => (idx === i ? h : x)) })
  const removeHeure = (i) => {
    if (r.heures.length <= 1) return
    emit({ heures: r.heures.filter((_, idx) => idx !== i) })
  }
  const toggleJour = (d) => {
    const set = new Set(r.jours)
    if (set.has(d)) set.delete(d); else set.add(d)
    emit({ jours: [...set] })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: 'var(--purple, #8b5cf6)', flexShrink: 0 }}><Bell size={18} /></div>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Me rappeler de le prendre</div>
        <ToggleSwitch checked={r.enabled} onClick={() => emit({ enabled: !r.enabled })} />
      </div>

      {r.enabled && !pushGranted && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--coral)', lineHeight: 1.5 }}>
          Active d'abord les notifications dans l'écran « Notifications » pour recevoir ces rappels.
        </div>
      )}

      {r.enabled && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            Horaires
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {r.heures.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Stepper
                  value={h} display={hLabel(h)} min={0} max={23} wide
                  onDec={() => setHeure(i, Math.max(0, h - 1))}
                  onInc={() => setHeure(i, Math.min(23, h + 1))}
                />
                {r.heures.length > 1 && (
                  <button
                    onClick={() => removeHeure(i)}
                    aria-label="Retirer cet horaire"
                    style={{ color: 'var(--text-hint)', flexShrink: 0, display: 'flex' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addHeure}
            style={{ marginTop: 8, color: 'var(--purple, #8b5cf6)', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={14} /> Ajouter un horaire
          </button>

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '16px 0 8px' }}>
            Jours
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {WEEKDAYS.map((w, i) => {
              const on = r.jours.length === 0 || r.jours.includes(i)
              const explicit = r.jours.includes(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleJour(i)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8,
                    background: explicit ? 'var(--green)' : 'var(--gray-bg)',
                    color: explicit ? 'white' : on ? 'var(--text-muted)' : 'var(--text-hint)',
                    fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
                  }}
                >
                  {w}
                </button>
              )
            })}
          </div>
          {r.jours.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 6 }}>
              Aucun jour coché = tous les jours
            </div>
          )}

          {!compact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
              <div style={{ flex: 1, fontSize: 13 }}>Ne pas me rappeler si je l'ai déjà noté ce jour-là</div>
              <ToggleSwitch checked={r.stop_si_pris} onClick={() => emit({ stop_si_pris: !r.stop_si_pris })} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
