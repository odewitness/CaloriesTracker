import React from 'react'
import { Dumbbell, Info } from 'lucide-react'
import { Row, ToggleSwitch, Stepper, SectionScreen } from './primitives'

// ─────────────────────────────────────────────────────────────────────────────
// Écran de détail « Sport ».
// Palier 1 : activer/désactiver, objectif hebdomadaire (minutes / séances),
// affichage sur la page du jour et le calendrier. Le sport n'a AUCUN effet sur
// les objectifs de calories (ce sera les Paliers 6/7). Voir docs/suivi-sport.md.
// ─────────────────────────────────────────────────────────────────────────────
export default function SportSection({ sport, onPatch, onBack }) {
  const cfg = sport || {}
  const enabled = !!cfg.enabled
  const goalMin = Number(cfg.objectif_hebdo_minutes) || 0
  const goalSeances = Number(cfg.objectif_hebdo_seances) || 0

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

          <div className="section-title">Bilan énergétique</div>
          <div className="card" style={{ marginBottom: 8, overflow: 'hidden' }}>
            <Row label="Afficher le bilan du jour (indicatif)">
              <ToggleSwitch
                checked={cfg.mode_energie === 'bilan'}
                onClick={() => onPatch({ mode_energie: cfg.mode_energie === 'bilan' ? 'aucun' : 'bilan' })}
              />
            </Row>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
            Ajoute une ligne « mangé vs dépense estimée » dans le bloc Activité de
            la page du jour. C'est <strong>uniquement informatif</strong> : ton
            objectif de calories ne bouge pas, et ta dépense d'entretien inclut
            déjà une partie de ton activité (à ne pas cumuler avec tes séances).
          </div>

          <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.55, marginBottom: 24 }}>
            <Info size={26} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Les calories d'une séance sont estimées à partir du type, de la durée
              et de ton poids (±20 % environ) — tu peux les corriger. Elles ne
              modifient pas tes objectifs de calories. La connexion à Strava
              arrivera plus tard.
            </span>
          </div>
        </>
      )}
    </SectionScreen>
  )
}
