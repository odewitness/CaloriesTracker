import React from 'react'
import { MoreHorizontal } from 'lucide-react'

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
// Présenté en BANDE FINE et non en carte : c'est un raccourci, pas le contenu
// de la page. Sur mobile, l'ancienne carte (titre + paragraphe + grille de
// pastilles + séparateur + seconde pastille) poussait les premiers résultats
// hors de l'écran — soit exactement ce qu'on vient chercher ici. Les pastilles
// et le filtre calorique tiennent donc sur une seule ligne qui défile
// horizontalement, sans texte explicatif : le geste (appuyer sur un nutriment)
// se comprend en l'essayant, et son effet reste lisible juste en dessous dans
// les critères actifs.
//
// Props :
//   gaps              — sortie de getNutrientGaps() : [{ field, pct }], déjà
//                        plafonnée aux quelques pires manques (voir ExplorerPage)
//   hasMoreGaps        — true s'il existe d'autres manques au-delà de `gaps`
//                        (la bande n'en montre qu'une poignée, cf. limite dans
//                        getNutrientGaps) — affiche alors le bouton « … »
//   onShowAllGaps()    — ouvre la liste complète des manques du jour
//   hasEntries        — false si rien n'est encore noté aujourd'hui
//   remainingKcal     — calories restantes sur l'objectif du jour (null si pas d'objectif)
//   activeClaims      — clés de nutriments déjà filtrées (pour l'état actif des pastilles)
//   onPickGap(key)    — bascule le filtre « riche en <nutriment> » + le tri dessus
//   fitsRemainingKcal / onToggleFits — filtre « tient dans mes calories restantes »
// ─────────────────────────────────────────────────────────────────────────────
export default function NutrientGapsBanner({
  gaps, hasMoreGaps, onShowAllGaps, hasEntries, remainingKcal, activeClaims, onPickGap, fitsRemainingKcal, onToggleFits,
}) {
  const showKcalToggle = remainingKcal != null && remainingKcal > 0

  // Rien à combler et pas d'objectif calorique : la bande n'aurait aucun
  // contenu, on ne réserve pas d'espace pour un en-tête vide.
  if (gaps.length === 0 && !showKcalToggle && hasEntries) return null

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6,
      }}>
        À combler aujourd'hui
      </div>

      {/* Les deux états sans manque tiennent en une ligne : l'ancienne version
          y consacrait un paragraphe de trois lignes. */}
      {!hasEntries ? (
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: showKcalToggle ? 8 : 0 }}>
          Rien de noté aujourd'hui — explore librement.
        </div>
      ) : gaps.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--green-dark)', marginBottom: showKcalToggle ? 8 : 0 }}>
          Tous tes apports sont au niveau 👏
        </div>
      )}

      {(gaps.length > 0 || showKcalToggle) && (
        <div className="chip-scroller">
          {gaps.map(({ field, pct }) => {
            const active = activeClaims.includes(field.key)
            return (
              <button
                key={field.key}
                className="chip"
                onClick={() => onPickGap(field.key)}
                style={active ? { background: 'var(--green)', color: 'var(--white)' } : null}
              >
                {field.label}
                <span style={{ marginLeft: 5, opacity: 0.65, fontWeight: 500 }}>{pct} %</span>
              </button>
            )
          })}

          {/* La bande n'affiche qu'une poignée de manques (voir la limite
              passée à getNutrientGaps côté ExplorerPage) — sans ce bouton,
              rien n'indique qu'il en existe d'autres, ni comment les
              atteindre en dehors des deux feuilles de réglages générales. */}
          {hasMoreGaps && (
            <button
              className="chip"
              onClick={onShowAllGaps}
              style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}
              aria-label="Voir tous les manques du jour"
            >
              <MoreHorizontal size={14} />
            </button>
          )}

          {/* Rangé dans la même bande que les manques : c'est un critère de
              même nature (« ce qui me va aujourd'hui »), et il n'a pas besoin
              d'un bloc séparé sous une ligne de séparation. */}
          {showKcalToggle && (
            <button
              className="chip"
              onClick={onToggleFits}
              style={{
                background: fitsRemainingKcal ? 'var(--green)' : 'var(--gray-bg)',
                color:      fitsRemainingKcal ? 'var(--white)' : 'var(--text-muted)',
              }}
            >
              {fitsRemainingKcal ? '✓ ' : ''}Tient dans mes {Math.round(remainingKcal)} kcal
            </button>
          )}
        </div>
      )}
    </div>
  )
}
