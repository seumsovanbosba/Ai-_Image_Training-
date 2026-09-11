@echo off
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
  set PY=.venv\Scripts\python.exe
) else (
  set PY=python
)
"%PY%" -c "import streamlit, pandas, fpdf, psutil" >nul 2>&1
if errorlevel 1 (
  "%PY%" -m pip install -r requirements.txt
)
"%PY%" -m streamlit run gallery_app/app.py
pause
