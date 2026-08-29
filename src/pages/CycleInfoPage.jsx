import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PHASES, PHASE_GUIDANCE } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// Page « Cycle & alimentation » — explications pour l'utilisatrice (ton
// tutoiement, sans jargon). Ce qui change côté assiette à chaque phase, les
// minéraux/vitamines à privilégier, et surtout ce que la science dit vraiment
// (effets réels mais modestes). Ouverte depuis Profil › Cycle & alimentation.
// Rendue dans un .page-modal (en-tête + fermeture gérés par App.jsx).
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_SEQUENCE = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale']

const PHASE_WHEN = {
  menstruelle: 'Les premiers jours, à partir du 1er jour des règles.',
  folliculaire: 'Après les règles, jusqu\'aux environs de l\'ovulation.',
  ovulatoire: 'Autour du milieu du cycle, sur 2–3 jours.',
  luteale: 'La seconde moitié du cycle, jusqu\'aux règles suivantes.',
}

export default function CycleInfoPage() {
  return (
    <div className="page-content" style={{ padding: '16px 16px 40px' }}>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
        Tes hormones varient au fil du cycle, et ça influence un peu ton appétit,
        tes envies et ta façon d'utiliser l'énergie. CaloriesTracker te situe dans
        ton cycle et te donne quelques repères pour ton assiette. À garder en
        tête : <strong>les effets sont réels mais modestes</strong> — on parle de
        l'ordre de 150 kcal et de quelques grammes par-ci par-là, pas d'un régime
        différent à chaque phase.
      </p>

      <div className="section-title">Les 4 phases</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {PHASE_SEQUENCE.map(key => {
          const p = PHASES[key]
          const g = PHASE_GUIDANCE[key]
          return (
            <div key={key} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${p.color}` }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.emoji} {p.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-hint)', marginTop: 2 }}>{PHASE_WHEN[key]}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 8 }}>{g.notes}</div>
              {g.focus.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {g.focus.map(f => (
                    <span key={f} className="chip" style={{ background: 'var(--green-light)', color: 'var(--green-dark)', fontSize: 11 }}>
                      À privilégier : {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="section-title">Minéraux &amp; vitamines selon le moment</div>
      <div className="card" style={{ padding: '4px 0', marginBottom: 8 }}>
        <MicroRow
          titre="Fer — pendant et juste après les règles"
          texte="Tes règles te font perdre du fer (autour de 15 à 30 mg par cycle, davantage si elles sont abondantes — renseigne leur intensité dans l'écran Cycle & alimentation et l'app t'en donne une estimation). Associe des aliments qui en contiennent (viande rouge, boudin, lentilles, épinards…) à une source de vitamine C (agrumes, poivron, kiwi) : ça aide à l'absorber."
        />
        <MicroRow
          titre="Calcium — en phase lutéale"
          texte="C'est le nutriment avec les meilleures preuves pour atténuer l'inconfort d'avant-règles. Produits laitiers, sardines, tofu, amandes, eaux riches en calcium."
        />
        <MicroRow
          titre="Magnésium — en phase lutéale"
          texte="Peut aider sur la tension nerveuse et la rétention d'eau d'avant-règles. Chocolat noir, oléagineux, légumineuses, céréales complètes."
        />
        <MicroRow
          titre="Un mot sur les compléments"
          texte="Aucune supplémentation (fer, vitamine D, vitamine B6…) ne se décide sans une prise de sang. Trop de fer est nocif, et la vitamine B6 à forte dose sur la durée peut abîmer les nerfs. L'app t'oriente vers des aliments, pas vers des gélules."
          muted
        />
      </div>

      <Collapsible title="Ce que la science dit vraiment (et ne dit pas)">
        <p>
          Il existe de vraies variations d'un bout à l'autre du cycle : un peu plus
          d'appétit et de dépense au repos en phase lutéale (souvent chiffré autour
          de +150 kcal/j), des envies de sucre plus fréquentes juste avant les
          règles, une tolérance au sucre un peu meilleure en première moitié de
          cycle.
        </p>
        <p>
          Mais les études sont peu nombreuses, souvent basées sur ce que les
          participantes déclarent manger, et leurs résultats se contredisent
          parfois. Le « cycle syncing » qu'on voit sur les réseaux — manger
          radicalement différemment à chaque phase — n'a pas de preuve sérieuse
          derrière lui. D'où le parti pris ici : t'informer et te proposer de
          petits ajustements, jamais t'imposer un cadre rigide.
        </p>
      </Collapsible>

      <Collapsible title="Bon à savoir">
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>Ce n'est <strong>pas un avis médical</strong>, et ça ne sert ni de contraception ni de suivi de fertilité.</li>
          <li>Les dates de phases et de prochaines règles sont des <strong>estimations</strong> (± quelques jours), d'autant plus approximatives si tes cycles sont irréguliers.</li>
          <li>L'idée est d'<strong>ajouter</strong> un peu en phase lutéale si tu en ressens le besoin, pas de te restreindre le reste du temps.</li>
          <li>Si tu es sous contraception hormonale, active l'option correspondante : la logique de phases ne s'applique plus, l'app garde juste le suivi de tes règles.</li>
          <li>Si tes règles disparaissent plusieurs mois sans raison connue, parles-en à un·e professionnel·le : ça peut être le signe d'un apport en énergie trop bas.</li>
        </ul>
      </Collapsible>

      <Collapsible title="Sources">
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>ANSES — références nutritionnelles (apports conseillés en fer, calcium, magnésium…)</li>
          <li>Nutrition Reviews (2023–2025) — revues et méta-analyses sur l'apport énergétique au fil du cycle</li>
          <li>Essais cliniques sur calcium, magnésium et vitamine B6 dans le syndrome prémenstruel</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          Le détail des références est dans le document de conception de l'app.
        </p>
      </Collapsible>
    </div>
  )
}

function MicroRow({ titre, texte, muted }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: muted ? 'var(--text-muted)' : 'var(--text)' }}>{titre}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 3 }}>{texte}</div>
    </div>
  )
}

function Collapsible({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', fontFamily: 'var(--font)', textAlign: 'left', background: 'none' }}
      >
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        {open ? <ChevronDown size={16} color="var(--text-hint)" /> : <ChevronRight size={16} color="var(--text-hint)" />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}
