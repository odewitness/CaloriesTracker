# Chantier « FODMAP dans les aliments »

Document d'étude préalable (science, données, fonctionnalités, architecture).
Rien n'est encore implémenté. Décisions de cadrage prises le 2026-09-26
(§10) ; à transformer en suivi d'avancement au démarrage du Palier 1.
Créé le 2026-09-26.

---

## 1. Objectif et périmètre

Permettre de **voir la charge en FODMAP** de ce qu'on mange (aliment, repas,
journée, recette), **en tenant compte des quantités réellement consommées** —
c'est le cœur du sujet : un aliment n'est pas « riche » ou « pauvre » en
FODMAP dans l'absolu, il l'est **à une portion donnée**.

À terme, relier ça au tracker de transit existant (table `selles`, onglet
Digestion de l'Historique) pour aider à repérer ses propres déclencheurs.

**Périmètre décidé (2026-09-26) : de l'information uniquement**, pour tous
les comptes. **Pas d'accompagnement du régime pauvre en FODMAP** (ni phase
de restriction, ni réintroduction guidée, ni profil de tolérance) — le §2.4
reste à titre de contexte scientifique, et les idées correspondantes sont
rangées en §6 « Hors périmètre ».

**Ce que ce n'est pas** : un régime santé ou minceur, ni un outil de
diagnostic. Voir §8 (garde-fous).

---

## 2. La science

### 2.1 Ce que sont les FODMAP

Acronyme (Monash University, Gibson & Shepherd, ~2005) :
**F**ermentable **O**ligo-, **D**i-, **M**ono-saccharides **A**nd **P**olyols.
Des glucides à chaîne courte, **mal absorbés dans l'intestin grêle**. Six
sous-groupes, qui ne se comportent pas pareil et que les gens ne tolèrent pas
pareil — **l'app doit raisonner par sous-groupe, pas avec un score unique** :

| Sous-groupe | Famille | Sources typiques |
|---|---|---|
| **Fructanes** (FOS, inuline) | Oligo | Blé, seigle, orge, oignon, ail, poireau (blanc), artichaut, chicorée/inuline ajoutée, banane mûre |
| **GOS** (raffinose, stachyose) | Oligo | Légumineuses (pois chiches, lentilles, haricots), noix de cajou, pistaches |
| **Lactose** | Di | Lait, yaourt, fromages frais / à pâte molle (les fromages affinés en ont très peu) |
| **Fructose en excès** (fructose > glucose) | Mono | Pomme, poire, mangue, pastèque, miel, sirop d'agave, sirop de glucose-fructose |
| **Sorbitol** | Polyol | Fruits à noyau, pomme, poire, avocat, mûres, chewing-gums/bonbons « sans sucre » (E420) |
| **Mannitol** | Polyol | Champignons, chou-fleur, céleri, patate douce, pastèque, E421 |

Autres polyols additifs : maltitol (E965), xylitol (E967), isomalt (E953),
lactitol (E966), érythritol (E968, mieux toléré).

### 2.2 Mécanisme

Deux effets, qui expliquent des symptômes et des délais différents :

1. **Osmotique** (surtout les petites molécules : fructose, lactose,
   polyols) : attirent l'eau dans l'intestin grêle → distension, accélération
   du transit, selles molles.
2. **Fermentation colique** (surtout les oligosaccharides : fructanes, GOS) :
   le microbiote les fermente → gaz (H₂, CO₂, CH₄) et acides gras à chaîne
   courte → ballonnements, douleurs, flatulences.

Point clé : **tout le monde fermente les FODMAP**. Chez la plupart des gens
c'est sans conséquence (voire bénéfique : les fructanes/GOS sont des
prébiotiques). Les symptômes apparaissent chez les personnes avec une
**hypersensibilité viscérale**, typiquement le syndrome de l'intestin
irritable (SII / IBS). → Le « problème » n'est pas l'aliment, c'est la
rencontre dose × sensibilité individuelle.

### 2.3 Efficacité : ce qui est établi

- **Recommandations britanniques (BSG 2021, Gut)** : le régime pauvre en
  FODMAP est recommandé **en 2ᵉ intention** dans le SII, après les conseils
  diététiques « classiques » (repas réguliers, limiter gras/alcool/café/
  épices, ajuster les fibres). Méta-analyse de 11 essais / 658 participants :
  réduction du risque de rester symptomatique **RR 0,71** (IC 95 % 0,61–0,83),
  mais **qualité de preuve très faible** (petits effectifs, pas d'aveugle,
  hétérogénéité).
- **Contre les conseils diététiques classiques**, l'avantage est plus faible
  et non significatif (**RR 0,82**, IC 0,67–1,01) → les « 50–70 % de
  répondeurs » souvent cités sont probablement **surestimés**.
- Méta-analyse 2021 (12 essais, 772 participants) : amélioration modérée à
  forte de la sévérité (SMD −0,66), −45 points sur l'IBS-SSS (seuil de
  pertinence clinique ≈ 50).
- Les essais portent quasiment tous sur la **phase d'élimination (4 à 6
  semaines)**, pas sur la réintroduction ni le long terme.
- **Effets indésirables documentés** d'une restriction prolongée : baisse des
  bifidobactéries, risque d'apports insuffisants, et **risque de dérive vers
  une alimentation trop restrictive** — la BSG insiste sur l'encadrement par
  un·e diététicien·ne spécialisé·e et le dépistage préalable du risque de
  troubles alimentaires.
- Le « sans gluten » apporte peu de preuves dans le SII ; son bénéfice
  ressenti viendrait surtout de la **baisse des fructanes** du blé, pas du
  gluten.

### 2.4 Le protocole en 3 phases (standard Monash)

1. **Restriction** (2 à 6 semaines) : on remplace les aliments riches par des
   équivalents pauvres. Si pas d'amélioration après ~4–6 semaines, le régime
   n'est probablement pas la bonne piste → on arrête.
2. **Réintroduction** (≈ 6–8 semaines) : on teste **un sous-groupe à la
   fois**, avec un aliment « pur » (ex. miel pour le fructose, lait pour le
   lactose), en **doses croissantes sur 3 jours**, puis 2–3 jours de pause
   (retour à la restriction) avant le test suivant. On note les symptômes
   chaque jour.
3. **Personnalisation** (long terme) : on réintègre tout ce qui est toléré,
   on ne limite que ce qui pose vraiment problème et **à partir de quelle
   dose**. Objectif : l'alimentation la plus variée possible.

### 2.5 Liens avec ce qui existe déjà dans l'app

- **Cycle menstruel** (`src/lib/cycle.js`) : les symptômes digestifs du SII
  sont souvent **amplifiés en période périmenstruelle** (prostaglandines), et
  le transit ralentit en phase lutéale (déjà noté dans `docs/cycle-menstruel.md`).
  → Toute corrélation FODMAP ↔ symptômes doit pouvoir être lue **avec la
  phase du cycle en regard**, sinon on attribue aux aliments ce qui vient
  des hormones.
- **Transit** (`selles`, `src/lib/stool.js`, `src/lib/digestion.js`) : Bristol,
  effort, remarques `douleur` / `ballonnement`, alertes `sang` / `mucus`. Les
  corrélations « jours A vs jours B » (`bucketDaysByMetric`, `medianSplit`)
  sont réutilisables telles quelles avec une métrique « charge FODMAP du jour ».

---

## 3. Les quantités : le cœur du sujet

### 3.1 Seuils par portion (Monash, Varney et al. 2017)

Une portion est classée « pauvre en FODMAP » (vert) si elle reste sous ces
seuils **pour chaque sous-groupe** :

| Sous-groupe | Seuil « vert » par portion |
|---|---|
| Oligosaccharides (fructanes + GOS) — céréales, légumineuses, noix, graines | **< 0,30 g** |
| Oligosaccharides — fruits, légumes, autres produits | **< 0,20 g** |
| Fructose en excès | **< 0,15 g** (< 0,40 g si c'est le seul FODMAP présent — règle historiquement réservée aux fruits frais ; Monash l'a retirée pour les légumes, qui se mangent en mélange) |
| Polyols totaux | **< 0,40 g** (ou < 0,20 g si un seul polyol : sorbitol **ou** mannitol) |
| Lactose | **< 1,0 g** |

Orange / rouge = paliers au-dessus (Monash ne publie pas de formule générale
pour ces paliers ; ils sont fixés aliment par aliment dans leur app). Proposition
pour l'app : **orange jusqu'à ~2× le seuil, rouge au-delà** — heuristique à
afficher comme telle.

Ordres de grandeur journaliers : le régime pauvre en FODMAP de l'essai de
référence (Halmos 2014) apportait **~3 g/jour** de FODMAP au total ; une
alimentation occidentale habituelle en apporte **plusieurs fois plus**
(de l'ordre de 15–25 g/j selon les études — chiffre non revérifié à la
source, à confirmer avant de l'afficher dans l'app).

### 3.2 Pourquoi la quantité change tout

Exemples typiques (indicatifs, à vérifier dans les sources du §4.2 avant de s'en
servir comme données) :

- **Avocat** : vert en petite portion (~30 g), rouge en demi-avocat (sorbitol).
- **Amandes** : ~10 amandes OK, ~20 amandes → GOS modéré.
- **Banane** : ferme/peu mûre OK en entière ; **bien mûre** → fructanes, OK
  seulement en petite portion. (La maturité change la composition !)
- **Pois chiches / lentilles en conserve rincés** : bien mieux tolérés que
  cuits à partir de secs — les GOS sont solubles et partent dans le jus.
- **Patate douce** : OK en portion moyenne, mannitol au-delà.

→ Pour chaque aliment, l'information la plus utile n'est pas un feu tricolore
fixe, mais **« jusqu'à combien de grammes c'est vert »** (voir §5.3).

### 3.3 L'effet d'empilement (« FODMAP stacking »)

Plusieurs aliments « verts » dans un même repas peuvent **s'additionner** et
dépasser le seuil. Monash précise :

- l'empilement vaut **entre sous-groupes différents**, pas seulement au sein
  d'un même sous-groupe ;
- recommandation d'**espacer repas et collations de 2–3 h** ;
- **aucun seuil officiel en grammes par repas** n'est publié.

→ Dans l'app, l'agrégation par repas est donc une **heuristique** : on somme
chaque sous-groupe sur le repas, on compare aux seuils par portion (approche
prudente), et on affiche en plus un indicateur « cumul toutes familles ».

### 3.4 Autres sources de variabilité à assumer

Maturité (banane), variété, cuisson (les FODMAP hydrosolubles migrent dans
l'eau de cuisson ou le jus de conserve), fermentation (pain au levain
longue fermentation : moins de fructanes), matière grasse (les fructanes de
l'ail/oignon ne passent **pas** dans l'huile → huile infusée à l'ail OK),
et tolérance individuelle. → **Toujours afficher une précision / un niveau
de confiance**, jamais une fausse exactitude.

---

## 4. Les données : d'où viendraient les valeurs FODMAP ?

C'est **la vraie difficulté du chantier**. Aucune base française ouverte ne
donne les 6 sous-groupes.

### 4.1 Ce que l'app a déjà (bonne nouvelle)

La table `ciqual` (et par copie `journal`, `aliments_custom`, `recettes`,
`recette_ingredients`) contient déjà :

| Colonne | Permet de calculer |
|---|---|
| `lactose` | Lactose — **directement** |
| `fructose` + `glucose` | **Fructose en excès = max(0, fructose − glucose)** |
| `polyols` | Polyols **totaux** (pas de détail sorbitol/mannitol) |

Et le `journal` stocke ces valeurs **déjà mises à l'échelle de `qty_g`** →
on peut calculer lactose / fructose en excès / polyols **sur tout
l'historique existant, rétroactivement, sans rien migrer**.

**Ce qui manque** : fructanes et GOS (les deux plus importants en pratique :
blé, oignon, ail, légumineuses), et la séparation sorbitol/mannitol.

**Taux de remplissage mesuré (2026-09-26)**, valeurs non `null` sur 3 552
aliments :

| lactose | fructose | glucose | polyols |
|---|---|---|---|
| 2 623 (74 %) | 2 922 (82 %) | 3 041 (86 %) | 3 327 (94 %) |

⚠️ **Ces chiffres sont trop beaux pour être pris tels quels**, surtout les
polyols : dans la table Ciqual d'origine, les polyols sont très rarement
analysés (la documentation ANSES les décrit comme « le plus souvent peu ou
pas présents »), et une valeur inconnue y est notée « - », une valeur non
quantifiable « traces » ou « < x ». Le script d'import de Ciqual n'est pas
dans le repo : il est très probable que « - » / « traces » / « < x » aient été
convertis en **0** au lieu de `null`. Si c'est le cas, **un 0 ne veut pas
dire « absent », il peut vouloir dire « pas mesuré »** — et un pruneau
s'afficherait « vert » en sorbitol à tort.

Vérification à faire (SQL editor Supabase) :

```sql
-- 1. Part de 0 vs valeurs positives
select
  count(*) filter (where polyols > 0)  as polyols_pos,
  count(*) filter (where polyols = 0)  as polyols_zero,
  count(*) filter (where lactose > 0)  as lactose_pos,
  count(*) filter (where lactose = 0)  as lactose_zero,
  count(*) filter (where fructose > 0) as fructose_pos,
  count(*) filter (where fructose = 0) as fructose_zero
from ciqual;

-- 2. Test sur des aliments connus pour contenir du sorbitol / du lactose
select alim_code, alim_nom, polyols, fructose, glucose, lactose
from ciqual
where alim_nom ilike any (array['%pruneau%', '%chewing%', '%poire%crue%',
                                '%pomme%crue%', '%lait%demi-écrémé%', '%yaourt nature%'])
order by alim_nom
limit 30;
```

**Résultat (2026-09-26) — diagnostic confirmé.** La table `ciqual` en base
correspond à **Ciqual 2025** (ANSES, 3 484 aliments, fichiers du
2025-11-03 ; les valeurs de la poire 13037 sont identiques). En comparant
avec le fichier officiel, l'import a converti les notations spéciales ainsi :

| Dans le fichier Ciqual | Signification | Devenu en base | Exemple |
|---|---|---|---|
| `-` | **non mesuré** | **0** ❌ | Jus de pruneau (2018) : fructose, glucose, lactose, polyols tous « - » → tous 0 |
| `traces` | présent, non quantifiable | 0 (acceptable) | Chewing-gum sucré (31007) : polyols |
| `< x` | sous le seuil de mesure (≈ absent) | **null** ❌ | Pomme Chantecler (13190) : lactose « < 0,2 », polyols « < 0,5 » → null |

Donc, pour ces colonnes, **un 0 en base peut vouloir dire « pas mesuré »**
et **un null peut vouloir dire « quasi absent »** — l'inverse de ce qu'il
faut. Volume dans Ciqual 2025 : valeurs « - » pour 1 647 aliments en
fructose, 1 606 en glucose, 1 804 en lactose, 448 en polyols ; « traces » ou
« < x » pour ~460 aliments en polyols.

Pour le reste de l'app, l'impact est faible (0 et null s'additionnent
pareil dans les totaux). Pour les FODMAP, il est **bloquant** : un jus de
pruneau s'afficherait « vert » en sorbitol et en fructose.

**Correctif (préalable au Palier 1) — ✅ exécuté et vérifié le 2026-09-26** : un script SQL généré depuis
le fichier officiel Ciqual 2025 (`compo_2025_11_03.xml`, Recherche Data
Gouv, Licence Ouverte Etalab 2.0), qui ré-écrit **uniquement** les colonnes
`fructose`, `glucose`, `lactose`, `polyols` (et `galactose`, très probablement même
problème) par `alim_code`, avec la bonne correspondance :
`-` → `null`, `traces` → `0`, `< x` → `0`, valeur → valeur. Exécuté à la main
dans le SQL editor Supabase (base de production : relire avant). Les
entrées déjà dans le `journal` ne sont pas touchées — le calcul FODMAP se
fait à la lecture depuis `ciqual` (§5.5), il profite donc directement du
correctif.

⚠️ Règle absolue : **`null` = inconnu, jamais 0**. Un aliment dont on ne sait
rien ne doit jamais apparaître « vert ».

### 4.2 Options pour compléter

| Option | Qualité | Couverture | Effort | Verdict |
|---|---|---|---|---|
| **A. Calcul depuis Ciqual** (lactose, fructose−glucose, polyols) | Mesurée (labo ANSES) | 3 sous-groupes sur 6, trous selon aliments | Faible | ✅ Socle |
| **B. Table de référence curatée** (fructanes, GOS, sorbitol, mannitol en g/100 g) pour ~150–300 aliments clés, reliée aux `alim_code` Ciqual | Bonne si sources publiées | Couvre l'essentiel de ce qu'on mange vraiment | Moyen (travail de saisie, une fois) | ✅ Indispensable |
| **C. Règles par mots-clés** sur le nom / la catégorie (« oignon », « ail », « blé », « pois chiche », « miel », « sans sucre »…) | Qualitative | Large | Faible | ✅ Filet de sécurité → « probablement riche en X », jamais de grammes |
| **D. Open Food Facts** : liste d'ingrédients, `additives_tags` (E420, E421, E965…), champs `fructose_100g` / `lactose_100g` / `polyols_100g` quand renseignés, `percent_estimate` par ingrédient | Variable | Produits scannés | Moyen | ✅ Pour les produits industriels (voir §7.4) |
| **E. Saisie manuelle** sur les aliments perso (`aliments_custom`) | Celle de l'utilisatrice | Au cas par cas | Faible | ✅ Override |
| **F. Base australienne AFCD** (FSANZ, Release 3, déc. 2025, **licence CC BY 4.0**) | Mesurée (labo) | Faible : sorbitol 90 aliments, inuline 50, GOS (raffinose + stachyose) ~21, mannitol 17 | Faible (fichiers Excel téléchargeables) | ✅ Complément ponctuel, surtout pour le sorbitol des fruits. Mention de la source obligatoire |
| **G. App Monash FODMAP** | Excellente | Des milliers d'aliments | — | ❌ **Écartée (décision du 2026-09-26)** |
| **H. Livre de référence** de l'utilisatrice (listes riches / pauvres en FODMAP) | Bonne mais qualitative (portions vertes / rouges) | Large | Saisie manuelle | ✅ Pour vérifier et combler les trous de B via l'astuce « portion verte → teneur » (ci-dessous) |
| **I. Estimation par IA** (LLM) aliment par aliment | Risque d'hallucination | Totale | Faible | ⚠️ Uniquement comme **brouillon** relu par un humain pour amorcer B, marqué « estimé » |

**Ce qu'on trouve en ligne, concrètement** (vérifié le 2026-09-26) :

- **Des valeurs chiffrées (g/100 g) mesurées en labo**, dans des publications
  scientifiques : Muir et al. 2007 (fructanes et fructose de 60 légumes et
  43 fruits — ail, artichaut, échalote, blanc de poireau, oignon entre 1,2 et
  17,4 g/100 g), Muir et al. 2009 (GOS, sorbitol, mannitol des fruits et
  légumes, HPLC), Biesiekierski et al. 2011 (fructanes et GOS des céréales et
  produits céréaliers), Tuck et al. 2018 (aliments végétariens/vegan), Ispiryan
  et al. 2020 (pains de blé et de seigle, effet du levain), une étude slovène
  2024 en accès libre (fructanes des aliments courants). Les chiffres
  eux-mêmes sont des faits réutilisables ; on cite la source dans
  `fodmapData.js`.
- **La base AFCD** (option F), seule base officielle ouverte trouvée avec
  des colonnes FODMAP, mais peu remplie.
- **Des listes « riche / pauvre » par portion** (sites de diététicien·nes,
  blogs spécialisés, livres). ⚠️ En pratique, **presque toutes reprennent les
  mesures de Monash** (ou de FODMAP Friendly) : ne pas utiliser l'app Monash
  ne change donc pas grand-chose à l'origine des données, mais évite de
  dépendre d'un service fermé. Ces listes donnent des feux par portion, pas
  des grammes de FODMAP → utilisables via l'astuce ci-dessous.

**Astuce « portion verte → teneur »** : un aliment « vert jusqu'à X g » pour un
sous-groupe dont le seuil est S contient au plus ≈ S / X × 100 g/100 g
(ex. vert jusqu'à 30 g pour le sorbitol, seuil 0,2 g ⇒ ≈ 0,7 g/100 g). C'est
un **ordre de grandeur** (marqué confiance « dérivé »), suffisant pour
calculer une portion sûre et l'empilement.

**Recommandation** : A (après vérification des 0, §4.1) + B + C dès le
Palier 1, B alimentée par les publications + AFCD, avec le livre pour
vérifier et combler ; E ensuite ; D pour les produits scannés. Commencer B
par les **~50 aliments les plus consommés** dans les journaux réels
(classement déjà calculable, cf. `TopFoods`), plus les grands classiques
riches en FODMAP (ail, oignon, blé, légumineuses, pomme, poire, miel,
champignons, lait…), plutôt que viser l'exhaustivité.

---

## 5. Le modèle de calcul

### 5.1 Profil FODMAP d'un aliment (pour 100 g)

```
{
  fructanes, gos, lactose, fructose_exces, sorbitol, mannitol,   // g/100 g ou null
  polyols_total,                                                 // si seul le total est connu
  confiance: { <groupe>: 'mesuré' | 'dérivé' | 'estimé' | 'mot-clé' | 'inconnu' },
  source
}
```

Priorité par sous-groupe : saisie manuelle > table curatée > Ciqual/OFF >
règle mots-clés > inconnu.

### 5.2 À une quantité donnée

`quantité_groupe = valeur_100g × qty_g / 100`, comparée au seuil du §3.1
(avec le bon seuil oligosaccharides selon la catégorie : céréales /
légumineuses / noix → 0,30 g, sinon 0,20 g). Résultat par sous-groupe :
vert / orange / rouge / inconnu. Le niveau global de l'entrée = le pire des
sous-groupes connus, avec mention explicite des groupes inconnus.

**Règles fixées en testant la table sur les aliments réels (2026-09-26)** :

1. **Borne basse** : un groupe composé (oligosaccharides = fructanes + GOS ;
   polyols = sorbitol + mannitol) dont une partie est inconnue reste calculé
   avec la partie connue. Si cette borne basse dépasse déjà le seuil → la
   couleur est acquise (pain au seigle : rouge sur ses seuls fructanes, GOS
   inconnus). Sinon → « probablement faible, données incomplètes », jamais
   vert franc.
2. **Polyols** : ordre de priorité = sorbitol + mannitol de `fodmapData.js`
   (connus seulement si les deux le sont) > colonne Ciqual `polyols` > inconnu.
   La colonne Ciqual est ignorée pour les entrées marquées
   `ignoreCiqualPolyols` : les « < 0,5 g/100 g » de Ciqual, convertis en 0 par
   le correctif, sont trop grossiers pour les fruits (seuil 0,2 g par portion).
   Plus généralement, pour un **fruit ou légume absent de `fodmapData.js`**,
   un 0 Ciqual en polyols s'affiche « probablement faible », pas « vert ».
   Ce n'est pas une erreur du correctif (« < x » → 0 est la convention
   habituelle pour les totaux nutritionnels), c'est une limite de précision
   de la donnée ANSES, gérée à l'affichage.
3. **Fructose en excès depuis Ciqual = bruité** pour les aliments où fructose
   et glucose sont proches : une petite différence de mesure suffit à faire
   passer une grosse portion au rouge. Ex. carotte : Ciqual 2025 donne 1,51 /
   0,89 g (→ rouge), l'USDA 0,55 / 0,59 (→ aucun excès, conforme à toutes les
   listes FODMAP). Règle : quand une **deuxième source mesurée** contredit
   Ciqual, `fodmapData.js` remplace fructose/glucose, avec la raison en note
   (fait pour carotte, raisin, tomate, concombre).
4. **Seuil fructose à 0,40 g** si le fructose en excès est le seul FODMAP de
   l'aliment (fruit), 0,15 g sinon (§3.1).

### 5.3 « Portion sûre »

```
portion_verte_max = min sur les groupes connus de (seuil_groupe / valeur_100g × 100)
```

→ phrase affichée : « Vert jusqu'à 45 g · au-delà : sorbitol ». C'est
probablement **la fonctionnalité la plus utile** au quotidien.

### 5.4 Repas, journée, recette

- **Repas** : somme par sous-groupe des entrées du même `meal` + indicateur de
  cumul (§3.3).
- **Journée** : somme par sous-groupe + total, à comparer à l'ordre de
  grandeur ~3 g/j du régime pauvre en FODMAP (repère, pas objectif).
- **Recette** : somme des ingrédients (`recette_ingredients`, qui ont
  `food_ref_id`), rapportée au poids cuit (`poids_cuit_g`), puis à la portion.
  Montrer **quel ingrédient pèse le plus** et une substitution possible.
- **Fructose en excès** : à calculer **aliment par aliment**, pas sur des
  totaux (sinon le glucose d'un aliment « compense » artificiellement le
  fructose d'un autre). Conséquence : pour une recette, le fructose en excès
  se calcule par ingrédient avant la somme — les colonnes agrégées `fructose` /
  `glucose` de `recettes` sous-estimeraient la valeur.

### 5.5 Calcul à la lecture plutôt que figé dans le journal

Le journal fige les nutriments au moment de l'ajout. Pour les FODMAP, mieux
vaut **recalculer à la lecture** à partir de `food_source` + `food_ref_id` +
`qty_g` : la table curatée va s'enrichir, et chaque amélioration profitera
rétroactivement à tout l'historique. Repli sur les colonnes déjà stockées
(`lactose`, `fructose`, `glucose`, `polyols`) si l'aliment n'est plus
retrouvable.

Cas particulier : les entrées issues d'une recette ont `ingredients_detail`
(`food_name`, `qty_g`) **sans `food_ref_id`** → soit on relit
`recette_ingredients` via l'id de la recette (qui a pu être modifiée depuis),
soit on ajoute `food_source`/`food_ref_id` au snapshot pour les nouvelles
entrées.

---

## 6. Fonctionnalités possibles

Classées par rapport valeur / effort. ★ = recommandé pour les premiers paliers.

### Voir les FODMAP

1. ★ **Fiche aliment** (`AddFoodModal`, `FoodDetailModal`, `ExplorerFoodModal`) :
   bloc « FODMAP » avec les 6 sous-groupes, feu par sous-groupe **qui se met à
   jour en direct quand on change la quantité**, et la **portion sûre** (§5.3).
   Niveau de confiance visible (« mesuré », « estimé », « inconnu »).
2. ★ **Journal / repas** : pastille par entrée + bandeau par repas quand
   l'empilement fait passer à l'orange/rouge (« 3 aliments verts, mais
   ensemble 0,45 g de fructanes »).
3. ★ **Carte « FODMAP » sur la page du jour** — via le mécanisme de
   réordonnancement (`TODAY_SECTION_KEYS` / `sectionNodes`, cf. CLAUDE.md) :
   jauges par sous-groupe sur la journée, repas le plus chargé.
4. **Recettes** : score par portion, ingrédient principal responsable,
   substitutions proposées (oignon → vert de ciboule / poireau vert,
   ail → huile infusée à l'ail, lait → lait sans lactose, pois chiches secs →
   en conserve rincés, pain de blé → levain d'épeautre / sans gluten…).
5. **Explorateur** : filtre « pauvre en FODMAP à la portion habituelle » et
   filtre par sous-groupe (« sans fructanes ») — à ajouter dans
   `ExplorerFilterSheet`.
6. **Scanner code-barres** : détection des additifs polyols (E420, E421,
   E965, E967…), de l'inuline/FOS/chicorée, du sirop de glucose-fructose,
   du miel dans la liste d'ingrédients OFF.
7. **Planificateur** : option « mode pauvre en FODMAP » qui écarte ou
   pénalise les recettes au-dessus des seuils (s'appuie sur les règles de
   recettes interdites déjà existantes). *À rediscuter : c'est à la
   frontière entre information et accompagnement du régime.*
8. **Liste de courses** : pastille sur les articles concernés.

### Relier au transit (décidé le 2026-09-26 — compte avec le tracker de transit uniquement)

9. **Symptômes sans passage, dans le tracker de transit existant** :
   aujourd'hui on ne note que des passages (`selles`, avec `douleur` /
   `ballonnement` en remarques). On ajoute dans la **même carte « Transit »
   et la même feuille de saisie** un choix « Passage » / « Symptôme » pour
   noter **ballonnement, douleur, gaz, urgence** (intensité légère / moyenne /
   forte) avec l'heure, même sans passage. Stockage conseillé : petite table
   dédiée `symptomes_digestifs` plutôt que dans `selles` — `selles.bristol`
   est obligatoire et toutes les stats de l'onglet Digestion supposent qu'une
   ligne = un passage ; les mélanger fausserait fréquence et régularité.
   Côté utilisatrice, ça reste un seul tracker.
10. **Corrélations dans Historique > Digestion** : ajouter « jours à forte
    charge en fructanes / lactose / … vs jours faibles » à côté des fibres,
    de l'eau, du sport et du cycle (réutilise `medianSplit` +
    `bucketDaysByMetric`), sur le Bristol, l'effort, et les symptômes.
    Délai à prendre en compte : effet osmotique en quelques heures,
    fermentation plusieurs heures → comparer au **jour même et au
    lendemain**. Afficher avec prudence (observationnel, peu de jours,
    nombreux facteurs confondants dont la phase du cycle). Formulation
    d'information (« les jours riches en fructanes, ton transit était en
    moyenne… »), jamais de conseil d'éviction.

### Hors périmètre (décision du 2026-09-26 : information uniquement)

Gardé pour mémoire si le besoin change un jour — **ne pas développer** :
accompagnement du régime (phase de restriction avec compteur,
réintroduction guidée par sous-groupe et doses croissantes, table
`fodmap_tests`), et profil de tolérance personnalisé qui remplacerait les
seuils Monash par des seuils personnels.

---

## 7. Architecture technique (ancrée dans le code actuel)

### 7.1 Fichiers

- `src/lib/fodmap.js` — fonctions pures (même esprit que `digestion.js`) :
  `FODMAP_GROUPS`, `FODMAP_THRESHOLDS`, `fodmapProfile(food)`,
  `fodmapForQty(profile, qty_g)`, `fodmapLevel(amounts, thresholds)`,
  `safePortion(profile)`, `mealStack(entries)`, `dayFodmap(entries)`.
- `src/lib/fodmapData.js` — table curatée **statique, versionnée dans git**
  (clé = `alim_code` Ciqual, + règles mots-clés). Pas de migration, modifiable
  sans toucher la base, relisible en revue de code. À basculer en table
  Supabase seulement si elle devient très grosse ou éditable dans l'app.

### 7.2 Base de données

| Besoin | Proposition | Palier |
|---|---|---|
| Activer/désactiver l'affichage | `settings.fodmap jsonb` (`{ enabled }`, extensible) | 1 |
| Override par aliment perso | `aliments_custom.fodmap jsonb` | 3 |
| Symptômes sans passage (dans le tracker de transit) | nouvelle table `symptomes_digestifs` (user_id, date, heure, type, intensite, note), RLS « own » | 4 |

Chaque modification → mise à jour de `supabase_schema.sql` (cf. CLAUDE.md).
Noms de champs en français, identifiants de code en anglais.

### 7.3 Accès / comptes

Décidé le 2026-09-26 : **l'affichage FODMAP est pour tous les comptes**
(fiches, repas, journée, recettes, explorateur), avec un interrupteur dans
le Profil. Seules les briques liées au transit (symptômes, corrélations)
restent réservées à `STOOL_TRACKER_USER_ID`, puisque le tracker de transit
l'est déjà (mêmes gardes que `useSelles`). La carte FODMAP de la page du
jour, elle, est pour tout le monde → pas de filtrage de sa clé dans
`ProfilePage.jsx`.

### 7.4 Open Food Facts

`mapOFFProduct` (`src/lib/openFoodFacts.js`) ne récupère aujourd'hui ni
`fructose_100g`, `glucose_100g`, `lactose_100g`, `polyols_100g`, ni les
ingrédients / additifs. Petit gain rapide : mapper ces champs quand ils
existent, et garder `additives_tags` + `ingredients` (avec `percent_estimate`)
pour la détection du point 6 du §6. Une estimation quantitative est même envisageable
(`% oignon estimé × fructanes de l'oignon`), mais très approximative.

### 7.5 Modales

Toute feuille/modale montée depuis `TodayPage` → `createPortal(…, document.body)`
(cf. CLAUDE.md).

---

## 8. Garde-fous (non négociables)

1. **Pas de diagnostic.** Texte d'intro : le régime pauvre en FODMAP est un
   outil pour le SII **diagnostiqué**, idéalement accompagné par un·e
   diététicien·ne. Avant de retirer le blé : **faire tester la maladie
   cœliaque** (le test n'est fiable que si on mange encore du gluten).
2. **Signaux d'alerte → médecin** : sang (déjà une alerte dans `digestion.js`),
   perte de poids inexpliquée, symptômes nocturnes, anémie, fièvre, apparition
   après 50 ans, antécédents familiaux (cancer colorectal, MICI, cœliaquie).
3. **Informer, pas prescrire.** L'app montre des quantités et des seuils,
   elle ne dit jamais « évite cet aliment ». Un court texte (dans la fiche
   d'explication FODMAP) rappelle que la restriction se fait sur quelques
   semaines puis qu'on réintroduit, et que les FODMAP ne sont pas
   « mauvais » : fructanes et GOS nourrissent le microbiote.
4. **Vocabulaire neutre, pas de morale.** Les couleurs décrivent une
   **tolérance digestive probable**, pas la qualité d'un aliment. Ne jamais
   mélanger avec les objectifs caloriques ni les badges nutritionnels.
   Cohérent avec le garde-fou TCA du chantier cycle : les régimes
   d'éviction sont un facteur de risque connu de troubles alimentaires
   (BSG 2021).
5. **Honnêteté sur les données.** `null` = inconnu (gris), jamais vert.
   Niveau de confiance visible. Pas de décimales trompeuses.
6. **Off par défaut**, activable dans le Profil.

---

## 9. Paliers proposés

| Palier | Contenu | Migration BDD | Taille |
|---|---|---|---|
| **0 — Audit données** | ✅ Remplissage Ciqual mesuré, ✅ problème des 0 diagnostiqué (§4.1), ✅ correction `supabase/sql/ciqual_sucres_fix.sql` exécutée et vérifiée en production le 2026-09-26, ✅ top 60 des aliments consommés relevé, ✅ `src/lib/fodmapData.js` constitué (60 aliments ; 6 codes Ciqual anciens absents de Ciqual 2025 — huile d'olive 20100, carotte 11200, skyr 17010, ail 11420, yaourt 19400, miel 16010 — reçoivent des valeurs complètes). Vérification dans un livre impossible (pas de grammages) : valeurs estimées gardées avec leur niveau de confiance | Non | S |
| **1 — Fiche aliment** | `fodmap.js` + `fodmapData.js`, bloc FODMAP réactif à la quantité + portion sûre + niveau de confiance, texte d'explication, interrupteur dans le Profil | `settings.fodmap` | M |
| **2 — Repas & journée** | Pastilles journal, empilement par repas, carte page du jour (réordonnable) | Non | M |
| **3 — Recettes & explorateur** | Score recette + ingrédient responsable + substitutions, filtres explorateur, override aliments perso, champs OFF | `aliments_custom.fodmap` | M |
| **4 — Transit** | Symptômes sans passage dans le tracker de transit, corrélations FODMAP ↔ transit/symptômes (J et J+1) avec la phase du cycle en regard | `symptomes_digestifs` | M |
| **5 — Extensions** | Scanner (additifs/ingrédients), liste de courses ; planificateur à rediscuter | Non | M |

Paliers 1–3 = « voir les FODMAP en tenant compte des quantités » (la
demande de départ). Palier 4 = relier au transit. Le Palier 0 conditionne
tout : c'est la qualité de `fodmapData.js` qui fera la valeur de la
fonctionnalité.

---

## 10. Décisions (prises le 2026-09-26)

1. **Pour qui** : **tous les comptes** pour l'affichage FODMAP. Les briques
   transit restent limitées au compte qui a le tracker de transit.
2. **Objectif** : **information uniquement**, pas d'accompagnement du régime
   pauvre en FODMAP (voir §6 « Hors périmètre »).
3. **Données** : **pas d'app Monash**. Table curatée à partir de sources
   trouvables en ligne (publications, base AFCD en CC BY 4.0), avec le livre
   de l'utilisatrice pour vérifier et combler les trous (§4.2).
4. **Seuils orange/rouge** : ✅ heuristique « orange jusqu'à 2× le seuil,
   rouge au-delà ».
5. **Transit** : ✅ symptômes sans passage ajoutés au tracker de transit
   existant (même carte, même feuille) + corrélations dans l'onglet
   Digestion.

6. **Données Ciqual** : les 0 de l'import sont en partie des « non mesuré »
   (§4.1) → correctif SQL des colonnes fructose / glucose / lactose /
   polyols / galactose depuis le fichier officiel Ciqual 2025.

---

## Sources

- Vasant DH et al. *British Society of Gastroenterology guidelines on the
  management of irritable bowel syndrome.* Gut 2021;70:1214–1240.
  doi:10.1136/gutjnl-2021-324598 —
  https://www.bsg.org.uk/clinical-resource/british-society-of-gastroenterology-guidelines
- Varney J et al. *FODMAPs: food composition, defining cutoff values and
  international application.* J Gastroenterol Hepatol 2017;32 Suppl 1:53–61 —
  https://onlinelibrary.wiley.com/doi/10.1111/jgh.13698
- Halmos EP et al. *A diet low in FODMAPs reduces symptoms of irritable bowel
  syndrome.* Gastroenterology 2014;146:67–75 —
  https://pubmed.ncbi.nlm.nih.gov/24076059/
- *Efficacy of a low-FODMAP diet in adult irritable bowel syndrome: a
  systematic review and meta-analysis* (2021) —
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8354978/
- Tuck C et al. *FODMAP content of common plant-based foods…* J Hum Nutr Diet
  2018 — https://onlinelibrary.wiley.com/doi/10.1111/jhn.12546
- Monash FODMAP — *FODMAP stacking explained* —
  https://www.monashfodmap.com/blog/fodmap-stacking-explained/
- Monash FODMAP — *Fructose changes for vegetables* —
  https://www.monashfodmap.com/blog/fructose-changes-vegetables/
- ACG — *Low-FODMAP diet* — https://gi.org/topics/low-fodmap-diet/
- Muir JG et al. *Fructan and free fructose content of common Australian
  vegetables and fruit.* J Agric Food Chem 2007;55:6619–6627 —
  https://pubs.acs.org/doi/10.1021/jf070623x
- Fructanes des aliments courants slovènes (2024, accès libre) —
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11327153/
- FSANZ — *Australian Food Composition Database*, Release 3 (déc. 2025),
  licence CC BY 4.0 —
  https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files
- ANSES — documentation de la table Ciqual (valeurs manquantes « - »,
  « traces ») — https://ciqual.anses.fr/
