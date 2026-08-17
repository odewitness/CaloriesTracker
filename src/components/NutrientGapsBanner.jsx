import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// NutrientGapsBanner — en-tête de l'explorateur : les nutriments les plus en
// retard sur la journée en cours, cliquables pour filtrer directement la liste.
//
// C'est ce qui différencie l'explorateur d'un simple navigateur de base de
// données : au lieu de partir d'une liste vide à régler soi-même, on part de
// ce qui manque réellement aujourd'hui. Les données viennent de computeTotals()
// (déjà calculé pour la page Aujourd'hui) et des RNP de VITAMIN_FIELDS /
// MINERAL_FIELDS — rien de nouveau à saisir.
//
// `.card` n'a pas de padding dans index.css (chaque usage pose le sien) :
// il est donc défini ici, comme dans CalorieRing ou CalendarWeekStrip.
//
// Props :
//   gaps              — sortie de getNutrientGaps() : [{ field, pct }]
//   hasEntries        — false si rien n'est encore noté aujourd'hui
//   remainingKcal     — calories restantes sur l'objectif du jour (null si pas d'objectif)
//   activeClaims      — clés de nutriments déjà filtrées (pour l'état actif des pastilles)
//   onPickGap(key)    — bascule le filtre « riche en <nutriment> » + le tri dessus
//   fitsRemainingKcal / onToggleFits — filtre « tient dans mes calories restantes »
// ─────────────────────────────────────────────────────────────────────────────
export default function NutrientGapsBanner({
  gaps, hasEntries, remainingKcal, activeClaims, onPickGap, fitsRemainingKcal, onToggleFits,
}) {
  const showKcalToggle = remainingKcal != null && remainingKcal > 0

  return (
    <div className="card" style={{ padding: '16px 16px 18px', marginBottom: 14 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>
        Ce qui te manque aujourd'hui
      </div>

      {!hasEntries ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
          Tu n'as encore rien noté aujourd'hui. Explore librement — ou reviens ici
          après ton premier repas pour voir ce qu'il te reste à combler.
        </div>
      ) : gaps.length === 0 ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--green-dark)' }}>
          Tous tes apports sont au niveau. Rien à combler pour l'instant 👏
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {gaps.map(({ field, pct }) => {
              const active = activeClaims.includes(field.key)
              return (
                <button
                  key={field.key}
                  className="chip"
                  onClick={() => onPickGap(field.key)}
                  style={{
                    padding: '7px 13px',
                    ...(active ? { background: 'var(--green)', color: 'var(--white)' } : null),
                  }}
                >
                  {field.label}
                  <span style={{ marginLeft: 5, opacity: 0.7, fontWeight: 500 }}>{pct} %</span>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-hint)', marginTop: 12 }}>
            Touche un nutriment : la liste ne garde que les aliments qui en sont
            riches, du plus riche au moins riche.
          </div>
        </>
      )}

      {showKcalToggle && (
        <>
          <div style={{ height: 0.5, background: 'var(--border)', margin: '14px -16px 12px' }} />
          <button
            className="chip"
            onClick={onToggleFits}
            style={{
              padding: '7px 13px',
              background: fitsRemainingKcal ? 'var(--green)' : 'var(--gray-bg)',
              color:      fitsRemainingKcal ? 'var(--white)' : 'var(--text-muted)',
            }}
          >
            {fitsRemainingKcal ? '✓ ' : ''}Tient dans mes {Math.round(remainingKcal)} kcal restantes
          </button>
        </>
      )}
    </div>
  )
}
