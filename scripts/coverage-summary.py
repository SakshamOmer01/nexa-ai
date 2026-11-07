#!/usr/bin/env python3
"""Render a Vitest/Istanbul coverage summary as Markdown for the GitHub Actions step summary.

CI job logs need repository admin rights, so the coverage report in the log is invisible to most
reviewers. This prints the totals into the run page instead, and marks any metric the configured
threshold would reject.

Usage:
    python scripts/coverage-summary.py --title "Frontend coverage" --threshold 85 \\
        frontend/coverage/coverage-summary.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

METRICS = ("statements", "branches", "functions", "lines")


def _metric(node: dict, name: str) -> tuple[float, int, int]:
    """Return (percentage, covered, total) for one metric, tolerating a missing entry."""
    entry = node.get(name) or {}
    return float(entry.get("pct", 0.0)), int(entry.get("covered", 0)), int(entry.get("total", 0))


def _display_path(path: str) -> str:
    """Shorten an absolute report path to something recognisable, keeping it unambiguous."""
    parts = Path(path).parts
    if "src" in parts:
        return Path(*parts[parts.index("src") :]).as_posix()
    return Path(path).as_posix()


def render(summary: dict, title: str, threshold: float | None) -> str:
    total = summary.get("total") or {}
    lines = [f"### {title}", "", "| Metric | Coverage | Covered / Total | Status |", "| --- | ---: | ---: | :---: |"]

    for name in METRICS:
        pct, covered, count = _metric(total, name)
        if threshold is None:
            status = "—"
        else:
            status = "✅" if pct >= threshold else f"❌ (< {threshold:g}%)"
        lines.append(f"| {name.capitalize()} | {pct:.2f}% | {covered} / {count} | {status} |")

    # Only worth listing when a gate exists; otherwise it is just noise.
    if threshold is not None:
        below = []
        for path, node in sorted(summary.items()):
            if path == "total":
                continue
            pct, covered, count = _metric(node, "lines")
            if count and pct < threshold:
                below.append(f"- `{_display_path(path)}` — {pct:.2f}% lines ({covered}/{count})")
        if below:
            lines += ["", f"<details><summary>Files under {threshold:g}% line coverage</summary>", "", *below, "", "</details>"]

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path, help="Istanbul coverage-summary.json")
    parser.add_argument("--title", default="Coverage", help="Heading for the summary block")
    parser.add_argument("--threshold", type=float, default=None, help="Percentage gate to annotate against")
    args = parser.parse_args()

    try:
        summary = json.loads(args.report.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        # A missing report must not fail the job; the coverage step itself already did that.
        print(f"warning: could not read {args.report}: {exc}", file=sys.stderr)
        return 0

    print(render(summary, args.title, args.threshold))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
