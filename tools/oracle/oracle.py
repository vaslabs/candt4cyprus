#!/usr/bin/env python3
"""
Independent oracle for the Casas & Torres (2026) steady state.

Written separately from the TypeScript code, directly from the paper's equations, and solved
with a different algorithm (MINPACK `hybr` via scipy.optimize.root, in log variables, with
continuation in the adoption parameter). Its output is a JSON fixture that the TypeScript test
suite compares against (tests/regression/oracle.test.ts).

Used only for development and CI. The deployed application never runs Python.

Usage:
    python tools/oracle/oracle.py [--out tests/fixtures/oracle_steady_states.json]
"""
from __future__ import annotations

import argparse
import itertools
import json
import math
import sys
from dataclasses import dataclass, asdict, replace

import numpy as np
import scipy
from scipy.optimize import brentq, root

# --------------------------------------------------------------------------- parameters


@dataclass(frozen=True)
class Taxes:
    consumption: float = 0.1832  # τc
    labour: float = 0.1646  # τl
    employerSS: float = 0.1589  # τsse
    employeeSS: float = 0.0945  # τssw
    capital: float = 0.2418  # τk
    robotIncome: float = 0.0  # τd
    robotInvestment: float = 0.0  # τid
    robotSS: float = 0.0  # τssz


@dataclass(frozen=True)
class Params:
    technology: str  # "A" | "B"
    adoption: float
    elasticityAuto: float
    taxes: Taxes
    techAWeight: str = "capitalWeight"  # | "asPrinted"
    labourSupply: str = "asPrinted"  # | "figureReplication"
    beta: float = 0.975
    gamma: float = 0.40
    deltaK: float = 0.06
    deltaD: float = 0.20
    capitalShareParam: float = 0.35
    elasticityKL: float = 0.90


# --------------------------------------------------------------------------- production


def ces(w1: float, x1: float, x2: float, s: float) -> float:
    """Two-input CES [w1 x1^r + (1-w1) x2^r]^(1/r), r=(s-1)/s; Cobb–Douglas at s=1."""
    if w1 == 0.0:
        return x2
    if s == 1.0:
        return x1**w1 * x2 ** (1.0 - w1)
    r = (s - 1.0) / s
    return (w1 * x1**r + (1.0 - w1) * x2**r) ** (1.0 / r)


def output(p: Params, K: float, D: float, L: float) -> tuple[float, float]:
    if p.technology == "A":
        # eq (1)-(2); Table-1 θ placed on K unless the literal variant is selected (D1)
        wK = p.capitalShareParam if p.techAWeight == "capitalWeight" else 1.0 - p.capitalShareParam
        X = ces(p.adoption, D, L, p.elasticityAuto)
        return ces(wK, K, X, p.elasticityKL), X
    # eq (10)-(11)
    X = ces(p.capitalShareParam, K, L, p.elasticityKL)
    return ces(p.adoption, D, X, p.elasticityAuto), X


def marginal_products(p: Params, Y, X, K, D, L):
    """Paper FOCs (4)-(6) and (13)-(15), written literally."""
    if p.technology == "A":
        rho, ups, phi = p.elasticityKL, p.elasticityAuto, p.adoption
        th = 1.0 - (p.capitalShareParam if p.techAWeight == "capitalWeight" else 1.0 - p.capitalShareParam)
        c = th * Y ** (1 / rho) * X ** (1 / ups - 1 / rho)
        mpD = phi * c * D ** (-1 / ups) if D > 0 else math.nan
        return (1 - th) * Y ** (1 / rho) * K ** (-1 / rho), mpD, (1 - phi) * c * L ** (-1 / ups)
    sig, eps, mu, al = p.elasticityAuto, p.elasticityKL, p.adoption, p.capitalShareParam
    c = (1 - mu) * Y ** (1 / sig) * X ** (1 / eps - 1 / sig)
    mpD = mu * Y ** (1 / sig) * D ** (-1 / sig) if D > 0 else math.nan
    return al * c * K ** (-1 / eps), mpD, (1 - al) * c * L ** (-1 / eps)


NAMES = ["Y", "C", "K", "D", "L", "X", "W", "I", "Rk", "Rd"]


def residuals(p: Params, v: dict[str, float]) -> list[float]:
    t = p.taxes
    Y, C, K, D, L, X, W, I, Rk, Rd = (v[n] for n in NAMES)
    Yp, Xp = output(p, K, D, L)
    mpK, mpD, mpL = marginal_products(p, Y, X, K, D, L)
    wc, ww = (1.0, 1.0) if p.labourSupply == "figureReplication" else (1 + t.consumption, 1 - t.labour - t.employeeSS)
    r = [
        math.log(Y / Yp),
        math.log(X / Xp),
        math.log((1 + t.employerSS) * W / mpL),
        math.log(Rk / mpK),
        math.log(wc * C / (p.gamma / (1 - p.gamma) * (1 - L) * W * ww)),
        p.beta * ((1 - t.capital) * (Rk - p.deltaK) + 1) - 1,
        p.beta * ((1 - t.capital - t.robotIncome) * (Rd - p.deltaD) + 1 + t.robotInvestment * (1 - p.deltaD))
        / (1 + t.robotInvestment)
        - 1,
        math.log(I / (p.deltaK * K + p.deltaD * D)),
        math.log(C / (Y - I)),
    ]
    if p.adoption > 0:
        r.append(math.log((1 + t.robotSS) * Rd / mpD))
    return r


def solve_point(p: Params, guess: dict[str, float]) -> tuple[bool, dict[str, float], float]:
    names = NAMES if p.adoption > 0 else [n for n in NAMES if n != "D"]

    def f(z):
        v = {"D": 0.0}
        try:
            v.update({n: math.exp(zi) for n, zi in zip(names, z)})
            r = residuals(p, v)
        except (ValueError, ZeroDivisionError, OverflowError):
            return np.full(len(names), 1e6)
        return np.where(np.isfinite(r), r, 1e6)

    g = dict(guess)
    if p.adoption > 0 and g["D"] <= 0:
        g["D"] = 1e-6 * g["K"]
    sol = root(f, [math.log(g[n]) for n in names], method="hybr", tol=1e-14, options={"maxfev": 20000})
    res = float(np.max(np.abs(f(sol.x))))
    v = {"D": 0.0}
    if res < 1e5:
        v.update({n: math.exp(zi) for n, zi in zip(names, sol.x)})
    return bool(res < 1e-11), v, res


def solve(p: Params) -> tuple[bool, dict[str, float], float]:
    """Continuation in adoption from 0 with a generic start (no information from the TS code)."""
    guess = {"Y": 0.5, "C": 0.4, "K": 1.5, "D": 0.0, "L": 0.3, "X": 0.4, "W": 1.0, "I": 0.1, "Rk": 0.1, "Rd": 0.25}
    ok, v, res = solve_point(replace(p, adoption=0.0), guess)
    a, step = 0.0, min(0.02, p.adoption)
    while ok and a < p.adoption:
        nxt = min(p.adoption, a + step)
        ok2, v2, res2 = solve_point(replace(p, adoption=nxt), v)
        if ok2:
            a, v, res = nxt, v2, res2
            step = min(step * 1.5, 0.02)
        else:
            step /= 2
            if step < 1e-6:
                return False, v2, res2
    return ok, v, res


# --------------------------------------------------------------------------- existence boundary (independent dual)


def unit_cost(w1, p1, p2, s):
    if w1 == 0.0:
        return p2
    if s == 1.0:
        return (p1 / w1) ** w1 * (p2 / (1 - w1)) ** (1 - w1)
    return (w1**s * p1 ** (1 - s) + (1 - w1) ** s * p2 ** (1 - s)) ** (1 / (1 - s))


def returns(p: Params):
    t = p.taxes
    Rk = (1 / p.beta - 1 + (1 - t.capital) * p.deltaK) / (1 - t.capital)
    Rd = ((1 + t.robotInvestment) / p.beta - 1 - t.robotInvestment * (1 - p.deltaD)
          + (1 - t.capital - t.robotIncome) * p.deltaD) / (1 - t.capital - t.robotIncome)
    return Rk, Rd


def wage_cost_exists(p: Params) -> bool:
    """True iff a positive finite labour cost solves unit cost = 1. Bisection on pL in logs:
    unit cost is increasing in pL, so a solution exists iff cost(pL→0) < 1 < cost(pL→∞)."""
    Rk, Rd = returns(p)
    pD = (1 + p.taxes.robotSS) * Rd

    def total_cost(pL):
        if p.technology == "A":
            wK = p.capitalShareParam if p.techAWeight == "capitalWeight" else 1 - p.capitalShareParam
            return unit_cost(wK, Rk, unit_cost(p.adoption, pD, pL, p.elasticityAuto), p.elasticityKL)
        return unit_cost(p.adoption, pD, unit_cost(p.capitalShareParam, Rk, pL, p.elasticityKL), p.elasticityAuto)

    with np.errstate(all="ignore"):
        # numpy float64 so that overflow gives inf instead of raising OverflowError
        lo = total_cost(np.float64(1e-200))
        hi, hi_mid = total_cost(np.float64(1e200)), total_cost(np.float64(1e100))
    if lo >= 1:
        return False
    if hi > 1:
        return True
    # cost(pL) < 1 even at pL = 1e200: genuine non-existence only if the cost has saturated
    # (bounded supremum < 1, i.e. robots alone undercut zero profit). If it is still rising,
    # the required wage merely exceeds the search range (e.g. Cobb–Douglas, where labour is
    # essential and a finite wage always exists).
    return not (abs(hi - hi_mid) <= 1e-9 * hi)


def boundary(p: Params) -> float | None:
    if not wage_cost_exists(replace(p, adoption=0.0)):
        return None
    grid = np.linspace(0, 0.999, 1000)
    prev = 0.0
    for a in grid[1:]:
        if not wage_cost_exists(replace(p, adoption=float(a))):
            return brentq(lambda x: 0.5 - wage_cost_exists(replace(p, adoption=x)), prev, float(a), xtol=1e-13)
        prev = float(a)
    return None


# --------------------------------------------------------------------------- grid


def cases():
    tax_cases = {
        "none": Taxes(),
        "robotIncome": Taxes(robotIncome=0.3),
        "robotInvestment": Taxes(robotInvestment=0.25),
        "robotSS": Taxes(robotSS=0.2),
    }
    variants = {"A": [("capitalWeight", "asPrinted"), ("capitalWeight", "figureReplication"), ("asPrinted", "asPrinted")],
                "B": [("capitalWeight", "asPrinted"), ("capitalWeight", "figureReplication")]}
    for tech in ("A", "B"):
        for adoption, ea, (tname, tx), (tw, ls) in itertools.product(
            [0.0, 0.05, 0.15, 0.25, 0.35, 0.42], [1.0, 2.0, 3.0], tax_cases.items(), variants[tech]
        ):
            yield tname, Params(tech, adoption, ea, tx, tw, ls)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="tests/fixtures/oracle_steady_states.json")
    args = ap.parse_args()
    out = []
    for tname, p in cases():
        ok, v, res = solve(p)
        out.append({"taxCase": tname, "params": asdict(p), "converged": ok, "residualNorm": res,
                    "levels": v if ok else None})
    bounds = []
    for tech in ("A", "B"):
        for ea in (1.0, 2.0, 3.0):
            p = Params(tech, 0.0, ea, Taxes())
            bounds.append({"params": asdict(p), "boundary": boundary(p)})
    doc = {
        "generator": "tools/oracle/oracle.py",
        "python": sys.version.split()[0],
        "numpy": np.__version__,
        "scipy": scipy.__version__,
        "method": "scipy.optimize.root(method='hybr') on log levels, continuation in adoption; "
                  "boundary by bisection on existence of a finite wage (independent dual)",
        "steadyStates": out,
        "boundaries": bounds,
    }
    with open(args.out, "w") as fh:
        json.dump(doc, fh, indent=1)
    n_ok = sum(c["converged"] for c in out)
    print(f"wrote {args.out}: {n_ok}/{len(out)} converged, {len(bounds)} boundaries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
