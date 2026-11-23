import type { GameMap, MapNode, NodeKind } from './types';
import type { Rng } from './rng';

/** Rows 0–7, boss on row 8. Every path hits an event, a shop, and a rest. */
export function generateMap(rng: Rng, act: 1 | 2 | 3): GameMap {
  const grid: { id: string; col: number }[][] = [];
  for (let r = 0; r < 8; r++) {
    const count = r === 0 ? 3 : r === 7 ? 2 : rng.int(2, 3);
    const cols = rng
      .shuffle([0, 1, 2, 3, 4, 5, 6])
      .slice(0, count)
      .sort((a, b) => a - b);
    grid.push(cols.map((col) => ({ id: `a${act}r${r}c${col}`, col })));
  }
  grid.push([{ id: `a${act}boss`, col: 3 }]);

  const nodes: MapNode[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (const n of grid[r]) nodes.push({ id: n.id, row: r, col: n.col, kind: 'combat', next: [] });
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (let r = 0; r < grid.length - 1; r++) {
    for (const n of grid[r]) {
      const sorted = [...grid[r + 1]].sort(
        (a, b) => Math.abs(a.col - n.col) - Math.abs(b.col - n.col) || a.col - b.col,
      );
      const node = byId.get(n.id)!;
      node.next.push(sorted[0].id);
      if (sorted[1] && Math.abs(sorted[1].col - n.col) <= 2 && rng.next() < 0.7) node.next.push(sorted[1].id);
    }
    for (const n of grid[r + 1]) {
      const parents = nodes.filter((p) => p.row === r && p.next.includes(n.id));
      if (parents.length === 0) {
        const sorted = [...grid[r]].sort((a, b) => Math.abs(a.col - n.col) - Math.abs(b.col - n.col));
        const parent = byId.get(sorted[0].id)!;
        if (!parent.next.includes(n.id)) parent.next.push(n.id);
      }
    }
  }
  for (const n of nodes) n.next = [...new Set(n.next)];

  const setRow = (row: number, kind: NodeKind) => {
    for (const n of nodes) if (n.row === row) n.kind = kind;
  };
  setRow(0, 'combat');
  setRow(1, 'combat');
  setRow(2, 'event');
  setRow(3, 'combat');
  setRow(4, 'shop');
  setRow(5, 'combat');
  setRow(7, 'rest');
  setRow(8, 'boss');
  const eliteRow = nodes.filter((n) => n.row === 6);
  rng.pick(eliteRow).kind = 'elite';

  return { act, nodes, current: null, path: [] };
}

export function reachableIds(map: GameMap): string[] {
  if (!map.current) return map.nodes.filter((n) => n.row === 0).map((n) => n.id);
  const cur = map.nodes.find((n) => n.id === map.current);
  return cur ? cur.next.slice() : [];
}

export function mapReachesBoss(map: GameMap): boolean {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const starts = map.nodes.filter((n) => n.row === 0);
  const seen = new Set<string>();
  const q = starts.map((s) => s.id);
  while (q.length) {
    const id = q.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = byId.get(id);
    if (!n) return false;
    if (n.kind === 'boss') return true;
    q.push(...n.next);
  }
  return false;
}

export function allNodesReachable(map: GameMap): boolean {
  const seen = new Set<string>();
  const q = map.nodes.filter((n) => n.row === 0).map((n) => n.id);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  while (q.length) {
    const id = q.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = byId.get(id);
    if (n) q.push(...n.next);
  }
  return seen.size === map.nodes.length;
}
