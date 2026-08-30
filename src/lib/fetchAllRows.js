// ─────────────────────────────────────────────────────────────────────────────
// fetchAllRows — contourne le plafond PostgREST (1000 lignes par réponse, cf.
// useCiqualCatalog) en enchaînant les .range() jusqu'à recevoir une page
// incomplète. Sans ça, sur les plages larges de l'Historique (surtout la vue
// Année) les lignes au-delà de la 1000ᵉ — les plus récentes, vu le tri par
// date — manquent silencieusement : la heatmap s'arrête en plein mois.
//
// `buildQuery` doit renvoyer une NOUVELLE requête à chaque appel (un builder
// PostgREST ne s'attend qu'une fois) et porter un `.order()` stable pour que
// les bornes de page ne sautent/dupliquent aucune ligne.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery) {
  const all = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return all
}
