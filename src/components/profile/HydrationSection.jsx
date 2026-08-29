import React from 'react'
import { Bell, Droplet } from 'lucide-react'
import { WATER_DEFAULTS, suggestGoalMl, litres } from '../../lib/water'
import { Stepper, ToggleSwitch, SectionScreen } from './primitives'

const WATER_NOTIF_MODES = [
  { key: 'interval', label: 'Toutes les X heures', desc: 'Un rappel régulier pendant la journée' },
  { key: 'once', label: 'Une fois par jour', desc: "Un seul rappel, à l'heure de ton choix" },
  { key: 'smart', label: "Seulement si je n'ai pas assez bu", desc: "L'app vérifie et ne te dérange qu'au besoin" },
]

const hLabel = (h) => `${String(h).padStart(2, '0')}:00`

// Écran de détail « Hydratation » : objectif d'eau + rappels paramétrables.
// Réglages en sauvegarde immédiate (onPatch écrit directement).
export default function HydrationSection({ water, onPatch, weightKg, pushGranted, onBack }) {
  const w = { ...WATER_DEFAULTS, ...(water || {}) }
  const n = { ...WATER_DEFAULTS.notif, ...(water?.notif || {}) }
  const patchNotif = (patch) => onPatch({ notif: { ...n, ...patch } })
  const suggestion = suggestGoalMl(weightKg)

  return (
    <SectionScreen title="Hydratation" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
          <div style={{ color: 'var(--blue)', flexShrink: 0 }}><Droplet size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Objectif quotidien</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>eau + autres boissons</div>
          </div>
          <Stepper
            value={w.goal_ml} display={`${litres(w.goal_ml)} L`} wide
            min={500} max={5000}
            onDec={() => onPatch({ goal_ml: Math.max(500, w.goal_ml - 250) })}
            onInc={() => onPatch({ goal_ml: Math.min(5000, w.goal_ml + 250) })}
          />
        </div>
        <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 7, borderBottom: '0.5px solid var(--border)' }}>
          {[1500, 2000, 2500, 3000].map((ml) => (
            <button
              key={ml}
              onClick={() => onPatch({ goal_ml: ml })}
              className="chip"
              style={w.goal_ml === ml ? { background: 'var(--blue)', color: 'white' } : { background: 'var(--blue-light)', color: 'var(--blue-dark)' }}
            >
              {litres(ml)} L
            </button>
          ))}
        </div>
        {suggestion && (
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Selon ton poids ({weightKg} kg) : ~{litres(suggestion)} L / jour
            </div>
            {w.goal_ml !== suggestion && (
              <button
                onClick={() => onPatch({ goal_ml: suggestion })}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', fontFamily: 'var(--font)', flexShrink: 0 }}
              >
                Appliquer
              </button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 14 }}>Afficher la carte eau sur la page du jour</div>
          <ToggleSwitch checked={w.card_visible !== false} onClick={() => onPatch({ card_visible: !(w.card_visible !== false) })} />
        </div>
      </div>

      {/* Rappels */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12, borderBottom: n.enabled ? '0.5px solid var(--border)' : 'none' }}>
          <div style={{ color: 'var(--blue)', flexShrink: 0 }}><Bell size={18} /></div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Rappels d'hydratation</div>
          <ToggleSwitch checked={!!n.enabled} onClick={() => patchNotif({ enabled: !n.enabled })} />
        </div>

        {n.enabled && !pushGranted && (
          <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--coral)', lineHeight: 1.5 }}>
            Active d'abord les notifications dans l'écran « Notifications » pour recevoir ces rappels.
          </div>
        )}

        {n.enabled && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
              {WATER_NOTIF_MODES.map((m) => {
                const on = n.mode === m.key
                return (
                  <button
                    key={m.key}
                    onClick={() => patchNotif({ mode: m.key })}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                      padding: '10px 12px', borderRadius: 10, fontFamily: 'var(--font)',
                      border: `1.5px solid ${on ? 'var(--blue)' : 'var(--border)'}`,
                      background: on ? 'var(--blue-light)' : 'var(--white)',
                    }}
                  >
                    <span style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${on ? 'var(--blue)' : '#C4C4C4'}`, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)' }} />}
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: on ? 'var(--blue-dark)' : 'var(--text)' }}>{m.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{m.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {n.mode === 'interval' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>Fréquence</div>
                  <Stepper value={n.every_h} display={`${n.every_h} h`} min={1} max={8}
                    onDec={() => patchNotif({ every_h: Math.max(1, n.every_h - 1) })}
                    onInc={() => patchNotif({ every_h: Math.min(8, n.every_h + 1) })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>À partir de</div>
                  <Stepper value={n.start_h} display={hLabel(n.start_h)} min={0} max={n.end_h - 1} wide
                    onDec={() => patchNotif({ start_h: Math.max(0, n.start_h - 1) })}
                    onInc={() => patchNotif({ start_h: Math.min(n.end_h - 1, n.start_h + 1) })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>Jusqu'à</div>
                  <Stepper value={n.end_h} display={hLabel(n.end_h)} min={n.start_h + 1} max={23} wide
                    onDec={() => patchNotif({ end_h: Math.max(n.start_h + 1, n.end_h - 1) })}
                    onInc={() => patchNotif({ end_h: Math.min(23, n.end_h + 1) })} />
                </div>
              </div>
            )}

            {n.mode === 'once' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 13 }}>Heure du rappel</div>
                <Stepper value={n.once_h} display={hLabel(n.once_h)} min={0} max={23} wide
                  onDec={() => patchNotif({ once_h: Math.max(0, n.once_h - 1) })}
                  onInc={() => patchNotif({ once_h: Math.min(23, n.once_h + 1) })} />
              </div>
            )}

            {n.mode === 'smart' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>Vérifier à</div>
                  <Stepper value={n.smart_h} display={hLabel(n.smart_h)} min={0} max={23} wide
                    onDec={() => patchNotif({ smart_h: Math.max(0, n.smart_h - 1) })}
                    onInc={() => patchNotif({ smart_h: Math.min(23, n.smart_h + 1) })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>Me prévenir si je suis sous</div>
                  <Stepper value={n.smart_threshold} display={`${n.smart_threshold} %`} min={20} max={90}
                    onDec={() => patchNotif({ smart_threshold: Math.max(20, n.smart_threshold - 10) })}
                    onInc={() => patchNotif({ smart_threshold: Math.min(90, n.smart_threshold + 10) })} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
              <div style={{ flex: 1, fontSize: 13 }}>Ne plus rappeler une fois l'objectif atteint</div>
              <ToggleSwitch checked={n.stop_when_done !== false} onClick={() => patchNotif({ stop_when_done: !(n.stop_when_done !== false) })} />
            </div>
          </div>
        )}
      </div>
    </SectionScreen>
  )
}
