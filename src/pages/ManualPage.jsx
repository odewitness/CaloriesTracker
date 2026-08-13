import React, { useState, useRef, useEffect } from 'react'
import { Plus, Apple, UtensilsCrossed, CalendarDays } from 'lucide-react'
import CustomFoodsSection from '../components/CustomFoodsSection'
import RecipesSection from '../components/RecipesSection'
import MealTemplatesSection from '../components/MealTemplatesSection'

// ─────────────────────────────────────────────────────────────────────────────
// Sous-menu "Nouveau" (dropdown)
// ─────────────────────────────────────────────────────────────────────────────
function NewMenu({ onNewAliment, onNewRecette, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 50, minWidth: 180,
      background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--border-md)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden',
    }}>
      <button
        onClick={() => { onClose(); onNewAliment() }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)', borderBottom: '0.5px solid var(--border)' }}
      >
        <Apple size={17} color="var(--green)" />
        Nouvel aliment
      </button>
      <button
        onClick={() => { onClose(); onNewRecette() }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)' }}
      >
        <UtensilsCrossed size={17} color="var(--green)" />
        Nouvelle recette
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ManualPage — page principale : switch d'onglets Aliments / Recettes / Repas
// types + menu "Nouveau" partagé. Chaque onglet est extrait dans son propre
// composant (CustomFoodsSection, RecipesSection, MealTemplatesSection) mais
// reste monté en permanence (sauf Repas types, déjà ainsi avant ce découpage)
// pour ne pas perdre son état quand on change d'onglet.
// ─────────────────────────────────────────────────────────────────────────────
export default function ManualPage() {
  // ── Onglet actif : 'aliments' | 'recettes' | 'repas' ────────────────────
  const [tab, setTab] = useState('aliments')

  // Le formulaire "Nouvel aliment / Modifier l'aliment" prend toute la page,
  // indépendamment de l'onglet actif — CustomFoodsSection nous prévient via
  // onFormOpenChange quand il s'ouvre/se ferme.
  const [alimentFormOpen, setAlimentFormOpen] = useState(false)

  // ── Sous-menu "Nouveau" ───────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtnRef = useRef(null)

  const foodsRef = useRef(null)
  const recipesRef = useRef(null)

  // Un SEUL <div className="page-content"> englobant, toujours monté — et
  // CustomFoodsSection/RecipesSection toujours rendus dedans, dans une
  // position stable de l'arbre (jamais dans deux branches différentes du
  // return). Ça évite tout remontage (donc toute perte d'état : formulaire
  // aliment en cours de saisie, recherche/tri recettes...) quand
  // alimentFormOpen bascule. Seuls le header et le switch d'onglets — sans
  // état propre à préserver — sont masqués pendant que le formulaire aliment
  // prend toute la page, pour reproduire le "plein écran" d'avant.
  return (
    <div className="page-content">
      {!alimentFormOpen && (
        <>
          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>Mes aliments</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aliments et recettes personnalisés</div>
            </div>
            <div style={{ position: 'relative' }} ref={menuBtnRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ background: 'var(--green)', color: 'white', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Plus size={16} /> Nouveau
              </button>
              {menuOpen && (
                <NewMenu
                  onClose={() => setMenuOpen(false)}
                  onNewAliment={() => foodsRef.current?.startNew()}
                  onNewRecette={() => recipesRef.current?.openNew()}
                />
              )}
            </div>
          </div>

          {/* ── Switch tabs ── */}
          <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 16 }}>
            {[
              { key: 'aliments', label: 'Aliments', icon: <Apple size={14} /> },
              { key: 'recettes', label: 'Recettes', icon: <UtensilsCrossed size={14} /> },
              { key: 'repas',    label: 'Repas types', icon: <CalendarDays size={14} /> },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
                  background: tab === t.key ? 'var(--white)' : 'transparent',
                  color:      tab === t.key ? 'var(--text)'  : 'var(--text-muted)',
                  boxShadow:  tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Onglet Aliments ── */}
      <CustomFoodsSection ref={foodsRef} active={tab === 'aliments'} onFormOpenChange={setAlimentFormOpen} />

      {/* ── Onglet Recettes ── */}
      <RecipesSection ref={recipesRef} active={tab === 'recettes' && !alimentFormOpen} />

      {/* ── Onglet Repas types ── */}
      {tab === 'repas' && !alimentFormOpen && <MealTemplatesSection />}
    </div>
  )
}
