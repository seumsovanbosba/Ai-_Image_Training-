#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -x .venv/bin/python ]]; then
  PY=.venv/bin/python
else
  PY=python3
fi
if ! "$PY" -c "import streamlit, pandas, fpdf, psutil" >/dev/null 2>&1; then
  "$PY" -m pip install -r requirements.txt
fi
"$PY" -m streamlit run gallery_app/app.py
