#!/usr/bin/env python3
"""Generate the dsh-github README art set (idempotent, no network).

Outputs
-------
docs/assets/dsh-github-hero-{zh,en}-{light,dark}.webp   1440x576 Pillow banners
docs/assets/dsh-github-flow-v5-{light,dark}.svg         1100x660 hand-written SVG

The structure diagram is not a row of five boxes.  Its grammar is a
GRADE-SEPARATED CHECKPOINT: the seven read tools ride an overpass labelled
`next()`, the eight write tools stop at one approval gate
(`tools/pre-execute` -> `allowedActions` -> `ctx.approval`), and both tracks
merge into a single `api.github.com` trunk.  Two service annexes below the
trunk show the `/review` background job and the CI status-check gate feeding
back into the same gate.  The hero mirrors the same idea: an approval
turnstile between the write queue and the API, a read flyover above it, an
audit receipt, and a per-operation token key.

Only documented behaviour is drawn.  Tool names come from src/tools.ts, the
gate stages from src/approval-gate.ts, the token sources from src/credential.ts,
the job stages from src/jobs.ts + /review, and the CI surfaces from action.yml
and src/ci/*.

Run:  python scripts/gen-readme-assets.py
Needs: Pillow, msyh.ttc / msyhbd.ttc / consola.ttf.
"""
from __future__ import annotations

import math
import os
import sys
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

FONT_CJK = r"C:\Windows\Fonts\msyh.ttc"
FONT_CJK_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"
for _path in (FONT_CJK, FONT_CJK_BOLD, FONT_MONO):
    if not os.path.exists(_path):
        sys.exit(f"FATAL: font missing: {_path}")

WEBP_QUALITY = 90

# ---------------------------------------------------------------------------
# palette
# ---------------------------------------------------------------------------
HERO_SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8", panel="#ffffff",
        edge="#e4e1ee", card="#faf9fe", text="#141419", sub="#4d5261",
        faint="#8f94a4", accent="#4B67B4", accent_soft="#ece7f9",
        green="#16a34a", green_soft="#eaf7ee", amber="#b25e09",
        amber_soft="#fbf1e3", grid="#e7e4f0", shadow=(32, 26, 64),
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016", panel="#1b2231",
        edge="#2e374b", card="#202838", text="#f0f3f9", sub="#a8b1c4",
        faint="#737b8d", accent="#8496f5", accent_soft="#242d42",
        green="#3fb950", green_soft="#16241c", amber="#d29922",
        amber_soft="#2a2113", grid="#1e2636", shadow=(0, 0, 0),
    ),
}

FLOW_SKIN = {
    "light": dict(
        bg1="#f9f6fd", bg2="#e4eaf8", card="#ffffff", card2="#fbfaff",
        zone="#f5f2fc", edge="#e6e3f0", text="#141419", sub="#4d5261",
        faint="#8f94a4", accent="#4B67B4", accent_soft="#ece7f9",
        green="#16a34a", green_soft="#eaf7ee", amber="#b25e09",
        amber_soft="#fbf1e3", red="#b42318", grid="#e7e4f0",
        shadow_op="0.12",
    ),
    "dark": dict(
        bg1="#131a2a", bg2="#0c1016", card="#1b2231", card2="#202838",
        zone="#171e2c", edge="#2e374b", text="#f0f3f9", sub="#a8b1c4",
        faint="#737b8d", accent="#8496f5", accent_soft="#242d42",
        green="#3fb950", green_soft="#16241c", amber="#d29922",
        amber_soft="#2a2113", red="#f85149", grid="#1e2636",
        shadow_op="0.55",
    ),
}


def hx(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def font(size: int, kind: str = "cjk"):
    path = {"cjk": FONT_CJK, "cjkb": FONT_CJK_BOLD, "mono": FONT_MONO}[kind]
    return ImageFont.truetype(path, size)


# ---------------------------------------------------------------------------
# hero (Pillow)
# ---------------------------------------------------------------------------
HERO = {
    "zh": dict(
        kicker="DeepSeek Harness Plugin",
        title=("dsh-", "github"),
        value=["在 agent 里写 GitHub，", "每个写操作先过审批"],
        sub=["15 个工具 · 4 族命令 · 后台审查 job · CI 门禁",
             "token 逐次现取，只进 Authorization 头"],
        meta="15 个工具 · 4 族命令 · 8 个写操作过闸",
        read_label="7 个读工具 · 无需审批",
        read_hint="read · next()",
        write_label="8 个写工具 · 排队过闸",
        gate="ctx.approval",
        gate_sub="ask · fail-closed",
        audit="approval/asked → approval/decided",
        token="tokenSource: auto · config → credentials → env → gh",
        footer="Apache-2.0  ·  PerryLink DSH plugin family",
    ),
    "en": dict(
        kicker="DeepSeek Harness Plugin",
        title=("dsh-", "github"),
        value=["Write GitHub from an agent,", "with a human on every write."],
        sub=["15 tools · 4 command families · review job",
             "CI composite action · status-check gate",
             "token per call · Authorization header only"],
        meta="15 tools · 4 command families · 8 gated writes",
        read_label="7 read tools · no approval",
        read_hint="read · next()",
        write_label="8 write tools · one queue",
        gate="ctx.approval",
        gate_sub="ask · fail-closed",
        audit="approval/asked → approval/decided",
        token="tokenSource: auto · config → credentials → env → gh",
        footer="Apache-2.0  ·  PerryLink DSH plugin family",
    ),
}

READ_TOOLS = ["gh_review", "gh_file", "gh_search", "gh_checks"]
WRITE_TOOLS = ["pr_create", "review_post", "pr_merge"]


def vertical_gradient(w: int, h: int, c1: str, c2: str) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    a, b = hx(c1), hx(c2)
    for y in range(h):
        t = 0.25 * (y / h) + 0.75 * (y / h) ** 1.45
        draw.line([(0, y), (w, y)],
                  fill=tuple(int(p + (q - p) * t) for p, q in zip(a, b)))
    return img


def glow(img: Image.Image, cx: int, cy: int, radius: int, color: str,
         alpha: int) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rgb = hx(color)
    for i in range(10, 0, -1):
        rr = radius * i / 10
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=rgb + (int(alpha * (1 - i / 11)),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def card(img: Image.Image, box, radius: int, fill: str, edge: str,
         shadow_rgb=(0, 0, 0), shadow_alpha: int = 26,
         edge_width: int = 2) -> Image.Image:
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([x0 + 2, y0 + 12, x1 + 2, y1 + 14],
                        radius=radius + 2, fill=shadow_rgb + (shadow_alpha,))
    blurred = layer.filter(ImageFilter.GaussianBlur(16))
    base = Image.alpha_composite(img.convert("RGBA"), blurred)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(fill), outline=hx(edge),
                        width=edge_width)
    return base.convert("RGB")


def text(draw: ImageDraw.ImageDraw, xy, value: str, size: int, color: str,
         kind: str = "cjk", anchor: str = "ls") -> None:
    draw.text(xy, value, font=font(size, kind), fill=hx(color), anchor=anchor)


def center_text(draw, cx, baseline, value, size, color, kind="cjk") -> None:
    draw.text((cx, baseline), value, font=font(size, kind), fill=hx(color),
              anchor="ms")


def right_text(draw, rx, baseline, value, size, color, kind="cjk") -> None:
    draw.text((rx, baseline), value, font=font(size, kind), fill=hx(color),
              anchor="rs")


def pill(img: Image.Image, xy, value: str, size: int, fg: str, bg: str,
         kind: str = "cjkb") -> Image.Image:
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    tw = d.textlength(value, font=f)
    x, y = xy
    h = size + 22
    d.rounded_rectangle([x, y, x + tw + 34, y + h], radius=h // 2,
                        fill=hx(bg))
    d.text((x + 17, y + h / 2 + size * 0.34), value, font=f, fill=hx(fg),
           anchor="ls")
    return img


def arrow(draw: ImageDraw.ImageDraw, pts, color: str, width: int = 3,
          head: int = 10, dash: int | None = None) -> None:
    """Polyline with a filled triangular head at the last point."""
    rgb = hx(color)
    (x0, y0), (x1, y1) = pts[-2], pts[-1]
    body = list(pts)
    ang = math.atan2(y1 - y0, x1 - x0)
    bx = x1 - head * 0.85 * math.cos(ang)
    by = y1 - head * 0.85 * math.sin(ang)
    body[-1] = (bx, by)
    if dash is None:
        draw.line(body, fill=rgb, width=width, joint="curve")
    else:
        for a, b in zip(body, body[1:]):
            length = math.dist(a, b)
            if length == 0:
                continue
            steps = max(1, int(length // dash))
            for i in range(steps):
                t0, t1 = i / steps, (i + 0.55) / steps
                draw.line([(a[0] + (b[0] - a[0]) * t0,
                            a[1] + (b[1] - a[1]) * t0),
                           (a[0] + (b[0] - a[0]) * t1,
                            a[1] + (b[1] - a[1]) * t1)],
                          fill=rgb, width=width)
    wing = head * 0.55
    draw.polygon([(x1, y1),
                  (x1 - head * math.cos(ang) + wing * math.sin(ang),
                   y1 - head * math.sin(ang) - wing * math.cos(ang)),
                  (x1 - head * math.cos(ang) - wing * math.sin(ang),
                   y1 - head * math.sin(ang) + wing * math.cos(ang))],
                 fill=rgb)


def turnstile(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int,
              color: str, hub: str) -> None:
    rgb = hx(color)
    for k in range(3):
        ang = math.radians(90 + k * 120)
        ex = cx + radius * math.cos(ang)
        ey = cy + radius * math.sin(ang)
        draw.line([(cx, cy), (ex, ey)], fill=rgb, width=8)
        draw.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], fill=rgb)
    draw.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=rgb)
    draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=hx(hub))


def key_icon(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    rgb = hx(color)
    draw.ellipse([x, y - 8, x + 16, y + 8], outline=rgb, width=3)
    draw.line([(x + 16, y), (x + 34, y)], fill=rgb, width=3)
    draw.line([(x + 28, y), (x + 28, y + 7)], fill=rgb, width=3)
    draw.line([(x + 34, y), (x + 34, y + 7)], fill=rgb, width=3)


def hero(lang: str, skin_name: str) -> None:
    s = HERO_SKIN[skin_name]
    hdat = HERO[lang]
    W, H = 1440, 576
    img = vertical_gradient(W, H, s["bg_from"], s["bg_to"])
    img = glow(img, 1180, 70, 390, s["accent"], 34 if skin_name == "light" else 48)
    img = glow(img, 170, 548, 300, s["green"], 12 if skin_name == "light" else 20)
    d = ImageDraw.Draw(img)

    # ---- left column ------------------------------------------------------
    m = 64
    img = pill(img, (m, 48), hdat["kicker"], 17, s["accent"], s["accent_soft"])
    d = ImageDraw.Draw(img)
    tf = font(84, "mono")
    prefix, mark = hdat["title"]
    d.text((m, 180), prefix, font=tf, fill=hx(s["text"]), anchor="ls",
           stroke_width=1, stroke_fill=hx(s["text"]))
    pw = d.textlength(prefix, font=tf)
    d.text((m + pw, 180), mark, font=tf, fill=hx(s["accent"]), anchor="ls",
           stroke_width=1, stroke_fill=hx(s["accent"]))

    vf = font(40 if lang == "zh" else 38, "cjkb")
    vy = 250
    for line in hdat["value"]:
        d.text((m, vy), line, font=vf, fill=hx(s["text"]), anchor="ls")
        vy += 58

    sf = font(26, "cjk")
    sy = 362
    for line in hdat["sub"]:
        d.text((m, sy), line, font=sf, fill=hx(s["sub"]), anchor="ls")
        sy += 34

    d.text((m, 470), hdat["meta"], font=font(20, "cjk"), fill=hx(s["faint"]),
           anchor="ls")
    d.line([(m, 492), (m + 596, 492)], fill=hx(s["grid"]), width=2)
    d.text((m, 518), hdat["footer"], font=font(17, "cjk"),
           fill=hx(s["faint"]), anchor="ls")

    # ---- right panel ------------------------------------------------------
    panel = (700, 44, 1376, 532)
    img = card(img, panel, 22, s["panel"], s["edge"], s["shadow"],
               42 if skin_name == "light" else 60)
    d = ImageDraw.Draw(img)

    # dot texture inside the panel
    for gy in range(72, 516, 26):
        for gx in range(720, 1360, 26):
            d.ellipse([gx, gy, gx + 2, gy + 2], fill=hx(s["grid"]))

    d.text((724, 76), "ONE GATE FOR EVERY WRITE", font=font(13, "cjkb"),
           fill=hx(s["accent"]), anchor="ls")
    d.ellipse([1242, 68, 1252, 78], fill=hx(s["green"]))
    right_text(d, 1352, 78, hdat["read_hint"], 13, s["green"], "mono")

    # read flyover
    read_x = [724, 850, 976, 1102]
    for i, name in enumerate(READ_TOOLS):
        x = read_x[i]
        d.rounded_rectangle([x, 92, x + 120, 124], radius=10,
                            fill=hx(s["green_soft"]), outline=hx(s["green"]),
                            width=2)
        center_text(d, x + 60, 114, name, 13, s["text"], "mono")
    d.line([(724, 136), (1352, 136)], fill=hx(s["green"]), width=2)
    d.text((724, 154), hdat["read_label"], font=font(12, "cjk"),
           fill=hx(s["sub"]), anchor="ls")

    # read bypass down the right edge into the API
    arrow(d, [(1340, 140), (1340, 204)], s["green"], width=2, head=8, dash=6)
    right_text(d, 1328, 178, "bypass", 11, s["green"], "mono")

    # write queue
    d.text((724, 182), hdat["write_label"], font=font(12, "cjkb"),
           fill=hx(s["accent"]), anchor="ls")
    wy = 194
    for name in WRITE_TOOLS:
        d.rounded_rectangle([724, wy, 908, wy + 40], radius=11,
                            fill=hx(s["card"]), outline=hx(s["edge"]), width=2)
        d.rounded_rectangle([724, wy, 730, wy + 40], radius=3,
                            fill=hx(s["accent"]))
        d.text((742, wy + 26), name, font=font(15, "mono"), fill=hx(s["text"]),
               anchor="ls")
        arrow(d, [(908, wy + 20), (936, wy + 20)], s["accent"], width=2, head=6)
        wy += 48
    d.line([(936, 214), (936, 310)], fill=hx(s["accent"]), width=2)
    d.text((724, 342), "+ 5 more write tools", font=font(13, "cjk"),
           fill=hx(s["faint"]), anchor="ls")
    arrow(d, [(936, 262), (968, 262)], s["accent"], width=3, head=9)

    # approval turnstile frame
    d.text((1050, 166), "APPROVAL GATE", font=font(11, "cjkb"),
           fill=hx(s["accent"]), anchor="ms")
    d.rounded_rectangle([972, 176, 1128, 356], radius=16,
                        fill=hx(s["card"]), outline=hx(s["accent"]), width=2)
    d.rounded_rectangle([986, 190, 1114, 202], radius=6,
                        fill=hx(s["accent"]))
    d.rounded_rectangle([986, 202, 998, 344], radius=4, fill=hx(s["accent"]))
    d.rounded_rectangle([1102, 202, 1114, 344], radius=4, fill=hx(s["accent"]))
    d.rounded_rectangle([986, 344, 1114, 356], radius=5, fill=hx(s["accent"]))
    turnstile(d, 1050, 272, 46, s["accent"], s["card"])
    d.ellipse([1042, 194, 1058, 210], fill=hx(s["green"]))

    center_text(d, 1050, 388, hdat["gate"], 17, s["text"], "mono")
    center_text(d, 1050, 410, hdat["gate_sub"], 13, s["faint"], "cjk")

    # API card
    img = card(img, (1176, 206, 1352, 324), 14, s["card"], s["edge"],
               s["shadow"], 22 if skin_name == "light" else 32)
    d = ImageDraw.Draw(img)
    d.text((1192, 232), "api.github.com", font=font(15, "mono"),
           fill=hx(s["text"]), anchor="ls")
    d.text((1192, 256), "REST · GraphQL", font=font(12, "cjk"),
           fill=hx(s["sub"]), anchor="ls")
    d.text((1192, 280), "Authorization", font=font(12, "mono"),
           fill=hx(s["accent"]), anchor="ls")
    d.text((1192, 304), "429 → Retry-After", font=font(11, "mono"),
           fill=hx(s["faint"]), anchor="ls")
    arrow(d, [(1128, 264), (1172, 264)], s["accent"], width=3, head=9)

    # audit receipt
    d.rounded_rectangle([724, 424, 1352, 458], radius=12,
                        fill=hx(s["amber_soft"]), outline=hx(s["amber"]),
                        width=1)
    d.ellipse([740, 436, 744, 440], fill=hx(s["amber"]))
    d.text((752, 446), "AUDIT", font=font(11, "cjkb"), fill=hx(s["amber"]),
           anchor="ls")
    d.text((806, 446), hdat["audit"], font=font(13, "mono"),
           fill=hx(s["text"]), anchor="ls")
    right_text(d, 1340, 446, "session events", 11, s["faint"], "cjk")

    # per-operation token strip
    d.rounded_rectangle([724, 476, 1352, 512], radius=12,
                        fill=hx(s["accent_soft"]), outline=hx(s["accent"]),
                        width=1)
    key_icon(d, 738, 494, s["accent"])
    d.text((780, 500), hdat["token"], font=font(13, "mono"),
           fill=hx(s["text"]), anchor="ls")
    right_text(d, 1340, 500, "never logged", 12, s["green"], "mono")

    # ---- guards -----------------------------------------------------------
    checks = [
        ("title", prefix + mark, 84, "mono", 596),
        ("kicker", hdat["kicker"], 17, "cjkb", 596),
        ("meta", hdat["meta"], 20, "cjk", 596),
        ("footer", hdat["footer"], 17, "cjk", 596),
        ("write", "review_post", 15, "mono", 166),
        ("gate", hdat["gate"], 17, "mono", 240),
        ("api", "api.github.com", 15, "mono", 160),
        ("token", hdat["token"], 13, "mono", 534),
        ("audit", hdat["audit"], 13, "mono", 520),
    ]
    checks += [("value", line, 40, "cjkb", 596) for line in hdat["value"]]
    checks += [("sub", line, 26, "cjk", 596) for line in hdat["sub"]]
    bad = []
    for label, value, size, kind, limit in checks:
        width = d.textlength(value, font=font(size, kind))
        if width > limit:
            bad.append(f"{label}: {value!r} {width:.1f} > {limit}")
    if bad:
        sys.exit("FATAL: hero text overflow: " + "; ".join(bad))

    path = os.path.join(OUT, f"dsh-github-hero-{lang}-{skin_name}.webp")
    img.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
    print(f"wrote {os.path.relpath(path, ROOT)}")


# ---------------------------------------------------------------------------
# flow SVG (hand-written, 1100 x 660)
# ---------------------------------------------------------------------------
W, H = 1100, 660
SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif"
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

READ_NAMES = ["gh_review", "gh_issue", "gh_search", "gh_repo", "gh_file",
              "gh_repo_search", "gh_checks"]
WRITE_NAMES = ["pr_create", "pr_merge", "pr_update", "review_post",
               "issue_open", "issue_comment", "issue_close", "ci_run"]


class Flow:
    def __init__(self, skin: str):
        self.s = FLOW_SKIN[skin]
        self.skin = skin
        self.parts: list[str] = []
        self.bad: list[str] = []

    # -- primitives ---------------------------------------------------------
    def add(self, value: str) -> None:
        self.parts.append(value)

    def T(self, x, y, value, size, fill, weight=400, anchor="start",
          family=MONO, opacity=None) -> None:
        op = f' opacity="{opacity}"' if opacity is not None else ""
        self.add(
            f'<text x="{x}" y="{y}" fill="{fill}" text-anchor="{anchor}" '
            f'font-family="{family}" font-size="{size}" font-weight="{weight}"'
            f'{op}>{escape(value)}</text>'
        )

    def need(self, value, size, limit, label, kind="mono") -> None:
        path = {"mono": FONT_MONO, "cjk": FONT_CJK, "cjkb": FONT_CJK_BOLD}[kind]
        width = ImageFont.truetype(path, size).getlength(value) * 1.02
        if width > limit:
            self.bad.append(f"{label}: {value!r} {width:.1f} > {limit}")

    def rect(self, x, y, w, h, r, fill, stroke=None, sw=1.5, dash=None,
             opacity=None) -> None:
        stroke_attr = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        op = f' opacity="{opacity}"' if opacity is not None else ""
        self.add(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" '
            f'fill="{fill}"{stroke_attr}{dash_attr}{op}/>'
        )

    def card(self, x, y, w, h, r=16, fill=None, stroke=None, sw=1.5) -> None:
        s = self.s
        self.add('<g filter="url(#soft)">')
        self.rect(x, y, w, h, r, fill or s["card"],
                  stroke or s["edge"], sw)
        self.add("</g>")

    def chip(self, x, y, w, h, label, size=13, fill=None, stroke=None,
             fg=None, weight=400, sub=None) -> None:
        s = self.s
        self.rect(x, y, w, h, 9, fill or s["card2"], stroke or s["edge"], 1.5)
        baseline = y + h / 2 + size * 0.36 if sub is None else y + 19
        self.T(x + w / 2, baseline, label, size, fg or s["text"], weight,
               "middle", MONO)
        if sub is not None:
            self.T(x + w / 2, y + h - 7, sub, 11, s["faint"], 400,
                   "middle", MONO)
        self.need(label, size, w - 14, f"chip {label}")

    def arrow(self, path, color, width=2.2, dash=None, marker="arr") -> None:
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(
            f'<path d="{path}" fill="none" stroke="{color}" '
            f'stroke-width="{width}" stroke-linecap="round" '
            f'stroke-linejoin="round"{dash_attr} marker-end="url(#{marker})"/>'
        )


def flow_svg(skin: str) -> str:
    f = Flow(skin)
    s = f.s
    f.add(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}" role="img" aria-labelledby="fig-title fig-desc">'
    )
    f.add(
        '<title id="fig-title">dsh-github structure: a grade-separated '
        'checkpoint</title>'
    )
    f.add(
        '<desc id="fig-desc">Seven read tools ride an overpass labelled next() '
        'over one approval gate. Eight write tools stop at tools/pre-execute, '
        'allowedActions and ctx.approval, then both tracks merge into '
        'api.github.com. The /review background job and the CI status-check '
        'gate feed back into the same gate.</desc>'
    )
    f.add(
        '<defs>'
        f'<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{s["bg1"]}"/>'
        f'<stop offset="1" stop-color="{s["bg2"]}"/>'
        f'</linearGradient>'
        f'<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">'
        f'<circle cx="1.4" cy="1.4" r="1.4" fill="{s["grid"]}"/>'
        f'</pattern>'
        f'<filter id="soft" x="-30%" y="-30%" width="160%" height="170%">'
        f'<feDropShadow dx="0" dy="9" stdDeviation="12" flood-color="#120f24" '
        f'flood-opacity="{s["shadow_op"]}"/>'
        f'</filter>'
        f'<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" '
        f'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0 L10 5 L0 10 z" fill="{s["accent"]}"/></marker>'
        f'<marker id="arrGreen" viewBox="0 0 10 10" refX="9" refY="5" '
        f'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0 L10 5 L0 10 z" fill="{s["green"]}"/></marker>'
        f'<marker id="arrMuted" viewBox="0 0 10 10" refX="9" refY="5" '
        f'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0 L10 5 L0 10 z" fill="{s["sub"]}"/></marker>'
        '</defs>'
    )
    f.add(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    f.add(f'<rect width="{W}" height="{H}" fill="url(#dots)" opacity=".45"/>')

    # header ---------------------------------------------------------------
    f.T(44, 54, "dsh-github", 30, s["text"], 700, "start", SANS)
    f.T(44, 80, "writes ask a human · reads call next() · one token per operation",
        13, s["sub"], 400, "start", MONO)
    # legend
    f.add(f'<circle cx="700" cy="76" r="4.5" fill="{s["green"]}"/>')
    f.T(712, 80, "read · next()", 12, s["sub"], 400, "start", MONO)
    f.add(f'<circle cx="824" cy="76" r="4.5" fill="{s["accent"]}"/>')
    f.T(836, 80, "write · ask", 12, s["sub"], 400, "start", MONO)
    f.add(f'<line x1="936" y1="76" x2="962" y2="76" stroke="{s["amber"]}" '
          f'stroke-width="2" stroke-dasharray="4 4"/>')
    f.T(970, 80, "audit pair", 12, s["sub"], 400, "start", MONO)
    f.add(f'<line x1="44" y1="94" x2="1056" y2="94" stroke="{s["edge"]}"/>')

    # left: agent turn + read card + write card -----------------------------
    f.T(44, 118, "AGENT TURN", 12, s["sub"], 700, "start", SANS)
    f.T(44, 134, "commands  /pr · /review · /issue · /ci", 11, s["faint"],
        400, "start", MONO)
    f.need("commands  /pr · /review · /issue · /ci", 11, 296, "commands", "mono")

    f.card(44, 146, 296, 176, 18, stroke=s["green"])
    f.T(60, 170, "READ ×7", 14, s["green"], 700, "start", MONO)
    f.T(324, 170, "no approval", 11, s["green"], 400, "end", MONO)
    read_x = [60, 196]
    for i, name in enumerate(READ_NAMES):
        col, row = i % 2, i // 2
        x, y = read_x[col], 180 + row * 34
        f.chip(x, y, 130, 28, name, 14, fill=s["card2"], stroke=s["edge"])
    # 8th cell: the pass-through token
    f.rect(196, 282, 130, 28, 9, "none", s["green"], 1.5, dash="4 4")
    f.T(261, 301, "next()", 12, s["green"], 700, "middle", MONO)

    f.card(44, 338, 296, 178, 18, stroke=s["accent"])
    f.T(60, 362, "WRITE ×8", 14, s["accent"], 700, "start", MONO)
    f.T(324, 362, "one gate", 11, s["accent"], 400, "end", MONO)
    for i, name in enumerate(WRITE_NAMES):
        col, row = i % 2, i // 2
        x, y = read_x[col], 374 + row * 34
        f.chip(x, y, 130, 28, name, 14, fill=s["card2"], stroke=s["edge"])

    # read overpass --------------------------------------------------------
    f.add(
        f'<path d="M340 220 H348 V132 Q348 118 362 118 H706 Q720 118 720 132 '
        f'V300" fill="none" stroke="{s["green"]}" stroke-width="3" '
        f'stroke-linecap="round"/>'
    )
    f.add(f'<circle cx="348" cy="220" r="4" fill="{s["green"]}"/>')
    f.add(f'<circle cx="720" cy="300" r="4" fill="{s["green"]}"/>')
    f.T(534, 108, "READ · next() · no approval", 11, s["green"], 700,
        "middle", MONO)
    f.need("READ · next() · no approval", 11, 300, "overpass label")

    # write feed into allowedActions --------------------------------------
    f.arrow("M340 400 H356 V268 H388", s["accent"], 2.2, marker="arr")
    f.add(f'<circle cx="340" cy="400" r="4" fill="{s["accent"]}"/>')

    # gate panel -----------------------------------------------------------
    f.card(368, 150, 332, 350, 20, fill=s["zone"], stroke=s["accent"], sw=1.5)
    f.T(388, 176, "APPROVAL GATE", 12, s["accent"], 700, "start", SANS)
    f.T(680, 176, "writes only", 11, s["faint"], 400, "end", MONO)

    f.chip(388, 188, 292, 44, "tools/pre-execute", 14, fill=s["card"],
           stroke=s["edge"], sub="waterfall · every tool call")
    f.need("waterfall · every tool call", 11, 278, "stage1 sub")
    f.arrow("M534 232 V246", s["accent"], 2.2)
    f.chip(388, 246, 292, 44, "allowedActions", 14, fill=s["card"],
           stroke=s["edge"], sub="off-list → deny")
    f.arrow("M534 290 V304", s["accent"], 2.2)

    f.rect(388, 304, 292, 92, 14, s["accent_soft"], s["accent"], 1.8)
    turnstile_parts = []
    # small turnstile glyph on the left of the approval card
    cx, cy = 426, 350
    for k in range(3):
        ang = math.radians(90 + k * 120)
        ex, ey = cx + 20 * math.cos(ang), cy + 20 * math.sin(ang)
        turnstile_parts.append(
            f'<line x1="{cx}" y1="{cy}" x2="{ex:.1f}" y2="{ey:.1f}" '
            f'stroke="{s["accent"]}" stroke-width="3.4"/>'
            f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="2.4" fill="{s["accent"]}"/>'
        )
    turnstile_parts.append(
        f'<circle cx="{cx}" cy="{cy}" r="6" fill="{s["accent"]}"/>'
        f'<circle cx="{cx}" cy="{cy}" r="2.4" fill="{s["accent_soft"]}"/>'
    )
    f.add("".join(turnstile_parts))
    f.T(556, 330, "ctx.approval", 15, s["text"], 700, "middle", MONO)
    f.T(556, 352, "ask · human decision", 12, s["sub"], 400, "middle", MONO)
    f.T(556, 376, "fail-closed without answerer", 11, s["faint"], 400,
        "middle", MONO)
    f.need("fail-closed without answerer", 11, 200, "approval sub")

    f.rect(388, 412, 292, 36, 10, s["amber_soft"], s["amber"], 1.2)
    f.add(f'<circle cx="402" cy="430" r="2.4" fill="{s["amber"]}"/>')
    f.T(414, 434, "AUDIT", 11, s["amber"], 700, "start", MONO)
    f.T(460, 434, "approval/asked → approval/decided", 11, s["text"], 400,
        "start", MONO)
    f.need("approval/asked → approval/decided", 11, 212, "audit")
    f.T(388, 476, "deny → structured error · no API call", 11, s["faint"],
        400, "start", MONO)

    # API trunk ------------------------------------------------------------
    f.card(760, 180, 296, 188, 18)
    f.T(780, 210, "api.github.com", 17, s["text"], 700, "start", MONO)
    f.T(780, 230, "REST + GraphQL · one transport", 11, s["faint"], 400,
        "start", MONO)
    f.T(780, 258, "Authorization: Bearer", 12, s["accent"], 400, "start", MONO)
    f.T(780, 284, "429 → Retry-After", 12, s["sub"], 400, "start", MONO)
    f.T(780, 310, "requestTimeoutMs · maxRetries", 12, s["sub"], 400, "start", MONO)
    f.add(f'<line x1="780" y1="324" x2="1036" y2="324" stroke="{s["edge"]}"/>')
    f.T(780, 342, "tokenSource: auto", 12, s["text"], 700, "start", MONO)
    f.T(780, 358, "config → credentials → env → gh", 11, s["faint"], 400,
        "start", MONO)

    # merge
    f.arrow("M680 350 H736 V300", s["accent"], 2.2)
    f.arrow("M720 300 H744", s["green"], 2.2, marker="arrGreen")
    f.add(f'<circle cx="744" cy="300" r="4.5" fill="{s["accent"]}"/>')
    f.arrow("M744 300 H760", s["accent"], 2.4)

    # output
    f.card(760, 388, 296, 112, 18)
    f.T(780, 414, "canonical JSON", 14, s["text"], 700, "start", MONO)
    f.T(780, 438, "tool/result → agent", 12, s["sub"], 400, "start", MONO)
    f.T(780, 462, "rate limit visible", 12, s["sub"], 400, "start", MONO)
    f.T(780, 486, "token never logged", 12, s["green"], 700, "start", MONO)
    f.arrow("M908 368 V388", s["accent"], 2.2)

    # review annex ---------------------------------------------------------
    f.card(44, 532, 496, 100, 18)
    f.T(60, 556, "/review · ctx.jobs", 13, s["accent"], 700, "start", MONO)
    f.T(206, 556, "background job", 11, s["faint"], 400, "start", MONO)
    f.chip(60, 566, 72, 30, "/review", 13)
    f.chip(144, 566, 122, 30, "github-review", 13)
    f.chip(278, 566, 112, 30, "src/review.ts", 13)
    f.chip(402, 566, 100, 30, "job_output", 13)
    for x0, x1 in ((132, 144), (266, 278), (390, 402)):
        f.arrow(f"M{x0} 581 H{x1}", s["sub"], 1.8, marker="arrMuted")
    f.arrow("M502 581 H520 V504", s["accent"], 2.0, dash="5 5")
    f.T(510, 524, "review_post · ask", 11, s["accent"], 700, "end", MONO)
    f.T(60, 620, "job_output → model → review_post (same gate)", 11,
        s["faint"], 400, "start", MONO)
    f.need("job_output → model → review_post (same gate)", 11, 440, "review note")

    # CI annex -------------------------------------------------------------
    f.card(570, 532, 486, 100, 18)
    f.T(586, 556, "CI · ci.enabled", 13, s["accent"], 700,
        "start", MONO)
    f.chip(586, 566, 96, 30, "action.yml", 13)
    f.chip(698, 566, 92, 30, "ci_run", 13)
    f.chip(806, 566, 94, 30, "check run", 13)
    f.arrow("M682 581 H698", s["sub"], 1.8, marker="arrMuted")
    f.arrow("M790 581 H806", s["sub"], 1.8, marker="arrMuted")
    f.add(
        f'<path d="M900 581 H910 V562 H916" fill="none" stroke="{s["sub"]}" '
        f'stroke-width="1.8" marker-end="url(#arrMuted)"/>'
    )
    f.add(
        f'<path d="M900 581 H910 V594 H916" fill="none" stroke="{s["sub"]}" '
        f'stroke-width="1.8" marker-end="url(#arrMuted)"/>'
    )
    f.rect(916, 550, 120, 24, 8, s["green_soft"], s["green"], 1.5)
    f.T(976, 566, "success", 13, s["green"], 700, "middle", MONO)
    f.rect(916, 582, 120, 24, 8, s["amber_soft"], s["amber"], 1.5)
    f.T(976, 598, "needs-changes", 13, s["amber"], 700, "middle", MONO)
    f.arrow("M744 566 V524 H660 V504", s["accent"], 2.0, dash="5 5")
    f.T(700, 518, "ask", 11, s["accent"], 700, "middle", MONO)
    f.T(586, 620, "polling bot · idempotent inline comments", 11,
        s["faint"], 400, "start", MONO)
    f.need("polling bot · idempotent inline comments", 11, 430, "ci note")

    # footer ---------------------------------------------------------------
    f.add(f'<line x1="44" y1="639" x2="1056" y2="639" stroke="{s["edge"]}"/>')
    f.T(44, 652, "tokenSource: auto · allowedActions whitelist · 429 backoff · "
        "fail-closed", 11, s["faint"], 400, "start", MONO)
    f.T(1056, 652, "Apache-2.0", 11, s["faint"], 400, "end", MONO)

    # extra guards
    f.need("writes ask a human · reads call next() · one token per operation",
           13, 700, "subtitle")
    f.need("tokenSource: auto · allowedActions whitelist · 429 backoff · "
           "fail-closed", 11, 830, "footer")
    f.need("8 write tools · one queue", 12, 180, "write label")
    f.need("read · next()", 12, 100, "legend read")
    f.need("write · ask", 12, 84, "legend write")
    f.need("audit pair", 12, 80, "legend audit")
    f.need("CI · ci.enabled", 13, 200, "ci title")
    f.need("needs-changes", 13, 106, "needs-changes")
    f.need("requestTimeoutMs · maxRetries", 12, 276, "api row")
    f.need("REST + GraphQL · one transport", 11, 276, "api sub")

    if f.bad:
        sys.exit("FATAL: flow label overflow:\n  " + "\n  ".join(f.bad))

    f.add("</svg>")
    return "\n".join(f.parts) + "\n"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin)
        path = os.path.join(OUT, f"dsh-github-flow-v5-{skin}.svg")
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
        print(f"wrote {os.path.relpath(path, ROOT)}")
    print("wrote 4 hero webp + 2 flow svg assets")


if __name__ == "__main__":
    main()
