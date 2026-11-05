#!/usr/bin/env python3
"""Render a JUnit XML report as Markdown for the GitHub Actions step summary.

CI job logs need repository admin rights, so publishing the integration report as an artifact
still hides per-test outcomes from most reviewers. This prints the failures, errors and skips into
the run page, where anyone with repository access can read them.
"""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_DETAIL = 160

_STATUS_BY_TAG = {"failure": "failed", "error": "errored", "skipped": "skipped"}


def _cases(root: ET.Element) -> list[ET.Element]:
    suites = [root] if root.tag == "testsuite" else root.findall("testsuite")
    return [case for suite in suites for case in suite.findall("testcase")]


def _outcome(case: ET.Element) -> tuple[str, str]:
    """Return the case's status and a single-line detail for the first problem it reports."""
    for tag, status in _STATUS_BY_TAG.items():
        node = case.find(tag)
        if node is not None:
            raw = node.get("message") or node.text or ""
            return status, " ".join(raw.split())[:MAX_DETAIL]
    return "passed", ""


def _row(status: str, name: str, detail: str) -> str:
    safe = detail.replace("|", "\\|").replace("`", "'")
    return f"| {status} | `{name}` | {safe} |"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {Path(argv[0]).name} <junit-report.xml>", file=sys.stderr)
        return 2

    report = Path(argv[1])
    if not report.is_file():
        print("### Integration tests\n")
        print(f"No JUnit report at `{report}`; the suite did not produce results.")
        return 0

    results = []
    for case in _cases(ET.parse(report).getroot()):
        status, detail = _outcome(case)
        classname = case.get("classname", "").rsplit(".", 1)[-1]
        results.append((status, f"{classname}::{case.get('name', '')}", detail))

    passed = sum(1 for status, _, _ in results if status == "passed")
    failed = sum(1 for status, _, _ in results if status in ("failed", "errored"))
    skipped = sum(1 for status, _, _ in results if status == "skipped")

    print("### Integration tests\n")
    print(f"**{len(results)} tests** — {passed} passed, {failed} failed, {skipped} skipped\n")

    noteworthy = [result for result in results if result[0] != "passed"]
    if not noteworthy:
        print("Every test passed; nothing was skipped.")
        return 0

    print("| Result | Test | Detail |")
    print("| --- | --- | --- |")
    for status, name, detail in noteworthy:
        print(_row(status, name, detail))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
