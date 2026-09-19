import type { AssociationEdge, Cue, CueHit } from "./types";

const WINDOW = 40;

function nearby(a: CueHit, b: CueHit): boolean {
  return Math.abs(a.tokenIndex - b.tokenIndex) <= WINDOW;
}

export function associationBoost(
  hits: CueHit[],
  cues: Cue[],
  edges: AssociationEdge[],
): number {
  if (hits.length < 2) return 0;
  const byId = new Map(cues.map((c) => [c.id, c]));
  const familiesPresent = new Map<string, CueHit[]>();
  const idsPresent = new Map<string, CueHit[]>();
  for (const hit of hits) {
    const idList = idsPresent.get(hit.cueId) ?? [];
    idList.push(hit);
    idsPresent.set(hit.cueId, idList);
    const famList = familiesPresent.get(hit.family) ?? [];
    famList.push(hit);
    familiesPresent.set(hit.family, famList);
  }

  let boost = 0;
  const used = new Set<string>();
  for (const edge of edges) {
    const key = [edge.a, edge.b].sort().join("|");
    if (used.has(key)) continue;
    const aHits = idsPresent.get(edge.a) ?? [];
    const bHits = idsPresent.get(edge.b) ?? [];
    const aCue = byId.get(edge.a);
    const bCue = byId.get(edge.b);

    const bFamilyHits = bCue ? familiesPresent.get(bCue.family) ?? [] : [];
    const aFamilyHits = aCue ? familiesPresent.get(aCue.family) ?? [] : [];

    let paired = false;
    for (const ah of aHits.length ? aHits : aFamilyHits) {
      const candidates = bHits.length ? bHits : bFamilyHits;
      if (candidates.some((bh) => bh.cueId !== ah.cueId && nearby(ah, bh))) {
        paired = true;
        break;
      }
    }
    if (!paired) continue;
    used.add(key);
    const weightA = aCue?.weight ?? 4;
    const weightB = bCue?.weight ?? 4;
    boost += Math.max(weightA, weightB) * edge.strength;
  }
  return boost;
}
