import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { PlusCircle } from 'lucide-react'

const FIELDS_LEFT = [
  { id: 'energie_kcal', label: 'Calories', placeholder: '0', unit: 'kcal/100g', required: true },
  { id: 'proteines',    label: 'Protéines', placeholder: '0', unit: 'g/100g' },
  { id: 'glucides',     label: 'Glucides',  placeholder: '0', unit: 'g/100g' },
]
const FIELDS_RIGHT = [
  { id: 'lipides',      label: 'Lipides',   placeholder: '0', unit: 'g/100g' },
  { id: 'fibres',       label: 'Fibres',    placeholder: '0', unit: 'g/100g' },
  { id: 'sel',          label: 'Sel',       placeholder: '0', unit: 'g/100g' },
]

export default function ManualPage() {
  const toast = useToast()
  const [form, setForm] = useState({ nom: '', marque: '', categorie: 'Personnalisé', energie_kcal: '', proteines: '', glucides: '', lipides: '', fibres: '', sel: '' })
  const [portions, setPortions] = useState([{ label: '', g: '' }])
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addPortion = () => setPortions(p => [...p, { label: '', g: '' }])
  const removePortion = (i) => setPortions(p => p.filter((_, idx) => idx !== i))
  const updatePortion = (i, k, v) => setPortions(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x))

  const save = async () => {
    if (!form.nom.trim()) { toast('⚠ Donne un nom'); return }
    if (!form.energie_kcal) { toast('⚠ Entre les calories'); return }
    setSaving(true)
    const cleanPortions = portions.filter(p => p.label && p.g).map(p => ({ label: p.label, g: parseFloat(p.g) }))
    const { error } = await supabase.from('aliments_custom').insert([{
      nom: form.nom.trim(),
      marque: form.marque.trim() || null,
      categorie: form.categorie || 'Personnalisé',
      energie_kcal: parseFloat(form.energie_kcal) || 0,
      proteines: parseFloat(form.proteines) || 0,
      glucides: parseFloat(form.glucides) || 0,
      lipides: parseFloat(form.lipides) || 0,
      fibres: parseFloat(form.fibres) || 0,
      portions: cleanPortions,
    }])
    setSaving(false)
    if (!error) {
      toast('✓ Aliment sauvegardé !')
      setForm({ nom: '', marque: '', categorie: 'Personnalisé', energie_kcal: '', proteines: '', glucides: '', lipides: '', fibres: '', sel: '' })
      setPortions([{ label: '', g: '' }])
    } else {
      toast('Erreur lors de la sauvegarde')
    }
  }

  return (
    <div className="page-content">
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Aliment personnalisé</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Ajoute un aliment qui n'existe pas dans Ciqual</div>

      <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
        <div className="section-title">Informations</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Nom *</div>
            <input className="input" placeholder="Ex: Galette de riz maison" value={form.nom} onChange={e => set('nom', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Marque</div>
              <input className="input" placeholder="Optionnel" value={form.marque} onChange={e => set('marque', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Catégorie</div>
              <input className="input" placeholder="Personnalisé" value={form.categorie} onChange={e => set('categorie', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
        <div className="section-title">Valeurs pour 100g</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[...FIELDS_LEFT, ...FIELDS_RIGHT].map(f => (
            <div key={f.id}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{f.label}{f.required ? ' *' : ''}</div>
              <div style={{ position: 'relative' }}>
                <input className="input" type="number" min={0} placeholder={f.placeholder} value={form[f.id]} onChange={e => set(f.id, e.target.value)} style={{ paddingRight: 50 }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-hint)', pointerEvents: 'none' }}>{f.unit.split('/')[0]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Portions courantes</div>
          <button onClick={addPortion} style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <PlusCircle size={14} /> Ajouter
          </button>
        </div>
        {portions.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input className="input" placeholder="Ex: 1 oeuf" value={p.label} onChange={e => updatePortion(i, 'label', e.target.value)} style={{ flex: 1 }} />
            <input className="input" type="number" placeholder="g" value={p.g} onChange={e => updatePortion(i, 'g', e.target.value)} style={{ width: 70 }} />
            <span style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0 }}>g</span>
            {portions.length > 1 && (
              <button onClick={() => removePortion(i)} style={{ color: 'var(--coral)', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>×</button>
            )}
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Sauvegarde...' : '💾 Sauvegarder l\'aliment'}
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center', marginTop: 10 }}>
        L'aliment sera disponible dans la recherche
      </div>
    </div>
  )
}
