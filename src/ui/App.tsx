import { useEffect, useState } from 'preact/hooks';
import type { Controller, Speed } from '../app/controller';
import {
  abilityTags,
  gemName,
  GEMS_PER_ROUND,
  isSpecialIngredient,
  GRADE_NAMES,
  ODDS_TABLE,
  oddsUpgradeCost,
  phaseForWave,
  SPECIALS,
  SPECIALS_BY_ID,
  TOTAL_WAVES,
  towerName,
  waveDef,
} from '../sim';
import type { GameState, Ingredient, TimePhase } from '../sim';
import { GemDot } from './GemDot';
import { WorldLayer } from './World';
import { statLine } from './format';

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
      <SidePanel s={s} />
      <WorldLayer ctl={ctl} s={s} />
      {ctl.codexOpen && <Codex ctl={ctl} s={s} />}
      <Toast ctl={ctl} />
      {(s.phase === 'lost' || s.phase === 'won') && <GameOver ctl={ctl} s={s} />}
      <div class="backend">{backend}</div>
    </>
  );
}

function TopBar({ ctl, s }: { ctl: Controller; s: GameState }) {
  const phase = phaseForWave(s.wave);
  const speeds: Speed[] = [1, 2, 4, 10];
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
          <button key={sp} class={`icon ${sp === 10 ? 'dev' : ''} ${!ctl.paused && ctl.speed === sp ? 'on' : ''}`} onClick={() => ctl.setSpeed(sp)} title={sp === 10 ? 'Speed 10× (for testing)' : `Speed ${sp}×`}>
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
        <b>Choose one gem to keep</b> <span class="dim">· click a gem for its options · the rest turn to stone</span>
      </>
    );
  } else if (s.phase === 'wave') {
    const def = waveDef(s.seed, s.wave);
    const left = s.creeps.length + (s.spawn ? s.spawn.total - s.spawn.next : 0);
    main = (
      <>
        <b>Wave {s.wave}</b> <span class="dim">·</span> {def.groups.map((g) => g.archetype.name).join(' + ')} <span class="dim">·</span> {left} remaining
      </>
    );
  } else main = null;
  return (
    <div class="prompt-wrap">
      {main && <div class="panel prompt">{main}</div>}
      {(s.phase === 'build' || s.phase === 'choose') && <WaveCard s={s} />}
    </div>
  );
}

function WaveCard({ s }: { s: GameState }) {
  const d = waveDef(s.seed, s.wave);
  const kindLabel: Record<string, string> = { boss: 'Boss', elite: 'Elite', air: 'Air', mixed: 'Mixed' };
  return (
    <div class="panel wavecard">
      <span class="dim">Next </span>
      {kindLabel[d.kind] && <span class={`chip ${d.kind}`}>{kindLabel[d.kind]}</span>}
      {d.groups.map((g, i) => (
        <span key={i} class="wgroup">
          {i > 0 && <span class="dim"> + </span>}
          <b>
            {g.elite ? 'Elite ' : ''}
            {g.archetype.name}
          </b>{' '}
          ×{g.count} <span class="dim">({g.hp} hp)</span>
          {abilityTags(g.archetype).filter((t) => !(t === 'Air' && d.kind === 'air')).map((t) => (
            <span key={t} class="chip">
              {t}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function SidePanel({ s }: { s: GameState }) {
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
        Between waves, click a gem to combine it with matching gems on the board, forge special gems, and grow them from rough stones into Perfect jewels. See the <kbd>C</kbd>odex.
      </p>
      <p class="dim keys">
        <kbd>WASD</kbd> pan · <kbd>Wheel</kbd> zoom · <kbd>Q</kbd>/<kbd>E</kbd> rotate · <kbd>Space</kbd> pause · <kbd>1</kbd>–<kbd>4</kbd> speed
      </p>
    </div>
  );
}

export function Ingredients({ list }: { list: Ingredient[] }) {
  return (
    <div class="ings">
      {list.map((g, i) =>
        isSpecialIngredient(g) ? (
          <span key={i} class="ing">
            <GemDot spec={{ family: SPECIALS_BY_ID[g.special].family, grade: 4 }} special={g.special} />
            {SPECIALS_BY_ID[g.special].levels[0].name}
          </span>
        ) : (
          <span key={i} class="ing">
            <GemDot spec={g} />
            {gemName(g.family, g.grade)}
          </span>
        ),
      )}
    </div>
  );
}

function Codex({ ctl, s }: { ctl: Controller; s: GameState }) {
  // Materials on hand: this round's gems plus everything on the board.
  const materials = [
    ...s.pending.map((p) => ({ kind: 'gem' as const, family: p.family, grade: p.grade, specialId: undefined as string | undefined })),
    ...s.towers.map((t) => ({ kind: t.kind, family: t.family, grade: t.grade, specialId: t.specialId })),
  ];
  const have = (list: Ingredient[]) => {
    const pool = [...materials];
    let n = 0;
    for (const ing of list) {
      const i = pool.findIndex((m) => (isSpecialIngredient(ing) ? m.specialId === ing.special : m.kind === 'gem' && m.family === ing.family && m.grade === ing.grade));
      if (i >= 0) {
        n++;
        pool.splice(i, 1);
      }
    }
    return n;
  };
  const card = (sp: (typeof SPECIALS)[number]) => {
    const n = have(sp.ingredients);
    const status = n === sp.ingredients.length ? 'ready' : n === sp.ingredients.length - 1 && n > 0 ? 'near' : '';
    return (
      <div key={sp.id} class={`recipe ${status}`}>
        <div class="rhead">
          <GemDot spec={{ family: sp.family, grade: 4 }} special={sp.id} />
          <b>{sp.levels[0].name}</b>
          {status === 'ready' && <span class="chip good">Ready</span>}
          {status === 'near' && <span class="chip">One away</span>}
        </div>
        <Ingredients list={sp.ingredients} />
        <div class="dim small">{sp.levels[0].description}</div>
        <div class="dim small">{statLine(sp.levels[0])}</div>
        {sp.upgrades.map((u, i) => (
          <div key={i} class="dim small">
            + {gemName(u.family, u.grade)} → {sp.levels[i + 1].name}
          </div>
        ))}
      </div>
    );
  };
  return (
    <div class="modal" onClick={() => ctl.toggleCodex(false)}>
      <div class="panel codex" onClick={(e) => e.stopPropagation()}>
        <div class="codex-head">
          <h2>Codex</h2>
          <span class="dim">Forge specials from gems unearthed together, or between waves from gems already on the board.</span>
          <button class="icon" onClick={() => ctl.toggleCodex(false)}>
            ✕
          </button>
        </div>
        <div class="grid">{SPECIALS.filter((sp) => !sp.master).map(card)}</div>
        <h3 class="codex-sub">Master gems</h3>
        <p class="dim small">Forged between waves from special gems on the board.</p>
        <div class="grid">{SPECIALS.filter((sp) => sp.master).map(card)}</div>
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
