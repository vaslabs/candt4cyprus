# Independent numerical oracle (development / CI only)

`oracle.py` is a separate Python/SciPy implementation of the Casas & Torres (2026) steady
state. It is written directly from the paper's equations and solved with MINPACK `hybr` in
log variables, using continuation in adoption. The existence boundary is found by bisection
on its own unit-cost reduction. It shares no code with the TypeScript model.

The deployed application never uses Python.

```bash
python3 -m venv tools/oracle/.venv
tools/oracle/.venv/bin/pip install -r tools/oracle/requirements.txt
tools/oracle/.venv/bin/python -I tools/oracle/oracle.py          # regenerates the fixture
npm test                                                           # TS compares against it
```

`tests/regression/oracle.test.ts` checks four things:
1. Wherever the oracle converges, TS Solver 1 matches all 10 unknowns to 1e-9 relative.
2. Wherever the oracle fails, TS independently establishes non-existence (no unexplained gaps).
3. The existence boundaries agree to 1e-9.
4. The fixture is non-trivial.

In CI the fixture is regenerated from scratch and passed to the tests through `ORACLE_FIXTURE`, so
each run compares against a fresh independent solve rather than only the committed file.

The fixture also records the Python/NumPy/SciPy versions that produced it.
