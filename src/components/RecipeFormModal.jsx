import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ChevronDown, Scale, ImagePlus, Trash2 } from 'lucide-react'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { saveRecette, sumIngredients, calcPer100g } from '../hooks/useRecipes'
import { uploadRecipePhoto, removeRecipePhoto, recipePhotoUrl } from '../lib/recipePhoto'
import { useBackButton } from '../hooks/useBackButton'
import FoodPicker from './FoodPicker'
import EditableFoodRow from './EditableFoodRow'
import { scaleFood } from '../lib/nutrients'
import EmptyState from './EmptyState'
import FieldLabel from './FieldLabel'
import { RECIPE_CATEGORIES } from '../lib/recipeCategories'
import { SEASONS, getSeasonIcon } from '../lib/seasons'
import { getRecipeCategoryIcon } from '../lib/categoryIcons'


// ─────────────────────────────────────────────────────────────────────────────
// Composant principal : RecipeFormModal
// Props :
//   recette      — objet recette existant (mode édition) ou null (création)
//   ingredients  — tableau d'ingrédients existants (mode édition) ou []
//   onSaved(id)  — callback appelé après sauvegarde réussie
//   onClose      — ferme la modal
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeFormModal({ recette, ingredients: initIngredients = [], onSaved, onClose }) {
  useBackButton(onClose)
  const toast  = useToast()
  const { user } = useAuth()

  const [nom,      setNom]      = useState(recette?.nom      || '')
  const [portions, setPortions] = useState(String(recette?.portions || 1))
  const [poidsCuitG, setPoidsCuitG] = useState(recette?.poids_cuit_g ? String(recette.poids_cuit_g) : '')
  const [tare,       setTare]       = useState(recette?.tare_g ? String(recette.tare_g) : '')
  const [totalBrut,  setTotalBrut]  = useState('')
  const [categories, setCategories] = useState(recette?.categories || [])
  const [saisons, setSaisons] = useState(recette?.saisons || [])
  const [instructions, setInstructions] = useState(recette?.instructions || '')
  const [tempsPreparation, setTempsPreparation] = useState(recette?.temps_preparation_min ? String(recette.temps_preparation_min) : '')
  const [tempsCuisson,     setTempsCuisson]     = useState(recette?.temps_cuisson_min ? String(recette.temps_cuisson_min) : '')
  const [tempsRepos,       setTempsRepos]       = useState(recette?.temps_repos_min ? String(recette.temps_repos_min) : '')
  const [sourceType,   setSourceType]   = useState(recette?.source_type || 'lien')
  const [sourceValeur, setSourceValeur] = useState(recette?.source_valeur || '')
  const [sourcePage,   setSourcePage]   = useState(recette?.source_page ? String(recette.source_page) : '')

  const toggleCategory = (cat) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const toggleSaison = (s) =>
    setSaisons(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const [ingredients, setIngredients] = useState(initIngredients)
  const [showSearch,  setShowSearch]  = useState(false)
  const [saving,      setSaving]      = useState(false)

  // ── Photo de la recette ───────────────────────────────────────────────────
  // Édition : upload immédiat (l'id existe). Création : on garde le fichier de
  // côté et on l'envoie juste après le 1ᵉʳ enregistrement, quand l'id est connu.
  const photoInputRef = useRef(null)
  const [photoVersion, setPhotoVersion] = useState(recette?.photo_updated_at || null)
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => () => { if (pendingPreview) URL.revokeObjectURL(pendingPreview) }, [pendingPreview])

  const photoSrc = pendingPreview
    || (photoVersion ? recipePhotoUrl(recette?.id, photoVersion) : null)

  const handlePickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (recette?.id) {
      setPhotoBusy(true)
      const { error, photoUpdatedAt } = await uploadRecipePhoto(recette.id, file, user.id)
      setPhotoBusy(false)
      if (error) { toast('Photo : envoi impossible'); return }
      setPhotoVersion(photoUpdatedAt)
    } else {
      setPendingPhotoFile(file)
      setPendingPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
    }
  }

  const handleRemovePhoto = async () => {
    if (recette?.id && photoVersion) {
      setPhotoBusy(true)
      const { error } = await removeRecipePhoto(recette.id, user.id)
      setPhotoBusy(false)
      if (error) { toast('Photo : suppression impossible'); return }
    }
    setPhotoVersion(null)
    setPendingPhotoFile(null)
    setPendingPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null })
  }
  const [openWeighing, setOpenWeighing] = useState(false)
  const weighingRef = useRef(null)

  // Poids brut cru = somme des qty_g de tous les ingrédients (calculé auto)
  const poidsCruG = ingredients.reduce((s, i) => s + (parseFloat(i.qty_g) || 0), 0)

  // Méthode tare : poids cuit net = total brut − tare
  const poidsCuitFromTare = parseFloat(tare) > 0 && parseFloat(totalBrut) > 0
    ? Math.max(0, parseFloat(totalBrut) - parseFloat(tare))
    : 0

  // Poids cuit effectif : méthode tare en priorité, sinon saisie directe
  const poidsCuitNet = poidsCuitFromTare > 0 ? poidsCuitFromTare : (parseFloat(poidsCuitG) || 0)

  // Totaux nutritionnels bruts (pour le plat entier)
  const totaux = sumIngredients(ingredients)

  // Référence de poids pour le calcul /100g :
  // si le poids cuit est renseigné → on l'utilise (méthode scientifique)
  // sinon → on utilise le poids cru
  const poidsRef = poidsCuitNet > 0 ? poidsCuitNet : poidsCruG
  const per100   = poidsRef > 0 ? calcPer100g(totaux, poidsRef) : null

  // ── Ajouter un ingrédient ─────────────────────────────────────────────────
  const handleIngredientSelected = (ing) => {
    setIngredients(prev => [...prev, { ...ing, _tmpId: Date.now() }])
    setShowSearch(false)
  }

  const removeIngredient = (idx) => setIngredients(prev => prev.filter((_, i) => i !== idx))

  // Édition inline du grammage d'un ingrédient déjà dans la liste (avant
  // sauvegarde) — même patch que celui produit par EditableFoodRow pour les
  // entrées du journal : qty_g + tous les nutriments reproportionnés.
  const updateIngredient = (idx, patch) =>
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, ...patch } : ing))

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  const save = async () => {
    if (!nom.trim())        { toast('⚠ Donne un nom à ta recette') ; return }
    if (ingredients.length === 0) { toast('⚠ Ajoute au moins un ingrédient') ; return }
    setSaving(true)
    const { id, error } = await saveRecette({
      userId:          user.id,
      recetteId:       recette?.id || null,
      nom,
      portions:        parseInt(portions, 10) || 1,
      poidsCruG,
      poidsCuitG:      poidsCuitNet > 0 ? poidsCuitNet : null,
      tareG:           parseFloat(tare) > 0 ? parseFloat(tare) : null,
      poidsReferenceG: poidsRef,
      categories,
      saisons,
      instructions,
      tempsPreparationMin: parseInt(tempsPreparation, 10) || null,
      tempsCuissonMin:     parseInt(tempsCuisson, 10)     || null,
      tempsReposMin:       parseInt(tempsRepos, 10)       || null,
      sourceType,
      sourceValeur,
      sourcePage: parseInt(sourcePage, 10) || null,
      ingredients,
    })
    if (error) {
      setSaving(false)
      toast('Erreur lors de la sauvegarde')
      console.error(error)
      return
    }
    // Photo choisie avant le 1ᵉʳ enregistrement : on l'envoie maintenant que
    // l'id est connu. Échec non bloquant — la recette est déjà sauvegardée.
    if (pendingPhotoFile && id) {
      const { error: photoErr } = await uploadRecipePhoto(id, pendingPhotoFile, user.id)
      if (photoErr) toast('Recette sauvegardée, mais la photo n\'a pas pu être envoyée')
    }
    setSaving(false)
    toast(recette ? '✓ Recette modifiée !' : '✓ Recette sauvegardée !')
    onSaved(id)
  }

  // ── Rendu : vue "recherche d'ingrédient" ──────────────────────────────────
  // includeRecipes=false : on évite qu'une recette puisse s'imbriquer dans une
  // autre recette (même limite que l'ancien IngredientSearch dédié).
  if (showSearch) {
    return (
      <FoodPicker
        title="Ajouter un ingrédient"
        confirmLabel="Ajouter à la recette"
        includeRecipes={false}
        onConfirm={(food, qty) => handleIngredientSelected(scaleFood(food, qty))}
        onClose={() => setShowSearch(false)}
      />
    )
  }

  // ── Rendu : formulaire principal ──────────────────────────────────────────
  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose}><ArrowLeft size={20} color="var(--text-muted)" /></button>
        <h2>{recette ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
        <div style={{ width: 32 }} />
      </div>

      <div className="page-modal-body">

        {/* ── Nom + portions ── */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Nom de la recette *</FieldLabel>
            <input className="input" placeholder="Ex: Poulet rôti aux légumes" value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Nombre de portions</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input className="input-sm" type="number" min={1} value={portions} onChange={e => setPortions(e.target.value)} style={{ width: 70 }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>portion{parseInt(portions) > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <div>
              <FieldLabel>Préparation</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="input-sm" type="number" min={0} placeholder="—" value={tempsPreparation} onChange={e => setTempsPreparation(e.target.value)} style={{ width: 70 }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>min</span>
              </div>
            </div>
            <div>
              <FieldLabel>Cuisson</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="input-sm" type="number" min={0} placeholder="—" value={tempsCuisson} onChange={e => setTempsCuisson(e.target.value)} style={{ width: 70 }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>min</span>
              </div>
            </div>
            <div>
              <FieldLabel>Repos</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="input-sm" type="number" min={0} placeholder="—" value={tempsRepos} onChange={e => setTempsRepos(e.target.value)} style={{ width: 70 }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>min</span>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Catégories</FieldLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RECIPE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="chip"
                  style={categories.includes(cat) ? undefined : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
                >
                  {getRecipeCategoryIcon(cat)} {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Saisons</FieldLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SEASONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSaison(s)}
                  className="chip"
                  style={saisons.includes(s) ? undefined : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
                >
                  {getSeasonIcon(s)} {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Photo de la recette ── */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <FieldLabel>Photo</FieldLabel>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePickPhoto} style={{ display: 'none' }} />
          {photoSrc ? (
            <div style={{ position: 'relative' }}>
              <img
                src={photoSrc}
                alt=""
                style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 12, display: 'block', opacity: photoBusy ? 0.5 : 1 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => !photoBusy && photoInputRef.current?.click()}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'var(--gray-bg)', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', color: 'var(--text-muted)' }}
                >
                  Changer
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={photoBusy}
                  style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--coral-light)', color: 'var(--coral)', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={14} /> Retirer
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !photoBusy && photoInputRef.current?.click()}
              style={{
                width: '100%', aspectRatio: '16 / 10', borderRadius: 12, background: 'var(--gray-bg)',
                border: '1px dashed var(--border-md)', color: 'var(--text-muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
              }}
            >
              <ImagePlus size={22} />
              {photoBusy ? 'Envoi…' : 'Ajouter une photo'}
            </button>
          )}
        </div>

        {/* ── Liste des ingrédients ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Ingrédients ({ingredients.length})</div>
          <button
            onClick={() => setShowSearch(true)}
            style={{ background: 'var(--green)', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)' }}
          >
            + Ajouter
          </button>
        </div>

        {ingredients.length === 0 && (
          <EmptyState style={{ padding: '24px 0' }}>Aucun ingrédient · appuie sur + Ajouter</EmptyState>
        )}

        {ingredients.map((ing, idx) => (
          <EditableFoodRow
            key={ing.id || ing._tmpId || idx}
            entry={ing}
            onSave={patch => updateIngredient(idx, patch)}
            onDelete={() => removeIngredient(idx)}
          />
        ))}

        {/* ── Instructions ── */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <FieldLabel>Instructions</FieldLabel>
          <textarea
            className="input"
            placeholder="Une étape par ligne — collé automatiquement numéroté à l'affichage"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={5}
            style={{ width: '100%', resize: 'vertical', fontSize: 14, lineHeight: 1.5 }}
          />
        </div>

        {/* ── Source ── */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <FieldLabel>Source</FieldLabel>
          <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 10 }}>
            {[{ key: 'lien', label: 'Lien' }, { key: 'livre', label: 'Livre' }].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSourceType(t.key)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
                  background: sourceType === t.key ? 'var(--white)' : 'transparent',
                  color: sourceType === t.key ? 'var(--text)' : 'var(--text-muted)',
                  boxShadow: sourceType === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="input"
            type="text"
            placeholder={sourceType === 'lien' ? 'https://...' : 'Titre du livre'}
            value={sourceValeur}
            onChange={e => setSourceValeur(e.target.value)}
          />
          {sourceType === 'livre' && (
            <div style={{ marginTop: 10 }}>
              <FieldLabel>N° de page</FieldLabel>
              <input className="input-sm" type="number" min={1} placeholder="—" value={sourcePage} onChange={e => setSourcePage(e.target.value)} style={{ width: 70 }} />
            </div>
          )}
        </div>

        {/* ── Section pesée ── */}
        {ingredients.length > 0 && (
          <div ref={weighingRef} className="card" style={{ marginBottom: 12 }}>
            <button
              onClick={() => {
                setOpenWeighing(o => {
                  const next = !o
                  if (next) setTimeout(() => weighingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
                  return next
                })
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={16} color="var(--green)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Peser le plat après cuisson</span>
              </div>
              <ChevronDown size={18} color="var(--text-muted)" style={{ transform: openWeighing ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>

            {openWeighing && (
              <div style={{ padding: '0 16px 16px' }}>
                {/* Poids cru calculé */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '10px 12px', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Poids cru total</div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>Somme de tous les ingrédients</div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{Math.round(poidsCruG)} g</span>
                </div>

                {/* ── Méthode tare (recommandée) ── */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-hint)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
                  ⚖️ Méthode recommandée — avec tare
                </div>

                {/* ① Tare */}
                <div style={{ marginBottom: 10 }}>
                  <FieldLabel>
                    ① Poids du récipient <strong>vide</strong> (tare)
                  </FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="input-sm" type="text" inputMode="decimal"
                      placeholder="—" value={tare} onChange={e => setTare(e.target.value)}
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                  </div>
                  {parseFloat(tare) > 0 && !totalBrut && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)', background: 'var(--amber-light, #fff8e1)', borderRadius: 6, padding: '5px 8px' }}>
                      ⏳ Tare sauvegardée — renseigne le poids total ② après cuisson pour finaliser.
                    </div>
                  )}
                </div>

                {/* ② Poids total brut */}
                <div style={{ marginBottom: 10 }}>
                  <FieldLabel>
                    ② Poids total après cuisson <strong>(récipient + nourriture)</strong>
                  </FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="input-sm" type="text" inputMode="decimal"
                      placeholder="—" value={totalBrut} onChange={e => setTotalBrut(e.target.value)}
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                  </div>
                </div>

                {/* Résultat tare */}
                {poidsCuitFromTare > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--green-light)', borderRadius: 8, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)' }}>✓ Poids cuit net</div>
                      <div style={{ fontSize: 11, color: 'var(--green-dark)', marginTop: 2 }}>{totalBrut} − {tare} g</div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{Math.round(poidsCuitFromTare)} g</span>
                  </div>
                )}

                {/* Séparateur */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>ou saisie directe</span>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                </div>

                {/* Poids cuit direct (désactivé si méthode tare active) */}
                <div style={{ marginBottom: 10, opacity: poidsCuitFromTare > 0 ? 0.45 : 1 }}>
                  <FieldLabel>
                    Poids cuit net {poidsCuitFromTare > 0 ? <span style={{ color: 'var(--text-hint)' }}>(remplacé par la méthode tare)</span> : <strong>direct</strong>}
                  </FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="input-sm" type="text" inputMode="decimal"
                      placeholder="—"
                      value={poidsCuitFromTare > 0 ? Math.round(poidsCuitFromTare) : poidsCuitG}
                      onChange={poidsCuitFromTare > 0 ? undefined : e => setPoidsCuitG(e.target.value)}
                      readOnly={poidsCuitFromTare > 0}
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                  </div>
                </div>

                {/* Explication méthode */}
                <div style={{ fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.5, background: 'var(--blue-light)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                  💡 <strong>Méthode :</strong> pèse le récipient vide (tare), cuisine, puis pèse le tout. La différence = poids cuit net. Les kcal totales restent calculées sur les ingrédients crus.
                </div>

                {/* Référence utilisée */}
                {poidsRef > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                    Référence utilisée : <strong style={{ color: 'var(--text)' }}>{Math.round(poidsRef)} g</strong>
                    {poidsCuitNet > 0 ? ' (poids cuit ✓)' : ' (poids cru — renseigne le poids cuit pour plus de précision)'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Récap nutritionnel /100g ── */}
        {per100 && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="section-title">Valeurs pour 100 g de plat {poidsCuitNet > 0 ? 'cuit' : 'cru'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'kcal',   val: Math.round(per100.energie_kcal || 0), color: 'var(--text)'  },
                { label: 'Prot.',  val: `${(per100.proteines || 0).toFixed(1)}g`, color: 'var(--green)' },
                { label: 'Gluc.',  val: `${(per100.glucides  || 0).toFixed(1)}g`, color: 'var(--amber)' },
                { label: 'Lip.',   val: `${(per100.lipides   || 0).toFixed(1)}g`, color: 'var(--coral)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '10px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            {parseInt(portions) > 0 && poidsRef > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                → <strong style={{ color: 'var(--text)' }}>{Math.round(per100.energie_kcal * poidsRef / 100 / parseInt(portions))} kcal</strong> par portion ({Math.round(poidsRef / parseInt(portions))} g)
              </div>
            )}
          </div>
        )}

        {/* ── Bouton sauvegarder ── */}
        <button className="btn-primary" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : recette ? '💾 Enregistrer les modifications' : '💾 Sauvegarder la recette'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center', marginTop: 10, marginBottom: 8 }}>
          La recette sera disponible dans la recherche pour l'ajouter au journal
        </div>
      </div>
    </div>
  )
}