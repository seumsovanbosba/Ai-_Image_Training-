"""Cross-platform scoring PDF (Linux and Windows 11) using fpdf2."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from fpdf import FPDF

from gallery_app.constants import CRITERIA, RUBRIC, split_image_id
from gallery_app.dataset import load_dataset
from gallery_app.prompts import load_prompts, prompt_by_id
from gallery_app.scoring import (
    both_complete,
    comparison_rows,
    completed_count,
    load_sheet,
    sheet_complete,
)


def latin(text: Any) -> str:
    raw = "" if text is None else str(text)
    raw = (
        raw.replace("×", "x")
        .replace("–", "-")
        .replace("—", "-")
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
    )
    return raw.encode("latin-1", "replace").decode("latin-1")


class ScoringPDF(FPDF):
    def header(self) -> None:
        self.set_font("Helvetica", "B", 11)
        self._line("KiTH image generation benchmark - independent scoring", size=11, style="B")
        self._line("Eang Hourmeng and Soem Sovanbosba - originals preserved", size=8, style="")
        self.ln(2)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 8, latin(f"Page {self.page_no()}"), align="C")

    def usable_width(self) -> float:
        return self.w - self.l_margin - self.r_margin

    def _line(self, text: Any, size: int = 9, style: str = "") -> None:
        self.set_xy(self.l_margin, self.get_y())
        self.set_font("Helvetica", style, size)
        self.multi_cell(self.usable_width(), 5, latin(text))


def _kv(pdf: ScoringPDF, label: str, value: Any) -> None:
    pdf._line(f"{label}: {value}", size=9, style="")


def _write_entry(pdf: ScoringPDF, entry: dict[str, Any]) -> None:
    parts = []
    for key, label in CRITERIA:
        val = entry.get(key)
        parts.append(f"{label}: {val if val is not None else '-'}")
    total = entry.get("total")
    parts.append(f"Total: {total if total is not None else '-'}")
    pdf._line(" | ".join(parts), size=9, style="")
    comment = (entry.get("comment") or "").strip() or "(none)"
    pdf._line("Comment: " + comment, size=9, style="")
    pdf.ln(1)


def build_scoring_pdf() -> bytes:
    hm = load_sheet("hourmeng")
    bb = load_sheet("bosba")
    dataset = load_dataset()
    prompts = load_prompts()
    rows = comparison_rows()
    revealed = both_complete()

    pdf = ScoringPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    pdf._line("Independent scoring workbook", size=16, style="B")
    pdf._line(
        "Both students score every image independently (0-2 on four criteria). "
        "Original scores stay in this PDF even after an agreed score is recorded.",
        size=10,
        style="",
    )
    pdf.ln(2)
    _kv(pdf, "HourMeng complete", f"{completed_count(hm)} / 54  ({'yes' if sheet_complete(hm) else 'no'})")
    _kv(pdf, "Bosba complete", f"{completed_count(bb)} / 54  ({'yes' if sheet_complete(bb) else 'no'})")
    _kv(pdf, "Both complete", "yes" if revealed else "no - other scores hidden until both finish")
    _kv(pdf, "Prompts frozen", str(bool(prompts.get("frozen"))))
    pdf.ln(3)

    pdf._line("Scoring rubric", size=12, style="B")
    for key, label in CRITERIA:
        pdf._line(label, size=9, style="B")
        for pts, meaning in RUBRIC[key].items():
            pdf._line(f"  {pts}: {meaning}", size=9, style="")
    pdf.ln(2)

    for row in rows:
        key = row["image_id"]
        pid, code = split_image_id(key)
        prompt = prompt_by_id(prompts, pid)
        rec = dataset.get("images", {}).get(key, {})
        pdf.add_page()
        pdf._line(key, size=13, style="B")
        _kv(pdf, "Category", prompt.get("category"))
        _kv(pdf, "Model", rec.get("model_name") or code)
        _kv(pdf, "Checkpoint", rec.get("checkpoint_filename") or "(not recorded)")
        _kv(pdf, "Seed", rec.get("seed"))
        _kv(pdf, "Effort", f"{rec.get('steps')} steps, CFG {rec.get('cfg')}")
        _kv(pdf, "VRAM peak GB", rec.get("peak_vram_gb"))
        _kv(pdf, "Duration s", rec.get("generation_duration_seconds"))
        _kv(pdf, "Prompt", prompt.get("prompt"))
        reqs = prompt.get("visible_requirements") or []
        _kv(pdf, "Checklist", " | ".join(str(r) for r in reqs))
        pdf.ln(1)
        pdf._line("HourMeng (Eang Hourmeng)", size=11, style="B")
        _write_entry(pdf, row["hourmeng"])

        if revealed:
            pdf._line("Bosba (Soem Sovanbosba)", size=11, style="B")
            _write_entry(pdf, row["bosba"])
            if row["flags"]:
                pdf.set_text_color(180, 0, 0)
                pdf._line("Difference greater than 1: " + ", ".join(row["flags"]), size=9, style="B")
                pdf.set_text_color(0, 0, 0)
            agreed_entry = row.get("agreed") or {}
            if agreed_entry.get("prompt_adherence") is not None:
                pdf._line("Agreed score (originals preserved above)", size=11, style="B")
                _write_entry(pdf, agreed_entry)
        else:
            pdf._line(
                "Bosba scores are omitted from this export until both evaluators finish all 54 images.",
                size=9,
                style="I",
            )

    buffer = BytesIO()
    pdf.output(buffer)
    return buffer.getvalue()
