import { SPECIALS_BY_ID } from '../sim';
import type { GemSpec } from '../sim';
import { FAMILY_COLOURS } from '../render/gems';

export function GemDot({ spec, special }: { spec: GemSpec; special?: string }) {
  const colour = special ? SPECIALS_BY_ID[special].colour : FAMILY_COLOURS[spec.family];
  return (
    <span class={`gemdot ${special ? 'special' : `g${spec.grade}`}`} style={{ background: colour }}>
      {!special && <span class="pips">{'•'.repeat(spec.grade + 1)}</span>}
    </span>
  );
}
