import React from 'react'
import { Dumbbell, Info } from 'lucide-react'
import { Row, ToggleSwitch, Stepper, SectionScreen } from './primitives'
import { sportBaseFrom } from '../../lib/sport'
import { ACTIVITY_LEVELS } from '../../lib/nutrients'

// ─────────────────────────────────────────────────────────────────────────────
// Écran de détail « Sport ».
// - Activer/désactiver, objectifs hebdo, affichage (Paliers 1–2).
// - Calories & sport (Paliers 6–7) : 'aucun' (défaut) | 'bilan' (lecture seule)
//   | 'manger_selon_effort' (bascule de modèle, très encadrée).
// Voir docs/suivi-sport.md §3.2 et §8.
// ─────────────────────────────────────────────────────────────────────────────
const ENERGY_MODES = [
  { key: 'aucun', label: 'Aucun' },
  { key: 'bilan', label: 'Bilan indicatif' },
  { key: 'manger_selon_effort', label: 'Manger selon l\'effort' },
]

export default function SportSection({ sport, goalKcal, profile, weightKg, onPatch, onBack }) {
  const cfg = sport || {}
  const enabled = !!cfg.enabled
  const goalMin = Number(cfg.objectif_hebdo_minutes) || 0
  const goalSeances = Number(cfg.objectif_hebdo_seances) || 0
  const mode = cfg.mode_energie || 'aucun'

  const effortBase = sportBaseFrom({ goalKcal, profile, weightKg })
  const activityKey = profile?.niveau_activite
  const activityLabel = ACTIVITY_LEVELS.find(a => a.key === activityKey)?.label
  const highActivity = activityKey && activityKey !== 'sedentaire' && activityKey !== 'leger'
  const cap = Number(cfg.depense_max_creditee_kcal) || 400

  return (
    <SectionScreen title="Sport" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <Row icon={<Dumbbell size={18} />} label="Activer le suivi du sport">
          <ToggleSwitch checked={enabled} onClick={() => onPatch({ enabled: !enabled })} />
        </Row>
      </div>

      {!enabled && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Tu notes toi-même tes séances (type, durée, ressenti). CaloriesTracker
          les affiche sur ta page du jour et ton calendrier, et suit tes minutes
          actives de la semaine. Les calories dépensées sont une estimation
          indicative : elles ne changent pas tes objectifs.
        </div>
      )}

      {enabled && (
        <>
          <div className="section-title">Objectif de la semaine</div>
          <div className="card" style={{ marginBottom: 8, overflow: 'hidden' }}>
            <Row label="Minutes actives par semaine">
              <Stepper
                value={goalMin}
                display={goalMin > 0 ? `${goalMin} min` : 'Aucun'}
                min={0} max={600} wide
                onDec={() => onPatch({ objectif_hebdo_minutes: Math.max(0, goalMin - 15) })}
                onInc={() => onPatch({ objectif_hebdo_minutes: Math.min(600, goalMin + 15) })}
              />
            </Row>
            <Row label="Nombre de séances par semaine">
              <Stepper
                value={goalSeances}
                display={goalSeances > 0 ? `${goalSeances}` : 'Aucun'}
                min={0} max={14}
                onDec={() => onPatch({ objectif_hebdo_seances: Math.max(0, goalSeances - 1) })}
                onInc={() => onPatch({ objectif_hebdo_seances: Math.min(14, goalSeances + 1) })}
              />
            </Row>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
            Un repère, pas une contrainte : rien ne se passe si tu ne l'atteins
            pas. Mets « Aucun » pour masquer la jauge. L'OMS suggère au moins
            150 min d'activité modérée par semaine.
          </div>

          <div className="section-title">Affichage</div>
          <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <Row label="Bloc « Activité » sur la page du jour">
              <ToggleSwitch
                checked={cfg.afficher_page_jour !== false}
                onClick={() => onPatch({ afficher_page_jour: !(cfg.afficher_page_jour !== false) })}
              />
            </Row>
            <Row label="Marquer le calendrier">
              <ToggleSwitch
                checked={cfg.afficher_calendrier !== false}
                onClick={() => onPatch({ afficher_calendrier: !(cfg.afficher_calendrier !== false) })}
              />
            </Row>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
            Sur la page du jour, tu peux régler l'ordre du bloc « Activité »
            depuis Profil › Page du jour.
          </div>

          <div className="section-title">Calories &amp; sport</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {ENERGY_MODES.map(m => {
              const disabled = m.key === 'manger_selon_effort' && !effortBase
              const active = mode === m.key
              return (
                <button
                  key={m.key}
                  onClick={() => !disabled && onPatch({ mode_energie: m.key })}
                  className="chip"
                  style={{
                    flex: 1, textAlign: 'center', fontSize: 11, padding: '6px 4px',
                    background: active ? 'var(--green)' : 'var(--green-light)',
                    color: active ? 'white' : 'var(--green-dark)',
                    opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>

          {mode === 'aucun' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
              Le sport n'a aucun effet sur tes objectifs de calories. Recommandé si
              tu ne veux pas te prendre la tête avec ça.
            </div>
          )}

          {mode === 'bilan' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
              Ajoute une ligne « mangé vs dépense estimée » dans le bloc Activité de
              la page du jour. <strong>Uniquement informatif</strong> : ton objectif
              de calories ne bouge pas, et ta dépense d'entretien inclut déjà une
              partie de ton activité (à ne pas cumuler avec tes séances).
            </div>
          )}

          {mode === 'manger_selon_effort' && (
            <>
              {!effortBase ? (
                <div style={{ fontSize: 11.5, color: 'var(--coral)', lineHeight: 1.5, marginBottom: 16 }}>
                  Il manque des infos dans ton profil (sexe, âge, taille, poids,
                  niveau d'activité) pour calculer ta base. Complète « Mes
                  informations », ce mode s'appliquera ensuite.
                </div>
              ) : (
                <>
                  <div className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      Les jours <strong>sans séance</strong> : objectif ≈{' '}
                      <strong style={{ color: 'var(--text)' }}>{effortBase.base} kcal</strong>{' '}
                      <span style={{ color: 'var(--text-hint)' }}>(au lieu de {goalKcal})</span>.<br />
                      Les jours <strong>de séance</strong> : {effortBase.base} + tes calories
                      dépensées, plafonné à <strong>+{cap}</strong>.
                    </div>
                  </div>
                  <div className="card" style={{ marginBottom: 8, overflow: 'hidden' }}>
                    <Row label="Plafond crédité par jour">
                      <Stepper
                        value={cap}
                        display={`+${cap} kcal`}
                        min={100} max={700} wide
                        onDec={() => onPatch({ depense_max_creditee_kcal: Math.max(100, cap - 50) })}
                        onInc={() => onPatch({ depense_max_creditee_kcal: Math.min(700, cap + 50) })}
                      />
                    </Row>
                  </div>
                  {highActivity && (
                    <div style={{ fontSize: 11.5, color: 'var(--amber)', lineHeight: 1.5, marginBottom: 8, background: 'var(--amber-light, #fef3c7)', borderRadius: 8, padding: '8px 10px' }}>
                      Ton niveau d'activité «&nbsp;{activityLabel}&nbsp;» suppose déjà
                      plusieurs séances par semaine : les jours sans sport, ton
                      objectif baisse nettement (−{effortBase.activityBakedIn} kcal).
                      Si ça te paraît trop, choisis un niveau d'activité plus bas dans
                      le calculateur de besoins.
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
                    Base scientifique modeste, estimation des calories ±25 %. Ne
                    s'applique <strong>que sur la page du jour</strong> — l'Historique
                    et le calendrier gardent ton objectif à plat. Ton objectif ne
                    descend jamais sous {effortBase.floor} kcal. Désactivable en un geste.
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.55, marginTop: 8, marginBottom: 24 }}>
            <Info size={26} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Les calories d'une séance sont estimées à partir du type, de la durée
              et de ton poids (±20 % environ) — tu peux les corriger à la saisie.
            </span>
          </div>
        </>
      )}
    </SectionScreen>
  )
}
