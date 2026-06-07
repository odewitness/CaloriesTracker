# 🥗 NutriTrack — Calorie Tracker Personnel

App React mobile-first pour tracker ses calories, macros et vitamines.  
Stack : React + Vite · Supabase (PostgreSQL) · Netlify

---

## 🚀 Déploiement en 4 étapes

### Étape 1 — Supabase : créer les tables

1. Va sur [supabase.com](https://supabase.com) → ton projet
2. Clique sur **SQL Editor** → **New query**
3. Colle le contenu de `supabase_schema.sql` et clique **Run**
4. Les tables sont créées (ciqual, journal, repas_types, settings, aliments_custom)

#### 👉 Importer la vraie table Ciqual 2025 complète (~2 500 aliments)

Le fichier SQL fourni contient ~100 aliments représentatifs.  
Pour avoir **tous les aliments Ciqual 2025** :

1. Télécharge le fichier depuis [ciqual.anses.fr](https://ciqual.anses.fr/) → "Télécharger la table"  
   (format Excel ou CSV)
2. Convertis-le en CSV si besoin
3. Dans Supabase → **Table Editor** → table `ciqual` → bouton **Import CSV**
4. Mappe les colonnes :
   - `alim_code_public` → `alim_code`
   - `alim_nom_fr` → `alim_nom`
   - `Energie, Règlement UE N° 1169/2012 (kcal/100g)` → `energie_kcal`
   - `Protéines, N x facteur de Jones (g/100g)` → `proteines`
   - `Glucides par différence (g/100g)` → `glucides`
   - `Lipides (g/100g)` → `lipides`
   - `Fibres alimentaires (g/100g)` → `fibres`
   - ... et ainsi de suite pour les vitamines

---

### Étape 2 — GitHub : push le code

```bash
# Dans le dossier du projet
git init
git add .
git commit -m "Initial commit - NutriTrack"

# Crée un nouveau repo sur github.com puis :
git remote add origin https://github.com/TON_USERNAME/calorie-tracker.git
git branch -M main
git push -u origin main
```

---

### Étape 3 — Netlify : déployer

1. Va sur [app.netlify.com](https://app.netlify.com)
2. **Add new site** → **Import an existing project** → **GitHub**
3. Sélectionne ton repo `calorie-tracker`
4. Paramètres de build :
   - **Build command** : `npm run build`
   - **Publish directory** : `dist`
5. Clique **Deploy site**

Netlify détecte automatiquement `netlify.toml` donc tout est préconfiguré. ✅

---

### Étape 4 — (Optionnel) Domaine custom

Dans Netlify → **Domain settings** → tu peux utiliser un sous-domaine Netlify gratuit  
Ex : `mon-nutrition.netlify.app`

---

## 🗂 Structure du projet

```
calorie-tracker/
├── src/
│   ├── components/
│   │   ├── CalorieRing.jsx     — Anneau de progression
│   │   ├── MacroBar.jsx        — Barres macros
│   │   ├── VitaminPanel.jsx    — Panel vitamines (dépliable)
│   │   ├── MealSection.jsx     — Section repas avec édition inline
│   │   └── AddFoodModal.jsx    — Modal recherche + ajout
│   ├── pages/
│   │   ├── TodayPage.jsx       — Page principale (journal du jour)
│   │   ├── MealsPage.jsx       — Repas types sauvegardés
│   │   ├── ManualPage.jsx      — Ajout manuel d'aliments
│   │   ├── HistoryPage.jsx     — Historique 30 jours + stats
│   │   └── SettingsPage.jsx    — Objectifs éditables + profils
│   ├── hooks/
│   │   ├── useJournal.js       — CRUD journal Supabase
│   │   └── useSettings.js      — Objectifs Supabase
│   ├── lib/
│   │   ├── supabase.js         — Client Supabase
│   │   └── toast.jsx           — Notifications
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase_schema.sql         — Schema SQL complet
├── netlify.toml                — Config déploiement
├── vite.config.js
└── package.json
```

---

## ✨ Fonctionnalités

- 📊 **Anneau calories** + barres macros (protéines, glucides, lipides, fibres)
- 💊 **Vitamines & minéraux** dépliables (Vit. C, D, B12, A, E, Calcium, Fer, Mg, K)
- 🔍 **Recherche Ciqual** full-text avec 2 500 aliments
- 📦 **Scan code-barres** → Open Food Facts
- 🍽️ **Repas types** sauvegardés (groupes d'aliments avec portions)
- ✏️ **Édition inline** de chaque entrée (quantité, kcal, macros)
- 📅 **Navigation par date** (consulter les jours précédents)
- 📈 **Historique 30 jours** avec stats (moyenne, série)
- ⚙️ **Objectifs éditables** avec profils prédéfinis
- 💾 **Aliments personnalisés** avec portions courantes
