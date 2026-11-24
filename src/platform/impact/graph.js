// @ts-check
// Street graph from GeoJSON LineStrings, nearest-node lookup and Dijkstra. No parameters live here:
// the snap tolerance and search cut-off are caller inputs.
import { haversineM } from '../schema/geo.js';

/**
 * @typedef {[number, number]} Position
 * @typedef {{ id: number, position: Position }} GraphNode
 * @typedef {{ id: number, a: number, b: number, lengthM: number, featureId: string|null, crossing: boolean, segment: [Position, Position] }} GraphEdge
 * @typedef {{ nodes: GraphNode[], edges: GraphEdge[], adjacency: { to: number, edge: number }[][], snapToleranceM: number, cutEdgeCount: number }} Graph
 */

/** @param {any} f @returns {Position[][]} */
function linesOf(f) {
  const g = f && f.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}

/**
 * Build an undirected graph. Every vertex becomes a node; vertices within snapToleranceM share a node.
 * A feature with properties.crossing, .bridge or .tunnel === true yields edges flagged as crossings.
 * @param {any[]} features GeoJSON Feature<LineString|MultiLineString>
 * @param {{ snapToleranceM: number }} options
 * @returns {Graph}
 */
export function buildGraph(features, options) {
  const tol = options && options.snapToleranceM;
  if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 0) {
    throw new TypeError('buildGraph: options.snapToleranceM (metres, >= 0) is required; there is no default');
  }
  /** @type {GraphNode[]} */ const nodes = [];
  /** @type {GraphEdge[]} */ const edges = [];
  /** @type {{ to: number, edge: number }[][]} */ const adjacency = [];
  /** @type {Map<string, number[]>} */ const hash = new Map();
  const cs = tol / 110000; // hash cell in degrees; neighbours are searched so that tol is always covered
  /** @param {Position} p */
  const cellOf = (p) => (cs > 0 ? [Math.floor(p[0] / cs), Math.floor(p[1] / cs)] : [p[0], p[1]]);
  /** @param {Position} p */
  function nodeFor(p) {
    const [cx, cy] = cellOf(p);
    let best = -1, bestD = Infinity;
    if (cs > 0) {
      const lonRing = Math.ceil(1 / Math.max(0.05, Math.cos(p[1] * Math.PI / 180)));
      for (let dx = -lonRing; dx <= lonRing; dx++) for (let dy = -1; dy <= 1; dy++) {
        const b = hash.get(`${cx + dx}|${cy + dy}`);
        if (!b) continue;
        for (const id of b) {
          const d = haversineM(nodes[id].position, p);
          if (d <= tol && d < bestD) { best = id; bestD = d; }
        }
      }
    } else {
      const b = hash.get(`${cx}|${cy}`);
      if (b) best = b[0];
    }
    if (best >= 0) return best;
    const id = nodes.length;
    nodes.push({ id, position: [p[0], p[1]] });
    adjacency.push([]);
    const k = `${cx}|${cy}`;
    const b = hash.get(k);
    if (b) b.push(id); else hash.set(k, [id]);
    return id;
  }

  features.forEach((f, fi) => {
    const props = (f && f.properties) || {};
    const crossing = props.crossing === true || props.bridge === true || props.tunnel === true;
    const featureId = f && (f.id !== undefined ? String(f.id) : props.id !== undefined ? String(props.id) : String(fi));
    for (const line of linesOf(f)) {
      for (let i = 1; i < line.length; i++) {
        const p = line[i - 1], q = line[i];
        const a = nodeFor(p), b = nodeFor(q);
        if (a === b) continue;
        const id = edges.length;
        edges.push({ id, a, b, lengthM: haversineM(nodes[a].position, nodes[b].position), featureId, crossing, segment: [p, q] });
        adjacency[a].push({ to: b, edge: id });
        adjacency[b].push({ to: a, edge: id });
      }
    }
  });
  return { nodes, edges, adjacency, snapToleranceM: tol, cutEdgeCount: 0 };
}

/**
 * A copy of the graph without the given edge ids (nodes are shared).
 * @param {Graph} graph @param {Set<number>} removed @returns {Graph}
 */
export function withoutEdges(graph, removed) {
  const adjacency = graph.adjacency.map((l) => l.filter((x) => !removed.has(x.edge)));
  return { ...graph, adjacency, cutEdgeCount: graph.cutEdgeCount + removed.size };
}

/** @type {WeakMap<Graph, any>} */
const indexes = new WeakMap();

/** @param {Graph} graph */
function indexOf(graph) {
  let ix = indexes.get(graph);
  if (ix) return ix;
  const n = graph.nodes.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const nd of graph.nodes) {
    minX = Math.min(minX, nd.position[0]); maxX = Math.max(maxX, nd.position[0]);
    minY = Math.min(minY, nd.position[1]); maxY = Math.max(maxY, nd.position[1]);
  }
  const k = n ? Math.cos(((minY + maxY) / 2) * Math.PI / 180) : 1;
  const dim = Math.max(1, Math.ceil(Math.sqrt(n)));
  const sx = Math.max((maxX - minX) * k, 1e-12) / dim, sy = Math.max(maxY - minY, 1e-12) / dim;
  /** @type {Map<number, number[]>} */ const cells = new Map();
  for (const nd of graph.nodes) {
    const cx = Math.min(dim - 1, Math.floor((nd.position[0] - minX) * k / sx));
    const cy = Math.min(dim - 1, Math.floor((nd.position[1] - minY) / sy));
    const key = cy * dim + cx;
    const l = cells.get(key);
    if (l) l.push(nd.id); else cells.set(key, [nd.id]);
  }
  ix = { minX, minY, k, dim, sx, sy, cells };
  indexes.set(graph, ix);
  return ix;
}

/**
 * Nearest node by straight-line distance (access leg). Null for an empty graph.
 * @param {Graph} graph @param {Position} position @returns {{ node: number, distanceM: number }|null}
 */
export function nearestNode(graph, position) {
  if (!graph.nodes.length) return null;
  const { minX, minY, k, dim, sx, sy, cells } = indexOf(graph);
  const px = (position[0] - minX) * k, py = position[1] - minY;
  const cx = Math.floor(px / sx), cy = Math.floor(py / sy);
  let best = -1, bestD2 = Infinity;
  const maxR = dim + Math.max(Math.abs(cx), Math.abs(cy)) + 1;
  for (let r = 0; r <= maxR; r++) {
    if (best >= 0 && (r - 1) * Math.min(sx, sy) > Math.sqrt(bestD2)) break;
    for (let y = cy - r; y <= cy + r; y++) {
      if (y < 0 || y >= dim) continue;
      const edgeRow = y === cy - r || y === cy + r;
      for (let x = cx - r; x <= cx + r; x += edgeRow ? 1 : 2 * r || 1) {
        if (x < 0 || x >= dim) continue;
        const l = cells.get(y * dim + x);
        if (!l) continue;
        for (const id of l) {
          const nd = graph.nodes[id];
          const dx = (nd.position[0] - minX) * k - px, dy = nd.position[1] - minY - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) { bestD2 = d2; best = id; }
        }
      }
    }
  }
  return { node: best, distanceM: haversineM(graph.nodes[best].position, position) };
}

/** Binary min-heap of (key, value) pairs. */
class Heap {
  constructor() { /** @type {number[]} */ this.k = []; /** @type {number[]} */ this.v = []; }
  get size() { return this.k.length; }
  /** @param {number} key @param {number} val */
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const topK = k[0], topV = v[0];
    const lastK = /** @type {number} */ (k.pop()), lastV = /** @type {number} */ (v.pop());
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastK) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lastK; v[i] = lastV;
    }
    return { key: topK, val: topV };
  }
}

/**
 * Shortest network distance (metres) from the sources to every node; Infinity where not reached within maxDistanceM.
 * @param {Graph} graph
 * @param {(number|{ node: number, offsetM: number })[]} sources node ids, or nodes with an access offset
 * @param {number} maxDistanceM search cut-off (required; pass Infinity for none)
 * @returns {Float64Array}
 */
export function dijkstra(graph, sources, maxDistanceM) {
  if (typeof maxDistanceM !== 'number' || Number.isNaN(maxDistanceM)) throw new TypeError('dijkstra: maxDistanceM is required');
  const dist = new Float64Array(graph.nodes.length).fill(Infinity);
  const heap = new Heap();
  for (const s of sources) {
    const node = typeof s === 'number' ? s : s.node, off = typeof s === 'number' ? 0 : s.offsetM;
    if (!(node >= 0 && node < dist.length)) throw new RangeError('dijkstra: unknown source node ' + node);
    if (off <= maxDistanceM && off < dist[node]) { dist[node] = off; heap.push(off, node); }
  }
  while (heap.size) {
    const { key, val } = heap.pop();
    if (key > dist[val]) continue;
    for (const { to, edge } of graph.adjacency[val]) {
      const nd = key + graph.edges[edge].lengthM;
      if (nd < dist[to] && nd <= maxDistanceM) { dist[to] = nd; heap.push(nd, to); }
    }
  }
  return dist;
}
