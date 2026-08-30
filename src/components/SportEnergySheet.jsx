import React from 'react'
import { createPortal } from 'react-dom'
import { Activity } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// SportEnergySheet — feuille de détail (LECTURE SEULE) du bilan d'énergie du
// jour, ouverte depuis la ligne sous l'anneau de calories (TodayOverviewCard).
// Reprend mot pour mot les textes qui vivaient dans SportSection (blocs
// « Bilan du jour » / « Objectif du jour · manger selon l'effort »), garde-fous
// du §8 de docs/suivi-sport.md compris. Ne modifie aucun objectif.
//
// Rendu via portal sur document.body : montée dans le slider de jours de
// TodayPage (voir CLAUDE.md — pattern d'AddWaterSheet / StepsSheet).
//
// Props :
//   mode         — 'bilan' | 'manger_selon_effort'
//   consumedKcal — kcal mangées ce jour
//   bilan        — retour de dayEnergyBalance(...) ou null (profil incomplet)
//   activity     — dayActivityKcal(...) : { total, pas, seances, hasSteps, seancesDansPas }
//   adjust       — { delta, base, credit, goal, applied } (mode effort)
//   cycleKcalDelta — supplément calorique du cycle (phase lutéale) déjà inclus
//                    dans adjust.base ; sert à isoler la base « habituelle »
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function SportEnergySheet({ mode, consumedKcal, bilan, activity, adjust, cycleKcalDelta = 0, onClose }) {
  useBackButton(onClose)

  const isEffort = mode === 'manger_selon_effort'
  const activityKcalToday = activity?.total ?? 0
  const k = (n) => Math.round(n).toLocaleString('fr-FR')
  // adjust.base (= _sportBaseGoal) intègre déjà le delta cycle → on le retire
  // pour afficher la base habituelle (sans sport ni cycle).
  const habitualBase = adjust?.base != null ? adjust.base - cycleKcalDelta : null

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Activity size={17} color="var(--green)" />
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>
            {isEffort ? 'Objectif du jour · manger selon l\'effort' : 'Bilan du jour · approximatif'}
          </h2>
        </div>

        <div style={{ marginTop: 12 }}>
          {isEffort ? (
            adjust?.applied ? (
              <>
                <div style={{ fontSize: 14 }}>
                  <strong style={{ fontSize: 17 }}>{k(adjust.goal)} kcal</strong>
                  <span style={{ color: 'var(--text-muted)' }}> visés aujourd'hui</span>
                </div>
                {habitualBase != null && (
                  <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--text-hint)' }}>{k(habitualBase)} base</span>
                    {' + '}
                    <span style={{ color: 'var(--green)' }}>{k(adjust.credit || 0)} sport</span>
                    {cycleKcalDelta !== 0 && (
                      <>
                        {cycleKcalDelta > 0 ? ' + ' : ' − '}
                        <span style={{ color: 'var(--purple)' }}>{k(Math.abs(cycleKcalDelta))} cycle</span>
                      </>
                    )}
                    {' = '}
                    <strong>{k(adjust.goal)} kcal</strong>
                  </div>
                )}
                <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--text-hint)', lineHeight: 1.6 }}>
                  {adjust.delta > 0 && <>Soit +{adjust.delta} de plus que ton objectif habituel, grâce à tes pas et séances du jour.</>}
                  {adjust.delta < 0 && <>Soit {Math.abs(adjust.delta)} de moins que ton objectif habituel — journée sans activité notée pour l'instant.</>}
                  {adjust.delta === 0 && <>Comme ton objectif habituel pour le moment ; il montera avec tes pas et séances.</>}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Complète ton profil dans Profil › Sport pour activer ce mode. En attendant, ton objectif habituel est utilisé.
              </div>
            )
          ) : (
            bilan ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Mangé <strong>{Math.round(consumedKcal || 0)}</strong> · dépense estimée ≈{' '}
                  <strong>{bilan.depense}</strong> ({bilan.maintenance} entretien
                  {bilan.sport > 0 ? ` + ${bilan.sport} activité` : ''})
                </div>
                {activity?.hasSteps && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-hint)', marginTop: 3 }}>
                    dont ≈ {activity.pas} kcal de pas
                    {activity.seances > 0 ? ` + ${activity.seances} kcal de séances` : ''}
                    {activity.seancesDansPas > 0 ? ' — marche/tapis déjà dans les pas, non recomptés' : ''}
                  </div>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, color: bilan.bilan > 0 ? 'var(--amber)' : 'var(--green)' }}>
                  {bilan.bilan >= 0 ? 'Surplus' : 'Déficit'} ≈ {Math.abs(bilan.bilan)} kcal
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {activityKcalToday > 0
                  ? <>Dépense d'activité du jour ≈ <strong>{Math.round(activityKcalToday)}</strong> kcal.</>
                  : 'Pas encore d\'activité notée aujourd\'hui.'}
                {' '}Renseigne ton profil (sexe, âge, taille, poids, niveau d'activité) pour un bilan complet.
              </div>
            )
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 16, lineHeight: 1.6 }}>
          {isEffort
            ? <>Réglé dans Profil › Sport. N'affecte que la page du jour.</>
            : <>Indicatif. Ta dépense d'entretien intègre déjà une part d'activité — ne cumule pas les deux dans ta tête. Ton objectif de calories ne change pas.</>}
        </div>

        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 18 }} onClick={onClose}>Fermer</button>
      </div>
    </div>,
    document.body,
  )
}
