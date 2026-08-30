# Analyse de l'app & feuille de route

Revue complète du code (pages, hooks, `lib/`, schéma SQL, config PWA) faite le
**2026-08-30**. Sert de fil conducteur : bugs à corriger, dette technique, et
idées de fonctionnalités classées de la plus simple à la plus complexe.

À faire évoluer : cocher / dater ce qui est livré, ajouter les décisions prises
avec l'utilisatrice, comme pour `docs/cycle-menstruel.md` et
`docs/suivi-sport.md`.

---

## 0. Ce qui est déjà solide (pour mémoire)

Le code est mûr et soigné. Les pièges classiques sont déjà traités :

- Fuseaux horaires centralisés dans `lib/dates.js` (`fmt`, `todayStr`), avec le
  bon raisonnement documenté (`toISOString()` = UTC → mauvais jour la nuit).
- Pattern portal documenté pour les modales montées dans `TodayPage` (slider
  avec `translateX` → un enfant `position: fixed` se cale sur le conteneur
  transformé). Voir le bloc « Notes utiles » de `CLAUDE.md`.
- Mitigation du clignotement du header au scroll (`AppShell.handleScroll`,
  fenêtre de neutralisation de direction).
- Déduplication pas / séances pour l'énergie d'activité (`dayActivityKcal`).
- Retry sur Open Food Facts (`fetchOFFWithRetry`), cache module-level de la base
  Ciqual (`useCiqualCatalog`), pagination `range()` pour contourner le plafond
  PostgREST (`fetchAllRows`).
- RLS déjà activé sur `mensurations` (données sensibles) et `ciqual`.
- `AuthContext` stabilise la référence `user` sur l'`id` pour éviter des
  remontages d'écran à chaque `TOKEN_REFRESHED`.

---

## 1. Correctifs appliqués le 2026-08-30

Petits changements mécaniques, faits directement.

### 1.1 — Bug de fuseau dans le graphe des mensurations ✅

`src/components/MetricChart.jsx`, `cutoffDate()` utilisait
`d.toISOString().slice(0, 10)` → date **UTC**. Entre minuit et ~2 h du matin en
France, la date de coupure de période sautait d'un jour : un relevé de poids
pouvait apparaître / disparaître du graphe selon l'heure de consultation.
Remplacé par `fmt(d)` (fuseau local), cohérent avec le reste de l'app.

### 1.2 — Clés de liste par index dans `FoodPicker` ✅

Les listes « Suggestions pour <repas> » et « Récents » utilisaient `key={i}`.
Quand la liste change (filtre, tri, pagination), React réassocie les lignes par
position → état interne et animations qui sautent. Passées à
`key={foodIdentity(food).key}` (collision impossible : ces listes sont déjà
dédupliquées par cette même clé dans `useMealSuggestions` / `useRecentFoods`).

### 1.3 — Recherche d'aliments parallélisée ✅

`FoodPicker.doSearch` (branche Ciqual) enchaînait **3 requêtes en série**
(`search_ciqual` → `aliments_custom` → `recettes`), soit 3 allers-retours
réseau à chaque frappe. Regroupées en `Promise.all` → ~3× plus rapide.

### 1.4 — RLS activé sur les tables de données perso ✅

Voir §2.1. SQL exécuté par l'utilisatrice dans l'éditeur Supabase le
2026-08-30 : `journal`, `settings`, `aliments_custom`, `repas_types`, `marques`
passent en RLS activé + policy « own ». `supabase_schema.sql` mis à jour.
**Vérif complète le 2026-08-30** (`select tablename, rowsecurity from pg_tables
where schemaname='public'`) : **les 32 tables ont `rowsecurity = true`**. Le
chapitre RLS est clos (la justesse fine des policies des tables secondaires n'a
pas été auditée ligne à ligne, mais l'app fonctionne → elles sont au moins
opérationnelles).

### 1.5 — Bugs « doublons / pertes silencieuses » — bloc client ✅

Traité le 2026-08-30 (voir §2.2, §2.4, §2.5, §2.6) :

- **`useSettings.update`** : construit le prochain état depuis une ref tenue à
  jour de façon synchrone (plus de closure figée), et sérialise les écritures
  Supabase (`writeChain`) pour qu'elles arrivent en base dans l'ordre.
- **`FoodPicker.doSearch`** : garde « dernière recherche gagne » (`searchSeq`) —
  une réponse réseau n'est appliquée que si elle correspond encore à la dernière
  frappe.
- **`TodayPage`** : largeur du viewport suivie en state (`viewportW` +
  écouteurs `resize` / `orientationchange`) au lieu de `window.innerWidth` lu en
  direct → plus de slider décalé après rotation.
- **`markAsEaten`** : passe par la fonction SQL transactionnelle
  `mark_planned_meal_eaten` (insert `journal` + update `mange` d'un bloc,
  idempotente). Voir §2.2.

---

## 2. Bugs & fragilités restants

Classés par gravité.

### 2.1 — 🔴 CRITIQUE : RLS désactivé sur des tables contenant des données perso

> ✅ **Clos le 2026-08-30.** SQL ci-dessous exécuté pour `journal`, `settings`,
> `aliments_custom`, `repas_types`, `marques` ; `supabase_schema.sql` mis à
> jour. Vérif `pg_tables` : les 32 tables ont `rowsecurity = true`. La suite de
> cette section garde la trace du problème initial et du raisonnement.

`supabase_schema.sql`, section RLS (état d'avant le correctif) :

```sql
alter table journal            disable row level security;
alter table settings           disable row level security;
alter table aliments_custom    disable row level security;
alter table repas_types        disable row level security;
alter table marques            disable row level security;
```

**Problème.** La clé `anon` est publique (en clair dans `src/lib/supabase.js`,
donc dans le bundle JS livré sur Netlify). RLS désactivé = n'importe qui, même
**sans compte**, peut faire :

```
GET https://<projet>.supabase.co/rest/v1/journal?select=*
apikey: <clé anon publique>
```

et récupérer **le journal alimentaire de tous les comptes**, tous les réglages,
tous les aliments persos. Avec la fonctionnalité « Amies », plusieurs personnes
réelles sont concernées. C'est exactement la faille déjà corrigée pour
`mensurations` le 2026-08-17 (« accessibles sans authentification via la Data
API tant que le RLS était désactivé »), encore ouverte sur des tables au moins
aussi sensibles.

**Correctif** (éditeur SQL Supabase — risque de régression quasi nul : le
client filtre déjà partout par `user_id`) :

```sql
alter table journal enable row level security;
create policy "journal_own" on journal for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table settings enable row level security;
create policy "settings_own" on settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table aliments_custom enable row level security;
create policy "aliments_custom_own" on aliments_custom for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table repas_types enable row level security;
create policy "repas_types_own" on repas_types for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table marques enable row level security;
create policy "marques_own" on marques for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Vérifié le 2026-08-30** : `profiles`, `recettes`, `recette_ingredients`,
`favoris`, `listes_courses`, `liste_courses_items`, `repas_planifies`,
`suggestions_manques` — toutes ont déjà `rowsecurity = true`.

**Reste conseillé** : si l'app reste à quelques personnes, désactiver
l'inscription publique dans Supabase (Auth → Providers) et créer les comptes à
la main.

### 2.2 — 🟠 `markAsEaten` n'est pas atomique → doublons possibles — ✅ traité le 2026-08-30

Était : `src/hooks/usePlannedMeals.js` insérait les aliments dans `journal`
**puis** marquait `repas_planifies.mange = true` en deux requêtes. Si la 2ᵉ
échouait (réseau), les aliments étaient au journal mais le repas restait « à
faire » → un 2ᵉ « marquer mangé » ajoutait tout une 2ᵉ fois.

Correctif : fonction SQL `mark_planned_meal_eaten(p_repas_id)` (voir
`supabase/sql/mark_planned_meal_eaten_setup.sql`, appliquée en base le
2026-08-30). Insert `journal` + update `mange` dans **une transaction** ;
idempotente (repas déjà mangé → ne réinsère rien) ; `for update` +
`user_id = auth.uid()` pour verrouiller/autoriser. La copie des colonnes passe
par `jsonb_populate_record(null::journal, …)` → pas besoin de réénumérer les
~70 colonnes de nutriments. `markAsEaten` côté client appelle maintenant ce RPC
(`supabase.rpc('mark_planned_meal_eaten', …)`).

### 2.3 — 🟠 Aucune gestion d'erreur réseau dans les hooks de données

`useJournal`, `useProfile`, `useSettings`, `useFavorites`, `usePlannedMeals`,
`useRecentFoods`, `useMealSuggestions`… font tous :

```js
const { data } = await supabase.from(...).select(...)
setEntries(data || [])
```

L'erreur est ignorée. Sur mobile avec un réseau instable, l'utilisatrice voit
une **journée vide** au lieu d'un « hors ligne » — et risque de re-saisir des
aliments déjà là → doublons.

*Correctif :* ajouter `error` au state de ces hooks + un bandeau discret
« connexion perdue, tire pour recharger » (idéalement via le hook générique
proposé en §3.2).

### 2.4 — 🟡 `useSettings.update` : écrasement concurrent

> ✅ **Traité le 2026-08-30** (voir §1.5) : ref synchrone + sérialisation des
> écritures. Reste une piste : ne persister que le patch plutôt que l'objet
> entier defaults-mergé.

```js
const update = async (patch) => {
  const next = { ...settings, ...patch }        // settings = closure figée
  setSettings(next)
  await supabase.from('settings').upsert({ ...next, user_id, updated_at })
}
```

Deux `update()` rapprochés (ex. régler l'eau puis l'ordre des sections) : le 2ᵉ
part avec un `settings` périmé et **réécrit l'objet entier**, annulant le 1ᵉ. En
plus l'`upsert` renvoie l'objet defaults-mergé → on persiste des clés jamais
touchées volontairement.

*Correctif :* `setSettings(s => { const next = { ...s, ...patch }; persist(next);
return next })`, et ne persister que le patch si possible.

### 2.5 — 🟡 Course de requêtes dans la recherche d'aliments — ✅ traité le 2026-08-30

`FoodPicker.doSearch` : compteur `searchSeq` incrémenté à chaque appel ; toute
réponse (Ciqual ou OFF) est ignorée si `seq` n'est plus le dernier. Voir §1.5.

### 2.6 — 🟡 Rotation d'écran → slider décalé — ✅ traité le 2026-08-30

`src/pages/TodayPage.jsx` lisait `window.innerWidth` pendant le rendu sans
écouteur `resize` / `orientationchange` → slider mal positionné après rotation
(tablette / desktop surtout). Largeur désormais dans un state `viewportW` mis à
jour sur `resize` + `orientationchange`. Voir §1.5.

### 2.7 — 🟡 `ErrorBoundary` unique et tout en haut

`CLAUDE.md` dit « pas d'ErrorBoundary » — c'est faux depuis peu (`src/components/
ErrorBoundary.jsx`, monté dans `App.jsx`). Mais il est seul au sommet : une
erreur dans une petite modale fait un **écran d'erreur plein page** dont le seul
recours est « Recharger » (on perd la date consultée, la saisie en cours).

*Correctif :* des boundaries par onglet / par page-modal, et mettre `CLAUDE.md`
à jour.

### 2.8 — Broutilles

- `useBackButton` laisse une entrée d'historique orpheline si on ferme par la
  croix ; empilées sur plusieurs modales, le bouton retour Android demande
  plusieurs appuis pour vraiment sortir.
- `public/push-sw.js` : `existing.navigate(url)` peut lever une exception sans
  `catch`.
- `dateLabel` (`lib/dates.js`) fait `new Date('YYYY-MM-DD')` → minuit UTC ; OK
  en France (décalage positif), latent ailleurs.
- Bundle JS unique de **1,49 Mo** (396 Ko gzip), aucun code-splitting → premier
  chargement lent sur 3G. Voir §3.1.

---

## 3. Dette technique / refactors

### 3.1 — `DaySlot` monte ~15 hooks de données, ×3 slots

> ✅ **Fait le 2026-08-30** (branche `refacto-today-data`, mergée sur `main`,
> validée en test manuel). Un contexte `TodayDataProvider`
> (`src/lib/TodayDataContext.jsx`) monte **une seule fois** les 7 hooks non
> datés (`useCycle`, `useMeasurements`, `useProfile`, `useFavorites`,
> `useSettings`, `useCiqualCatalog`, `useFeed`) ; `DaySlot` les lit via
> `useTodayData()`. Les hooks eux-mêmes sont inchangés (API, logique optimiste)
> — seul l'endroit de l'appel change. Les hooks datés (`useJournal`, `useSport`,
> `useExcludedDay`, `usePlannedMealsForDate`) restent dans `DaySlot`.
>
> Effet de bord assumé : les données non datées ne se rafraîchissent plus à
> chaque swipe (elles se rafraîchissent au changement d'onglet, qui remonte
> `TodayPage`). En échange, un changement de cycle / de réglage est désormais
> visible instantanément sur les 3 slots.
>
> Reste ouvert : `useFeed` est encore monté en entier (partages + réactions +
> commentaires) alors que `DaySlot` n'en utilise que `shareJournal` /
> `shareSport` — on pourrait ne garder que les fonctions de partage sans
> déclencher le `load()` du fil. Marginal.

`TodayPage` affiche toujours 3 jours (`datePrev`, `date`, `dateNext`). Chaque
`DaySlot` appelle `useJournal`, `useCycle`, `useSport`, `useMeasurements`,
`useProfile`, `useSettings`, `useCiqualCatalog`, `useFavorites`,
`usePlannedMealsForDate`, `useFeed`, `useExcludedDay`… À chaque swipe, un
nouveau slot se monte et relance tout ce paquet.

Or **la moitié de ces hooks renvoient des données non datées** (`useProfile`,
`useSettings`, `useCiqualCatalog`, `useMeasurements`, `useFavorites`,
`useCycle`). À hisser dans `TodayPage` (ou un contexte `TodayDataProvider`) et
passer en props aux 3 slots. Gros gain de réactivité et de requêtes.

### 3.2 — Un hook générique `useSupabaseQuery`

Le motif `useState + useCallback(fetch) + useEffect(load)` est copié-collé ~20
fois, **chaque fois sans `error`**. Un seul hook donnerait `data` / `loading` /
`error` / `refetch` partout et supprimerait ~300 lignes. Base idéale pour régler
la §2.3 d'un coup.

### 3.3 — Styles inline massifs

`src/index.css` fait ~500 lignes, mais les composants sont bourrés de
`style={{…}}` de 10-15 propriétés. Dur à lire, alourdit le bundle, empêche un
thème sombre propre. À migrer progressivement vers des classes (prérequis de
fait pour le **mode sombre**, §4.2).

### 3.4 — Formes d'objet « aliment » incohérentes

`alim_nom` vs `food_name`, `_source` vs `food_source`, `alim_code` vs `id` vs
`food_ref_id` : géré par des `||` défensifs dans `scaleFood`, `foodIdentity`,
`mapOFFProduct`, `entryToFood`… Source de bugs. Pistes : une fonction
`normalizeFood()` unique en entrée de `FoodPicker`, un `types.d.ts` + JSDoc, ou
`foodIdentity` centralisé (réimplémenté à la main dans `useFavorites`,
`FoodPicker`, etc.).

### 3.5 — Petit ménage

- `App.jsx` : 7 blocs `<Route element={<div className="page-modal">…}>`
  quasi identiques → un composant `<ModalRoute title=…>`.
- `changelog.js` : 467 lignes de données dans le bundle → un `.json` chargé à
  la demande (page Nouveautés rarement ouverte).
- `withWater` (`useSettings`) : nom trompeur (fusionne *tous* les blocs de
  réglages) → renommer `mergeSettings`.
- `useFeed` refait un `select('pseudo, prenom')` sur `profiles` à chaque
  réaction / partage → mémoïser une fois.

---

## 4. Feuille de route fonctionnelle

Chaque fiche : **Quoi / Pourquoi / Esquisse technique / Effort / PWA**.
L'app reste une **PWA** (décision reconduite des chantiers cycle et sport : pas
de wrapper natif).

### 4.1 — Faciles (quelques dizaines de lignes, aucune infra)

#### F1 — « J'ai mangé comme hier » — ~~à faire~~ déjà en place

Fonctionnalité déjà présente dans l'app (confirmé par l'utilisatrice le
2026-08-30). Fiche conservée pour mémoire.

#### F2 — Retour haptique — ✅ fait le 2026-08-30
- `src/lib/haptics.js` : `haptic()` + intentions nommées (`hapticTap`,
  `hapticRemove`, `hapticNav`, `hapticSuccess`). Sûr sans garde, no-op si
  `navigator.vibrate` absent (iOS Safari).
- Câblé dans `TodayPage` : ajout d'aliment, suppression, ajout d'eau rapide,
  changement de jour au swipe (`commitNav`).
- `hapticSuccess` prêt pour le « objectif atteint » — sera déclenché avec la
  célébration de F5.

#### F3 — Bouton « Installer l'app » maison — écartée par l'utilisatrice (2026-08-30)
- **Quoi.** Capter `beforeinstallprompt`, afficher une bannière discrète tant
  que l'app n'est pas installée.
- **Pourquoi.** Beaucoup d'utilisateurs ne connaissent pas « Ajouter à l'écran
  d'accueil » — c'est le point d'entrée d'une PWA.
- **Esquisse.** `window.addEventListener('beforeinstallprompt', e => { e.preventDefault();
  stash(e) })`, bouton → `e.prompt()`. Masquer si `matchMedia('(display-mode:
  standalone)').matches`.
- **Effort.** ~40 lignes + un composant bannière.
- **PWA.** Cœur du sujet.

#### F4 — Note du jour (humeur, faim, digestion, sommeil, énergie) — écartée par l'utilisatrice (2026-08-30)
- **Quoi.** Un petit encart sur la page du jour : texte libre + quelques tags
  rapides.
- **Pourquoi.** Très parlant croisé avec le cycle et l'historique (« je grignote
  toujours les jours où j'ai mal dormi »).
- **Esquisse.** Table `notes_jour (user_id, date, texte, tags text[])`, RLS
  « own », upsert par `(user_id, date)`. Un hook `useDayNote(dateStr)`.
- **Effort.** Moyen-bas (nouvelle table + 1 section + 1 hook).

#### F5 — Série d'hydratation — ✅ fait le 2026-08-30 (branche `feat-hydratation-partage`)
- `src/hooks/useWaterStreak.js` : jours consécutifs (jusqu'à hier) avec
  objectif d'eau atteint, monté 1× dans `TodayDataContext`.
- `WaterSection` : badge « 🔥 N j » (dès 2 jours, aujourd'hui compté en direct),
  + célébration (emoji + `hapticSuccess` + toast) au franchissement, une fois,
  sur le slot « aujourd'hui » seulement.

#### F6 — Pré-remplir un repas avec les habitudes — écartée par l'utilisatrice (2026-08-30)
- **Quoi.** Bouton « ajouter mes 3 habituels » sur un repas vide.
- **Esquisse.** `useMealSuggestions` calcule déjà le classement par fréquence ;
  il suffit d'un bouton qui ajoute les N premiers avec leur dernière quantité.
- **Effort.** ~20 lignes.

#### F7 — Carte « ma journée » partageable en image — ✅ fait le 2026-08-30 (branche `feat-hydratation-partage`)
- `src/components/ShareImageModal.jsx` : rendu `<canvas>` 1080×1080 (calories +
  barre + 4 macros + nb d'aliments), aucune dépendance. Partage via Web Share
  (`navigator.share` avec le fichier) si dispo, sinon bouton « Enregistrer »
  (`<a download>`). Monté en portal sur `document.body`.
- Entrée : nouveau raccourci « Image » dans `DayShortcutsBar` (visible dès
  qu'il y a au moins un aliment ce jour-là).

#### F8 — Recherche + tri dans les aliments perso
- **Quoi.** `CustomFoodsSection` (820 lignes) n'a pas de recherche.
- **Esquisse.** Filtre `useMemo` sur le nom + un `SortModal` (déjà un pattern
  dans l'app).
- **Effort.** ~40 lignes.

#### F9 — Rappels contextuels
- **Quoi.** « Il est 15 h, rien noté au déjeuner. »
- **Esquisse.** Le cron push existe déjà (`push_notifications_setup.sql`).
  Ajouter une condition dans l'Edge Function d'envoi : comparer l'heure locale
  de l'utilisatrice et l'existence d'entrées pour le repas attendu.
- **Effort.** Moyen (logique côté Edge Function).
- **PWA.** Push déjà en place.

### 4.2 — Mode sombre (facile en théorie, moyen en pratique)

- **Quoi.** Thème sombre suivant `prefers-color-scheme` + un toggle manuel.
- **État.** Les tokens CSS existent (`var(--text)`, `var(--green)`, `var(--bg)`…).
- **Frein réel.** Les couleurs en dur dans les `style={{…}}` inline (§3.3).
- **Esquisse.** 1) migrer les couleurs inline vers des tokens ; 2) bloc
  `@media (prefers-color-scheme: dark)` (+ `[data-theme="dark"]`) qui redéfinit
  les tokens ; 3) toggle dans Profil, persisté dans `settings` ou `localStorage`.
- **Effort.** Moyen (surtout du travail de migration CSS).

### 4.3 — Moyennes

#### M1 — Vrai support hors-ligne *(le chantier PWA)*
- **Quoi.** Aujourd'hui `vite.config.js` ne pré-cache que le shell (JS/CSS/HTML).
  Sans réseau, l'app s'ouvre mais **toutes les pages sont vides**.
- **Esquisse.**
  - `runtimeCaching` Workbox : `CacheFirst` sur la table `ciqual` (référence
    statique volumineuse), `NetworkFirst` sur le `journal` du jour et les
    `settings`.
  - File d'attente d'écritures (Workbox Background Sync ou file maison en
    IndexedDB) pour les ajouts faits hors ligne, rejoués au retour du réseau.
  - Indicateur d'état réseau dans l'UI (lié à la §2.3).
- **Effort.** Élevé (passage probable en `injectManifest` pour maîtriser le SW).
- **PWA.** C'est *le* sujet : ce qui rend l'app utilisable dans le métro.

#### M2 — Photo de repas
- **Quoi.** `<input type="file" accept="image/*" capture>` → Supabase Storage →
  vignette dans le journal.
- **Pourquoi.** Mémo visuel ; base pour une future estimation de portion.
- **Esquisse.** Bucket Storage + RLS, colonne `journal.photo_path` (ou table
  `journal_photos`), compression client avant upload.
- **Effort.** Moyen.

#### M3 — Objectifs adaptatifs
- **Quoi.** Chaque semaine, comparer la tendance réelle du poids
  (`mensurations`) à l'objectif et corriger `goal_kcal` de ±50–100 kcal.
- **Esquisse.** Fonction hebdo (client au chargement, ou cron) : régression
  simple sur les relevés des 2-3 dernières semaines vs `paceKgPerWeek` visé
  (déjà calculé dans `computeCalorieNeeds`). Proposer l'ajustement, ne pas
  l'imposer.
- **Effort.** Moyen. **Attention** : même piège de double comptage que « manger
  selon l'effort » (cf. `docs/suivi-sport.md` §8) — cadrer avec l'utilisatrice.

#### M4 — Statistiques nutriments sur la durée
- **Quoi.** « Apport moyen en fer sur 30 j vs RNP », pas seulement le jour.
- **Esquisse.** `fetchAllRows` sur `journal` + `computeTotals` par jour +
  moyenne. Réutiliser les jauges de `NutrientPanel`. Ajouter un onglet dans
  `HistoryPage`.
- **Effort.** Moyen.

#### M5 — Planificateur de menus + liste de courses générée
- **Quoi.** Vue « semaine » éditable des `repas_planifies`, puis bouton
  « générer la liste de courses » à partir des repas planifiés.
- **Esquisse.** `usePlannedMealsRange` existe déjà. Agréger les `items` des
  repas planifiés d'une plage → regrouper par aliment → insérer dans
  `liste_courses_items`.
- **Effort.** Moyen-élevé (surtout l'UI semaine).

#### M6 — Import / export JSON de toutes ses données
- **Quoi.** Un bouton « exporter mes données » (télécharge un JSON) et
  « importer ».
- **Pourquoi.** Sauvegarde, tranquillité, sain vis-à-vis du RGPD.
- **Esquisse.** Export : `select *` sur les tables de l'utilisatrice → `Blob`
  → download. Import : validation + upsert.
- **Effort.** Moyen.

#### M7 — Jeûne intermittent
- **Quoi.** Fenêtre alimentaire, minuteur, badge « 16:8 » sur la page du jour.
- **Esquisse.** Réglage `settings.fasting = { enabled, start, window_h }` ;
  calcul d'état côté client à partir de l'heure de la 1ʳᵉ / dernière entrée.
- **Effort.** Moyen.

#### M8 — Défis entre amies
- **Quoi.** Classement doux « jours dans l'objectif cette semaine », défi hebdo.
- **Esquisse.** Le social existe (`amities`, `partages_*`). Ajouter une vue
  agrégée par amie sur `getDayStatus` (déjà dans `lib/nutrients.js`).
- **Effort.** Moyen (dépend de ce qu'on accepte de partager entre comptes —
  cadrer RLS).

### 4.4 — Complexes

#### C1 — Suggestion de repas qui « bouclent » la journée
- **Quoi.** Sous contrainte des calories restantes + macros restantes +
  `top10Gaps`, proposer une combinaison d'aliments favoris.
- **Esquisse.** Petit problème de sac à dos ; heuristique gloutonne suffisante.
  Les briques existent dans `TodayPage` : `remainingKcal`, `top10Gaps`,
  `getGapAmount`, la liste des favoris.
- **Effort.** Élevé (algo + UI de présentation des combinaisons).

#### C2 — Saisie en langage naturel (API Claude)
- **Quoi.** « ce midi steak-frites salade » → analysé en aliments Ciqual +
  grammages estimés.
- **Esquisse.** Edge Function Supabase (clé API Claude côté serveur, jamais
  client) qui reçoit le texte + un extrait du catalogue Ciqual et renvoie des
  lignes `{ alim_code, qty_g }`. L'utilisatrice valide / ajuste avant d'ajouter.
- **Effort.** Élevé. **Gain de friction le plus important** possible sur ce type
  d'app.
- **PWA.** Marche hors ligne = non (dégrader vers la saisie manuelle).

#### C3 — Intégration Strava / Apple Santé / Google Fit
- **Quoi.** Import automatique des séances.
- **État.** Déjà cadré et **abandonné** au chantier sport (Palier 5) : trop de
  plomberie Strava + Supabase pour le besoin. `activites_sport.source` /
  `source_id` sont prêts si on y revient. Voir `docs/suivi-sport.md` §4.4.
- **Effort.** Élevé.

#### C4 — Prédiction de poids
- **Quoi.** « À ce rythme, 62 kg vers le 15 novembre. »
- **Esquisse.** Régression sur la tendance `mensurations` + bilan énergétique
  cumulé (apports vs dépense estimée). Afficher un intervalle, pas un point sec.
- **Effort.** Élevé (et sensible : cadrer le ton avec l'utilisatrice).

#### C5 — Synchro temps réel multi-appareil
- **Quoi.** Ce qu'on saisit sur le téléphone apparaît sur l'ordi sans
  rafraîchir.
- **Esquisse.** Supabase Realtime sur `journal` et `settings` ; fusionner les
  events dans les hooks concernés. Prérequis : RLS actif (§2.1).
- **Effort.** Élevé (gestion des conflits, du cycle de vie des abonnements).

---

## 5. Ordre suggéré

1. ~~**§2.1 RLS**~~ ✅ 2026-08-30 (chapitre clos, 32 tables en `rowsecurity`).
2. ~~**§2.2 / §2.4 / §2.5 / §2.6**~~ ✅ 2026-08-30. §2.2 inclut désormais la
   fonction SQL atomique `mark_planned_meal_eaten`.
3. ~~**§3.1 hisser les hooks non datés**~~ ✅ 2026-08-30 (via `TodayDataContext`).
4. **§2.3** (gestion d'erreur réseau) + **§3.2** (`useSupabaseQuery`) — à faire
   ensemble, plus tard, sur branche dédiée. Pas bloquant.
5. Fonctionnalités **faciles** : F2 ✅, F5 ✅, F7 ✅ (2026-08-30 ; F1 déjà en
   place ; F3, F4, F6 écartées). Restent **F8** (recherche aliments perso) et
   **F9** (rappels contextuels, besoin Edge Function) si envie.
6. **§4.2 mode sombre** en parallèle de la migration CSS (§3.3).
7. **M1 hors-ligne** quand on veut resserrer l'identité PWA.
8. Le reste selon l'envie.
