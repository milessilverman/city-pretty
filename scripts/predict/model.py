"""Models and metrics for the walk-forward test (docs/PREDICTION-MODEL.md A.6-A.7). numpy only."""
import numpy as np


# ---------------------------------------------------------------- ranks
def centred_ranks(v):
    """Percentile ranks of the non-missing values ((rank - 0.5) / n - 0.5, ties averaged); missing -> 0 (the middle)."""
    v = np.asarray(v, dtype=float)
    out = np.zeros(len(v))
    ok = ~np.isnan(v)
    n = ok.sum()
    if n == 0:
        return out
    x = v[ok]
    order = np.argsort(x, kind="mergesort")
    r = np.empty(n)
    xs = x[order]
    i = 0
    while i < n:
        j = i
        while j + 1 < n and xs[j + 1] == xs[i]:
            j += 1
        r[order[i:j + 1]] = (i + j) / 2 + 0.5
        i = j + 1
    out[ok] = r / n - 0.5
    return out


def rank01(v):
    v = np.asarray(v, dtype=float)
    return centred_ranks(v) + 0.5


# ---------------------------------------------------------------- ridge
def ridge_fit(X, y, lam):
    n, p = X.shape
    A = X.T @ X + lam * n * np.eye(p)
    return np.linalg.solve(A, X.T @ y)


# ---------------------------------------------------------------- boosted trees (histogram, squared loss)
NBINS = 16


def to_bins(X):
    return np.clip(np.floor((X + 0.5) * NBINS).astype(np.int64), 0, NBINS - 1)


def _build(Xb, r, idx, depth, min_leaf, nodes):
    nid = len(nodes)
    nodes.append(None)
    rs = r[idx]
    if depth == 0 or len(idx) < 2 * min_leaf:
        nodes[nid] = ("leaf", float(rs.mean()))
        return nid
    S, N = rs.sum(), len(idx)
    best = (0.0, None, None)
    for j in range(Xb.shape[1]):
        b = Xb[idx, j]
        cnt = np.bincount(b, minlength=NBINS)
        sm = np.bincount(b, weights=rs, minlength=NBINS)
        cl, sl = np.cumsum(cnt)[:-1], np.cumsum(sm)[:-1]
        cr, sr = N - cl, S - sl
        ok = (cl >= min_leaf) & (cr >= min_leaf)
        if not ok.any():
            continue
        gain = np.where(ok, sl ** 2 / np.maximum(cl, 1) + sr ** 2 / np.maximum(cr, 1) - S ** 2 / N, -np.inf)
        k = int(np.argmax(gain))
        if gain[k] > best[0]:
            best = (float(gain[k]), j, k)
    if best[1] is None:
        nodes[nid] = ("leaf", float(rs.mean()))
        return nid
    j, k = best[1], best[2]
    left = idx[Xb[idx, j] <= k]
    right = idx[Xb[idx, j] > k]
    li = _build(Xb, r, left, depth - 1, min_leaf, nodes)
    ri = _build(Xb, r, right, depth - 1, min_leaf, nodes)
    nodes[nid] = ("split", j, k, li, ri)
    return nid


def _tree_predict(nodes, Xb):
    out = np.zeros(len(Xb))
    stack = [(0, np.arange(len(Xb)))]
    while stack:
        nid, idx = stack.pop()
        nd = nodes[nid]
        if nd[0] == "leaf":
            out[idx] = nd[1]
        else:
            _, j, k, li, ri = nd
            m = Xb[idx, j] <= k
            stack.append((li, idx[m]))
            stack.append((ri, idx[~m]))
    return out


def gbm_fit(X, y, n_trees, lr=0.05, depth=3, min_leaf=50, subsample=0.8, seed=20261122):
    rng = np.random.default_rng(seed)
    Xb = to_bins(X)
    base = float(np.mean(y))
    F = np.full(len(y), base)
    trees = []
    for _ in range(n_trees):
        r = y - F
        idx = np.sort(rng.choice(len(y), size=int(subsample * len(y)), replace=False))
        nodes = []
        _build(Xb, r, idx, depth, min_leaf, nodes)
        F += lr * _tree_predict(nodes, Xb)
        trees.append(nodes)
    return {"base": base, "lr": lr, "trees": trees}


def gbm_predict(m, X):
    Xb = to_bins(X)
    F = np.full(len(X), m["base"])
    for nodes in m["trees"]:
        F += m["lr"] * _tree_predict(nodes, Xb)
    return F


# ---------------------------------------------------------------- metrics (one cell)
def spearman(a, b):
    ra, rb = centred_ranks(a), centred_ranks(b)
    sa, sb = ra.std(), rb.std()
    return float(np.mean((ra - ra.mean()) * (rb - rb.mean())) / (sa * sb)) if sa > 0 and sb > 0 else None


def quintile_spread(pred, y):
    """mean y of the top fifth by pred minus the bottom fifth (ties broken by stable order)."""
    order = np.argsort(pred, kind="mergesort")
    k = len(order) // 5
    if k < 3:
        return None
    return float(np.mean(y[order[-k:]]) - np.mean(y[order[:k]]))


def top_third_hit(pred, y):
    rp, ry = rank01(pred), rank01(y)
    top = rp > 2 / 3
    if top.sum() == 0:
        return None
    return float(np.mean(ry[top] > 2 / 3))


def coverage(lo, hi, y):
    return float(np.mean((y >= lo) & (y <= hi)))


# ---------------------------------------------------------------- bootstrap over counties
def county_bootstrap(values, counties, draws=2000, seed=20261122, ci=0.90):
    """values: per-cell numbers (None skipped); counties: per-cell county id. Mean over cells; resample counties."""
    v = np.array([np.nan if x is None else x for x in values], dtype=float)
    ok = ~np.isnan(v)
    v, c = v[ok], np.asarray(counties)[ok]
    if len(v) == 0:
        return {"mean": None, "ci90": [None, None], "cells": 0, "counties": 0, "share_draws_le_0": None}
    ids, inv = np.unique(c, return_inverse=True)
    s = np.bincount(inv, weights=v)
    n = np.bincount(inv).astype(float)
    rng = np.random.default_rng(seed)
    k = len(ids)
    picks = rng.integers(0, k, size=(draws, k))
    cnt = np.zeros((draws, k))
    np.add.at(cnt, (np.repeat(np.arange(draws), k), picks.ravel()), 1)
    means = (cnt @ s) / (cnt @ n)
    a = (1 - ci) / 2
    return {"mean": float(v.mean()), "ci90": [float(np.quantile(means, a)), float(np.quantile(means, 1 - a))],
            "cells": int(len(v)), "counties": int(k), "share_draws_le_0": float(np.mean(means <= 0))}
