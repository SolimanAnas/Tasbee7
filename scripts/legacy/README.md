# Legacy scripts (archived)

One-off development tools superseded by the current toolchain. Kept for
reference only — not used by the app, the build, or CI.

- `server.py` + `server.bat` — old Flask static-file launcher for Windows.
  Superseded by `npm run dev` (Vite). If you ever need it, run it from the
  repo root: `python scripts/legacy/server.py` (serves the current working
  directory on port 5000).
- `fix_tasmee.py` — one-off migration script with a hardcoded local path;
  already applied, kept for historical reference.
