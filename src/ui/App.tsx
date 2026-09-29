import { useEffect, useState } from 'preact/hooks';
import type { Controller, Speed } from '../app/controller';
import {
  FAMILY_DEFS,
  gemName,
  gemTowerDef,
  GEMS_PER_ROUND,
  GRADE_NAMES,
  ODDS_TABLE,
  oddsUpgradeCost,
  phaseForWave,
  SPECIALS,
  SPECIALS_BY_ID,
  STONE_REMOVE_COST,
  TOTAL_WAVES,
  towerDef,
  towerName,
  waveDef,
} from '../sim';
import type { GameState, GemSpec, KeepOption, PendingGem, Targeting, TimePhase, Tower } from '../sim';
import { FAMILY_COLOURS } from '../render/gems';
import { attackTags, statLine } from './format';

function useController(ctl: Controller) {
  const [, set] = useState(0);
  useEffect(() => ctl.subscribe(() => set((v) => v + 1)), [ctl]);
}

const PHASE_LABEL: Record<TimePhase, string> = { day: 'Day', dusk: 'Dusk', night: 'Night', dawn: 'Dawn' };
const PHASE_ICON: Record<TimePhase, string> = { day: '☀', dusk: '◐', night: '☾', dawn: '◑' };
const GRADE_COLOURS = ['#9aa0a6', '#8fd18a', '#6fb7ff', '#c58bff', '#ffcf5a'];

export function App({ ctl, backend }: { ctl: Controller; backend: string }) {
  useController(ctl);
  const s = ctl.state;
  return (
    <>
      <TopBar ctl={ctl} s={s} />
      <OddsCard ctl={ctl} s={s} />
      <Prompt ctl={ctl} s={s} />
      <SidePanel ctl={ctl} s={s} />
      {ctl.codexOpen && <Codex ctl={ctl} s={s} />}
      <Toast ctl={ctl} />
      {(s.phase === 'lost' || s.phase === 'won') && <GameOver ctl={ctl} s={s} />}
      <div class="backend">{backend}</div>
    </>
  );
}

function TopBar({ ctl, s }: { ctl: Controller; s: GameState }) {
  const phase = phaseForWave(s.wave);
  const speeds: Speed[] = [1, 2, 4];
  const [confirmNew, setConfirmNew] = useState<{ wasPaused: boolean } | null>(null);
  const openConfirm = () => {
    setConfirmNew({ wasPaused: ctl.paused });
    ctl.paused = true;
    ctl.notify(true);
  };
  const closeConfirm = () => {
    if (confirmNew) ctl.paused = confirmNew.wasPaused;
    setConfirmNew(null);
    ctl.notify(true);
  };
  const restart = (seed?: string) => {
    setConfirmNew(null);
    ctl.newGame(seed);
  };
  return (
    <>
      <div class="panel topleft">
        <span class="stat" title="Heart integrity">
          <i class="ico heart">♥</i>
          {s.lives}
        </span>
        <span class="stat" title="Gold">
          <i class="ico gold">◆</i>
          {s.gold}
        </span>
        <span class="stat">
          Wave <b>{s.wave}</b>
          <span class="dim">/{TOTAL_WAVES}</span>
        </span>
        <span class={`chip phase-${phase}`}>
          {PHASE_ICON[phase]} {PHASE_LABEL[phase]}
        </span>
      </div>
      <div class="panel topright">
        <button class={`icon ${ctl.paused ? 'on' : ''}`} onClick={() => ctl.togglePause()} title="Pause (Space)">
          ❚❚
        </button>
        {speeds.map((sp) => (
          <button key={sp} class={`icon ${!ctl.paused && ctl.speed === sp ? 'on' : ''}`} onClick={() => ctl.setSpeed(sp)} title={`Speed ${sp}×`}>
            {sp}×
          </button>
        ))}
        <span class="sep" />
        <button class={`icon wide ${ctl.codexOpen ? 'on' : ''}`} onClick={() => ctl.toggleCodex()} title="Recipe codex (C)">
          Codex
        </button>
        <button class="icon wide" onClick={openConfirm} title="Start a new run">
          New run
        </button>
      </div>
      {confirmNew && (
        <div class="modal" onClick={closeConfirm}>
          <div class="panel gameover" onClick={(e) => e.stopPropagation()}>
            <h2>Start a new run?</h2>
            <p class="dim">
              Your current run (wave {s.wave}, seed <b>{s.seed}</b>) will be abandoned.
            </p>
            <div class="row">
              <button class="primary" onClick={() => restart()}>
                New run
              </button>
              <button onClick={() => restart(s.seed)} title="Same gem draws, from wave 1">
                Restart this seed
              </button>
              <button onClick={closeConfirm}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OddsCard({ ctl, s }: { ctl: Controller; s: GameState }) {
  const odds = ODDS_TABLE[s.oddsLevel];
  const cost = oddsUpgradeCost(s);
  const next = s.oddsLevel + 1 < ODDS_TABLE.length ? ODDS_TABLE[s.oddsLevel + 1] : null;
  return (
    <div class="panel odds">
      <div class="label">
        Gem quality <span class="dim">· level {s.oddsLevel}</span>
      </div>
      <div class="bar">
        {odds.map((p, g) =>
          p > 0 ? (
            <div key={g} class="seg" style={{ flex: p, background: GRADE_COLOURS[g] }} title={`${GRADE_NAMES[g]} ${p}%`}>
              {p >= 12 ? `${p}%` : ''}
            </div>
          ) : null,
        )}
      </div>
      <div class="legend">
        {GRADE_NAMES.map((n, g) => (
          <span key={n} class={odds[g] ? '' : 'dim'}>
            <i style={{ background: GRADE_COLOURS[g] }} />
            {n}
          </span>
        ))}
      </div>
      {cost !== null && (
        <button class="primary small" disabled={s.gold < cost} onClick={() => ctl.dispatch({ type: 'upgradeOdds' })} title={next ? `Next: ${next.map((p, g) => (p ? `${GRADE_NAMES[g]} ${p}%` : '')).filter(Boolean).join(', ')}` : ''}>
          Improve odds · {cost}◆ <kbd>U</kbd>
        </button>
      )}
    </div>
  );
}

function Prompt({ ctl, s }: { ctl: Controller; s: GameState }) {
  const next = waveDef(s.wave);
  let main: preact.ComponentChildren;
  if (s.phase === 'build') {
    const h = ctl.hover;
    main = (
      <>
        <b>Unearth gems</b> <span class="dim">·</span> {s.pending.length} of {GEMS_PER_ROUND}
        <span class="dim"> · path {Math.round(ctl.pathLength)}</span>
        {h?.check?.ok && h.delta !== null && Math.abs(h.delta) > 0.01 && (
          <span class={h.delta > 0 ? 'good' : 'bad'}>
            {' '}
            ({h.delta > 0 ? '+' : ''}
            {h.delta.toFixed(1)})
          </span>
        )}
        {h?.check && !h.check.ok && <span class="bad"> · {h.check.reason}</span>}
      </>
    );
  } else if (s.phase === 'choose') {
    main = (
      <>
        <b>Choose one gem to keep</b> <span class="dim">· the rest turn to stone</span>
      </>
    );
  } else if (s.phase === 'wave') {
    const left = s.creeps.length + (s.spawn?.remaining ?? 0);
    main = (
      <>
        <b>Wave {s.wave}</b> <span class="dim">·</span> {next.archetype.name} <span class="dim">·</span> {left} remaining
      </>
    );
  } else main = null;
  return (
    <div class="prompt-wrap">
      {main && <div class="panel prompt">{main}</div>}
      {(s.phase === 'build' || s.phase === 'choose') && <WaveCard wave={s.wave} />}
    </div>
  );
}

function WaveCard({ wave }: { wave: number }) {
  const d = waveDef(wave);
  const a = d.archetype;
  return (
    <div class="panel wavecard">
      <span class="dim">Next</span> <b>{a.name}</b> ×{d.count}
      <span class={`chip ${a.air ? 'air' : 'ground'}`}>{a.air ? 'Air' : 'Ground'}</span>
      {a.boss && <span class="chip boss">Boss</span>}
      <span class="dim">
        {' '}
        · {d.hp} hp · armour {d.armor}
        {a.regen ? ` · regen ${Math.round(a.regen * 100)}%/s` : ''} · {a.blurb}
      </span>
    </div>
  );
}

function GemDot({ spec, special }: { spec: GemSpec; special?: string }) {
  const colour = special ? SPECIALS_BY_ID[special].colour : FAMILY_COLOURS[spec.family];
  return (
    <span class="gemdot" style={{ background: colour }}>
      {!special && <span class="pips">{'•'.repeat(spec.grade + 1)}</span>}
    </span>
  );
}

function SidePanel({ ctl, s }: { ctl: Controller; s: GameState }) {
  const sel = ctl.selection;
  if (s.phase === 'choose') return <KeepPanel ctl={ctl} s={s} />;
  if (sel?.kind === 'tower') {
    const t = s.towers.find((t) => t.id === sel.id);
    if (t) return <TowerPanel ctl={ctl} t={t} />;
  }
  if (sel?.kind === 'stone')
    return (
      <div class="panel side">
        <h3>Mossy stone</h3>
        <p class="dim">Left behind by an unkept gem. Part of your maze.</p>
        <button class="primary" disabled={s.gold < STONE_REMOVE_COST || s.phase !== 'build'} onClick={() => ctl.dispatch({ type: 'removeStone', x: sel.x, y: sel.y })}>
          Clear stone · {STONE_REMOVE_COST}◆
        </button>
      </div>
    );
  if (s.phase === 'build' && s.wave === 1 && s.pending.length === 0 && s.towers.length === 0) return <Intro />;
  return null;
}

function Intro() {
  return (
    <div class="panel side intro">
      <h3>The valley awaits</h3>
      <p>Click tiles to unearth gems. Each round you place five and keep only one; the rest calcify into stone.</p>
      <p>Gems and stones both shape the path. Make the Blight walk far, past your best gems.</p>
      <p class="dim">
        Pairs combine into a better grade. Some mixes form special gems — see the <kbd>C</kbd>odex.
      </p>
      <p class="dim keys">
        <kbd>WASD</kbd> pan · <kbd>Wheel</kbd> zoom · <kbd>Q</kbd>/<kbd>E</kbd> rotate · <kbd>Space</kbd> pause
      </p>
    </div>
  );
}

function optionLabel(s: GameState, o: KeepOption): { title: string; def: ReturnType<typeof towerDef>; special?: string; spec?: GemSpec } {
  switch (o.kind) {
    case 'keep':
      return { title: `Keep ${gemName(o.result.family, o.result.grade)}`, def: gemTowerDef(o.result.family, o.result.grade), spec: o.result };
    case 'combine':
      return { title: `Combine → ${gemName(o.result.family, o.result.grade)}`, def: gemTowerDef(o.result.family, o.result.grade), spec: o.result };
    case 'recipe': {
      const sp = SPECIALS_BY_ID[o.recipeId];
      return { title: `Forge ${sp.levels[0].name}`, def: sp.levels[0], special: sp.id };
    }
    case 'upgrade': {
      const sp = SPECIALS_BY_ID[o.specialId];
      const t = s.towers.find((t) => t.id === o.towerId)!;
      return { title: `Upgrade ${towerName(t)} → ${sp.levels[o.toLevel].name}`, def: sp.levels[o.toLevel], special: sp.id };
    }
  }
}

function KeepPanel({ ctl, s }: { ctl: Controller; s: GameState }) {
  const selId = ctl.selection?.kind === 'pending' ? ctl.selection.id : null;
  return (
    <div class="panel side keep">
      <h3>Keep one</h3>
      {s.pending.map((p) => (
        <PendingRow key={p.id} ctl={ctl} s={s} p={p} open={selId === p.id} />
      ))}
      <p class="dim hint">Click a gem to see its range. Combines and forges appear on each ingredient.</p>
    </div>
  );
}

function PendingRow({ ctl, s, p, open }: { ctl: Controller; s: GameState; p: PendingGem; open: boolean }) {
  const opts = ctl.keepOptions(p.id);
  const extra = opts.filter((o) => o.kind !== 'keep');
  return (
    <div class={`pending ${open ? 'open' : ''}`} onMouseEnter={() => ctl.clickTile(p.x, p.y)}>
      {opts.map((o, i) => {
        const L = optionLabel(s, o);
        const best = o.kind === 'recipe' || o.kind === 'upgrade' || o.kind === 'combine';
        return (
          <button key={i} class={`option ${best ? 'best' : ''} ${o.kind === 'keep' && extra.length ? 'plain' : ''}`} onClick={() => ctl.keep(o)}>
            <GemDot spec={L.spec ?? p} special={L.special} />
            <span class="otext">
              <span class="otitle">{L.title}</span>
              <span class="ostats">
                {statLine(L.def)}
                {attackTags(L.def).length > 0 && <> · {attackTags(L.def).join(' · ')}</>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TARGETINGS: Targeting[] = ['first', 'last', 'strongest', 'weakest', 'closest'];

function TowerPanel({ ctl, t }: { ctl: Controller; t: Tower }) {
  const def = towerDef(t);
  const sp = t.specialId ? SPECIALS_BY_ID[t.specialId] : null;
  const nextUp = sp && t.level + 1 < sp.levels.length ? sp.upgrades[t.level] : null;
  return (
    <div class="panel side">
      <h3>
        <GemDot spec={t} special={t.specialId} /> {towerName(t)}
      </h3>
      <p class="dim">{sp ? def.description : FAMILY_DEFS[t.family].role}</p>
      <div class="kv">
        <span>Damage</span>
        <b>{def.attack.damage}</b>
        <span>Range</span>
        <b>{def.attack.range.toFixed(1)}</b>
        <span>Attack every</span>
        <b>{(def.attack.cooldown / (1 + t.auraBonus)).toFixed(2)}s</b>
        <span>Kills</span>
        <b>{t.kills}</b>
        <span>Damage dealt</span>
        <b>{Math.round(t.damage).toLocaleString()}</b>
      </div>
      <div class="tags">
        {attackTags(def).map((x) => (
          <span key={x} class="chip">
            {x}
          </span>
        ))}
        {t.auraBonus > 0 && <span class="chip good">+{Math.round(t.auraBonus * 100)}% speed from aura</span>}
      </div>
      <div class="label">Targeting</div>
      <div class="seg-control">
        {TARGETINGS.map((x) => (
          <button key={x} class={t.targeting === x ? 'on' : ''} onClick={() => ctl.setTargeting(t.id, x)}>
            {x}
          </button>
        ))}
      </div>
      {nextUp && (
        <p class="dim hint">
          Upgrades with a {gemName(nextUp.family, nextUp.grade)} → {sp!.levels[t.level + 1].name}
        </p>
      )}
    </div>
  );
}

function Codex({ ctl, s }: { ctl: Controller; s: GameState }) {
  const counts = (list: GemSpec[]) => {
    const pool = [...s.pending];
    let have = 0;
    for (const ing of list) {
      const i = pool.findIndex((p) => p.family === ing.family && p.grade === ing.grade);
      if (i >= 0) {
        have++;
        pool.splice(i, 1);
      }
    }
    return have;
  };
  return (
    <div class="modal" onClick={() => ctl.toggleCodex(false)}>
      <div class="panel codex" onClick={(e) => e.stopPropagation()}>
        <div class="codex-head">
          <h2>Codex</h2>
          <span class="dim">Special gems form when their ingredients are unearthed in the same round.</span>
          <button class="icon" onClick={() => ctl.toggleCodex(false)}>
            ✕
          </button>
        </div>
        <div class="grid">
          {SPECIALS.map((sp) => {
            const have = s.pending.length ? counts(sp.ingredients) : 0;
            const status = have === sp.ingredients.length ? 'ready' : have === sp.ingredients.length - 1 && have > 0 ? 'near' : '';
            return (
              <div key={sp.id} class={`recipe ${status}`}>
                <div class="rhead">
                  <GemDot spec={{ family: sp.family, grade: 4 }} special={sp.id} />
                  <b>{sp.levels[0].name}</b>
                  {status === 'ready' && <span class="chip good">Ready</span>}
                  {status === 'near' && <span class="chip">One away</span>}
                </div>
                <div class="ings">
                  {sp.ingredients.map((g, i) => (
                    <span key={i} class="ing">
                      <GemDot spec={g} />
                      {gemName(g.family, g.grade)}
                    </span>
                  ))}
                </div>
                <div class="dim small">{sp.levels[0].description}</div>
                <div class="dim small">{statLine(sp.levels[0])}</div>
                {sp.upgrades.map((u, i) => (
                  <div key={i} class="dim small">
                    + {gemName(u.family, u.grade)} → {sp.levels[i + 1].name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Toast({ ctl }: { ctl: Controller }) {
  const [visible, setVisible] = useState<number | null>(null);
  const id = ctl.toast?.id ?? null;
  useEffect(() => {
    if (id === null) return;
    setVisible(id);
    const t = setTimeout(() => setVisible(null), 1800);
    return () => clearTimeout(t);
  }, [id]);
  if (!ctl.toast || visible !== ctl.toast.id) return null;
  return <div class="toast">{ctl.toast.text}</div>;
}

function GameOver({ ctl, s }: { ctl: Controller; s: GameState }) {
  const won = s.phase === 'won';
  const best = [...s.towers].sort((a, b) => b.damage - a.damage).slice(0, 3);
  return (
    <div class="modal">
      <div class="panel gameover">
        <h2>{won ? 'The Heart endures' : 'The Heart has shattered'}</h2>
        <p class="dim">{won ? `All ${TOTAL_WAVES} waves repelled.` : `Fell on wave ${s.wave}.`}</p>
        <div class="kv">
          <span>Creeps felled</span>
          <b>{s.stats.kills}</b>
          <span>Leaks</span>
          <b>{s.stats.leaks}</b>
          <span>Gold earned</span>
          <b>{s.stats.goldEarned}</b>
          <span>Special gems</span>
          <b>{s.stats.specialsMade}</b>
          <span>Final path length</span>
          <b>{s.stats.mazeLengthByWave.at(-1) ?? 0}</b>
          <span>Seed</span>
          <b>{s.seed}</b>
        </div>
        {best.length > 0 && (
          <>
            <div class="label">Top gems</div>
            {best.map((t) => (
              <div key={t.id} class="toprow">
                <GemDot spec={t} special={t.specialId} /> {towerName(t)} <span class="dim">· {Math.round(t.damage).toLocaleString()} dmg</span>
              </div>
            ))}
          </>
        )}
        <div class="row">
          <button class="primary" onClick={() => ctl.newGame()}>
            New run
          </button>
          <button onClick={() => ctl.newGame(s.seed)}>Retry seed</button>
        </div>
      </div>
    </div>
  );
}
