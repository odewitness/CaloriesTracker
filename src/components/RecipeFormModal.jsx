import React, { useState, useRef } from 'react'
import { ArrowLeft, ChevronDown, Scale } from 'lucide-react'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { saveRecette, sumIngredients, calcPer100g } from '../hooks/useRecipes'
import { useBackButton } from '../hooks/useBackButton'
import FoodPicker from './FoodPicker'
import EditableFoodRow from './EditableFoodRow'
import { scaleFood } from '../lib/nutrients'


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

  const [ingredients, setIngredients] = useState(initIngredients)
  const [showSearch,  setShowSearch]  = useState(false)
  const [saving,      setSaving]      = useState(false)
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
      ingredients,
    })
    setSaving(false)
    if (!error) {
      toast(recette ? '✓ Recette modifiée !' : '✓ Recette sauvegardée !')
      onSaved(id)
    } else {
      toast('Erreur lors de la sauvegarde')
      console.error(error)
    }
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Nom de la recette *</div>
            <input className="input" placeholder="Ex: Poulet rôti aux légumes" value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Nombre de portions</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input className="input-sm" type="number" min={1} value={portions} onChange={e => setPortions(e.target.value)} style={{ width: 70 }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>portion{parseInt(portions) > 1 ? 's' : ''}</span>
            </div>
          </div>
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
          <div className="empty" style={{ padding: '24px 0' }}>Aucun ingrédient · appuie sur + Ajouter</div>
        )}

        {ingredients.map((ing, idx) => (
          <EditableFoodRow
            key={ing.id || ing._tmpId || idx}
            entry={ing}
            onSave={patch => updateIngredient(idx, patch)}
            onDelete={() => removeIngredient(idx)}
          />
        ))}

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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    ① Poids du récipient <strong>vide</strong> (tare)
                  </div>
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    ② Poids total après cuisson <strong>(récipient + nourriture)</strong>
                  </div>
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Poids cuit net {poidsCuitFromTare > 0 ? <span style={{ color: 'var(--text-hint)' }}>(remplacé par la méthode tare)</span> : <strong>direct</strong>}
                  </div>
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