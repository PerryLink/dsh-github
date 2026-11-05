#!/usr/bin/env python3
"""Generate the README hero assets for dsh-github (docs/assets/).

Outputs (idempotent overwrite):
  dsh-github-flow-light.svg / dsh-github-flow-dark.svg
      Hero flow diagram. Two hand-written SVG files (vector — never rasterized
      to webp). Every label inside is a command-surface token only (tool name,
      slash command, event name, config key, or status token), so all five
      README languages share the same pair.

No UI screenshots are used: dsh-github's only browser half is the Plugins
settings card, and inventing an interface mock-up would be fiction. The hero is
the real pipeline instead: write tools → approval gate → GitHub REST, plus the
/review and CI lanes that run beside it.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow (only used to prove the bundled CJK/Pillow environment is
           present; the assets themselves are pure SVG)
"""
from __future__ import annotations

import os
import sys

from PIL import ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# --- palette: PerryLink family (accent) + GitHub page backgrounds ----------
FAMILY = "#4B67B4"   # family accent (badges use labelColor #2B3245)
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
SKIN = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a", arrow="#57606a"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e", arrow="#8b949e"),
}

# --- CJK font probe: Chinese must never render as tofu boxes ----------------
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",      # Microsoft YaHei
    r"C:\Windows\Fonts\simhei.ttf",    # SimHei
    r"C:\Windows\Fonts\Deng.ttf",      # DengXian
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
]
FONT_PATH = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
if FONT_PATH is None:
    sys.exit("FATAL: no CJK font found (looked for msyh.ttc, simhei.ttf, "
             "Deng.ttf, Noto Sans CJK, PingFang). Refusing to render text "
             "without a verified font; install one of the probed fonts and "
             "re-run.")
# The probe also keeps the script honest about the bundled Pillow requirement.
ImageFont.truetype(FONT_PATH, 16)

MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
W, H = 1200, 540

# --- lanes: tokens only, no prose -----------------------------------------
APPROVAL = [
    ("pr_create", "pr_merge · pr_update"),
    ("tools/pre-execute", "ask"),
    ("ctx.approval", "allowedActions"),
    ("api.github.com", "GITHUB_TOKEN"),
    ("review_post", "issue_close · ci_run"),
]
REVIEW = [
    ("/review", "ctx.jobs"),
    ("github-review", "reviewJobTimeoutMs"),
    ("src/review.ts", "maxFindings"),
    ("review_post", "ctx.approval"),
]
CI = [
    ("action.yml", "ci.enabled"),
    ("ci_run", "ci.engine"),
    ("success · needs-changes", "checkName"),
]


def text(x: int, y: int, value: str, *, fill: str, size: int, weight: str = "400",
         anchor: str = "start", family: str = MONO) -> str:
    return (f'<text x="{x}" y="{y}" fill="{fill}" text-anchor="{anchor}" '
            f'font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}">{value}</text>')


def arrow(x1: int, y: int, x2: int, color: str) -> str:
    mid = (x1 + x2) // 2
    return (
        f'<path d="M{x1} {y}h{x2 - x1 - 12}" stroke="{color}" stroke-width="3"/>'
        f'<path d="M{x2 - 14} {y - 7}l10 7-10 7" fill="none" stroke="{color}" '
        f'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def lane(boxes, *, y: int, width: int, gap: int, start: int, s: dict,
         accent_index: int, green: str | None = None) -> list[str]:
    parts: list[str] = []
    for i, (label, sub) in enumerate(boxes):
        x = start + i * (width + gap)
        stroke = FAMILY if i == accent_index else s["border"]
        if green is not None and i == len(boxes) - 1:
            stroke = green
        parts.append(
            f'<rect x="{x}" y="{y}" width="{width}" height="82" rx="13" '
            f'fill="{s["box"]}" stroke="{stroke}" stroke-width="2"/>')
        parts.append(text(x + width // 2, y + 36, label, fill=s["text"],
                          size=15, weight="700", anchor="middle"))
        parts.append(text(x + width // 2, y + 62, sub, fill=s["sub"],
                          size=12, anchor="middle"))
        if i < len(boxes) - 1:
            parts.append(arrow(x + width + 4, y + 41, x + width + gap - 2,
                               s["arrow"]))
    return parts


def flow_svg(skin: str) -> str:
    s = SKIN[skin]
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}" role="img" aria-label="dsh-github workflow">',
        f'<title>dsh-github workflow</title>',
        f'<rect width="{W}" height="{H}" rx="18" fill="{s["bg"]}"/>',
        text(50, 58, "dsh-github", fill=s["text"], size=30, weight="700",
             family="ui-sans-serif,system-ui,sans-serif"),
        text(50, 90, "pr_create · gh_review · /review · ci_run",
             fill=s["sub"], size=15),
        f'<line x1="50" y1="110" x2="1150" y2="110" stroke="{s["border"]}"/>',
    ]
    parts += lane(APPROVAL, y=140, width=200, gap=25, start=50, s=s,
                  accent_index=2)
    parts += lane(REVIEW, y=275, width=240, gap=30, start=75, s=s,
                  accent_index=1)
    parts += lane(CI, y=410, width=280, gap=40, start=130, s=s,
                  accent_index=1, green=GREEN[skin])
    parts.append(
        f'<line x1="50" y1="512" x2="1150" y2="512" stroke="{s["border"]}"/>')
    parts.append(text(50, 532, "tokenSource: auto · credentials → env → gh",
                      fill=s["sub"], size=12))
    parts.append(text(1150, 532, "Apache-2.0", fill=s["sub"], size=12,
                      anchor="end"))
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        with open(os.path.join(OUT, f"dsh-github-flow-{skin}.svg"),
                  "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
    print("wrote 2 SVG assets to docs/assets/")


if __name__ == "__main__":
    main()
