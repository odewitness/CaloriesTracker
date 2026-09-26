import React from 'react'
import { Wheat } from 'lucide-react'
import { mergeFodmapSettings } from '../../lib/fodmap'
import { ToggleSwitch, SectionScreen } from './primitives'

// Écran de détail « FODMAP » (chantier FODMAP, Palier 1 — docs/fodmap.md) :
// active l'affichage de la charge en FODMAP dans les fiches aliments.
// Information uniquement : pas d'accompagnement de régime.
export default function FodmapSection({ fodmap, onPatch, onBack }) {
  const f = mergeFodmapSettings(fodmap)

  return (
    <SectionScreen title="FODMAP" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12 }}>
          <div style={{ color: 'var(--green)', flexShrink: 0 }}><Wheat size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Afficher les FODMAP</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.4 }}>
              dans la fiche d’un aliment, selon la quantité
            </div>
          </div>
          <ToggleSwitch checked={f.enabled} onClick={() => onPatch({ enabled: !f.enabled })} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 10px' }}>
          Les FODMAP sont des sucres que l’intestin absorbe mal : fructanes et GOS (blé, seigle,
          oignon, ail, légumineuses), fructose en excès (pomme, miel), polyols (sorbitol, mannitol)
          et lactose. Ils ne sont pas mauvais pour la santé, mais peuvent donner ballonnements ou
          inconfort quand l’intestin est sensible.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          Tout dépend de la quantité : un même aliment peut être bien toléré en petite portion et
          beaucoup moins en grosse. La fiche compare chaque famille à un seuil par portion et
          t’indique jusqu’à combien de grammes l’aliment reste faible.
        </p>
        <p style={{ margin: 0 }}>
          Les valeurs viennent de tables de composition et de publications scientifiques ; certaines
          sont estimées, et la fiche le précise. C’est une information, pas un conseil médical :
          avant de retirer des aliments, parles-en à un médecin ou à un·e diététicien·ne.
        </p>
      </div>
    </SectionScreen>
  )
}
