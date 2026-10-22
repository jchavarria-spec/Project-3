#!/usr/bin/env python3
"""Production breakdown + stripboard generator for Fountain screenplays.

Usage:
    python3 breakdown.py screenplay.fountain [-o stripboard.html] [--json breakdown.json]

What it extracts per scene:
  * scene number, INT/EXT, set (location), time of day
  * characters  - speaking roles, plus anyone introduced in CAPS with a
                  "(description)" or mentioned by name in the action
  * props       - CAPITALIZED nouns in action lines (the usual breakdown
                  convention), plus later lowercase mentions of the same item
  * vehicles    - props whose name contains a vehicle word
  * page length - in eighths of a page, estimated from formatted line count
                  (55 lines per page, standard screenplay margins)

No third-party dependencies.
"""

import argparse
import html
import json
import re
import sys
from dataclasses import dataclass, field

LINES_PER_PAGE = 55
ACTION_WIDTH = 61        # characters per line at 12pt Courier, 6.0" column
DIALOGUE_WIDTH = 35      # 3.5" column
PAREN_WIDTH = 28         # ~2.8" column

SCENE_RE = re.compile(r"^(?:\.(?!\.)|(?:INT|EXT|EST|INT\.?/EXT|I/E)[. ])", re.I)
TRANSITION_RE = re.compile(r"^(?:[A-Z ]+TO:|FADE (?:IN|OUT)[:.]|CUT TO BLACK\.?)$|^>(?!.*<$)")
CAPS_RUN_RE = re.compile(r"\b[A-Z][A-Z0-9'\-]*(?:\s+[A-Z][A-Z0-9'\-]*)*\b")
VEHICLE_WORDS = {"TAXI", "CAB", "CAR", "TRUCK", "VAN", "BUS", "BOAT", "MOTORCYCLE", "BIKE", "BICYCLE"}
# Capitalized words that are camera/editorial direction rather than props.
NON_PROP_WORDS = {"V.O", "O.S", "O.C", "CONT'D", "POV", "CLOSE", "ANGLE", "INSERT",
                  "BACK", "SUPER", "TITLE", "INTERCUT", "FLASHBACK", "MONTAGE", "I", "A"}
TIME_ORDER = ["DAY", "MORNING", "AFTERNOON", "DAWN", "DUSK", "EVENING", "NIGHT"]


@dataclass
class Element:
    kind: str   # heading, action, character, parenthetical, dialogue, transition
    text: str


@dataclass
class Scene:
    number: int
    heading: str
    int_ext: str
    location: str
    time: str
    elements: list = field(default_factory=list)
    characters: list = field(default_factory=list)
    props: list = field(default_factory=list)
    props_referenced: list = field(default_factory=list)
    vehicles: list = field(default_factory=list)
    lines: int = 0
    eighths: int = 0
    synopsis: str = ""


# --------------------------------------------------------------------------- parsing

def strip_markup(text):
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)      # boneyard
    text = re.sub(r"\[\[.*?\]\]", "", text, flags=re.S)    # notes
    return text


def split_title_page(text):
    lines = text.split("\n")
    if lines and re.match(r"^[A-Za-z ]+:", lines[0]):
        for i, line in enumerate(lines):
            if not line.strip():
                return lines[i + 1:]
        return []
    return lines


def is_character_cue(line):
    if line.startswith("@"):
        return True
    name = re.sub(r"\(.*?\)", "", line).replace("^", "").strip()
    return bool(name) and name == name.upper() and re.search(r"[A-Z]", name) is not None \
        and not SCENE_RE.match(line) and not line.endswith(":")


def parse(text):
    lines = split_title_page(strip_markup(text.replace("\r\n", "\n")))
    elements = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        prev_blank = i == 0 or not lines[i - 1].strip()
        next_line = lines[i + 1].strip() if i + 1 < len(lines) else ""
        if not line:
            i += 1
            continue
        if prev_blank and SCENE_RE.match(line):
            elements.append(Element("heading", line.lstrip(".").strip()))
        elif prev_blank and TRANSITION_RE.match(line):
            elements.append(Element("transition", line.lstrip(">").strip()))
        elif prev_blank and next_line and is_character_cue(line):
            elements.append(Element("character", line.lstrip("@").strip()))
            i += 1
            while i < len(lines) and lines[i].strip():
                dl = lines[i].strip()
                kind = "parenthetical" if dl.startswith("(") and dl.endswith(")") else "dialogue"
                elements.append(Element(kind, dl))
                i += 1
            continue
        else:
            elements.append(Element("action", line.lstrip("!")))
        i += 1
    return elements


def parse_heading(heading):
    m = re.match(r"^(INT\.?/EXT|I/E|INT|EXT|EST)\.?\s+(.*)$", heading, re.I)
    int_ext, rest = (m.group(1).upper().rstrip("."), m.group(2)) if m else ("", heading)
    if int_ext == "I/E":
        int_ext = "INT/EXT"
    rest = re.sub(r"\s*#.*?#\s*$", "", rest)              # scene numbers
    parts = [p.strip() for p in re.split(r"\s+-\s+", rest)]
    time = parts.pop().upper() if len(parts) > 1 else ""
    return int_ext, " - ".join(parts).upper(), time


# --------------------------------------------------------------------------- page length

def wrapped(text, width):
    words, lines, cur = text.split(), 0, 0
    for w in words:
        if cur and cur + 1 + len(w) > width:
            lines, cur = lines + 1, len(w)
        else:
            cur = cur + (1 if cur else 0) + len(w)
    return lines + (1 if cur else 0)


def element_lines(el, prev_kind):
    # Elements are separated by a blank line, except inside a dialogue block.
    gap = 0 if el.kind in ("parenthetical", "dialogue") and prev_kind in ("character", "parenthetical", "dialogue") else 1
    width = {"action": ACTION_WIDTH, "dialogue": DIALOGUE_WIDTH, "parenthetical": PAREN_WIDTH}.get(el.kind)
    body = wrapped(el.text, width) if width else 1
    return gap + body


def format_eighths(n):
    pages, rem = divmod(n, 8)
    if pages and rem:
        return f"{pages} {rem}/8"
    return str(pages) if pages else f"{rem}/8"


# --------------------------------------------------------------------------- breakdown

def build_scenes(elements):
    scenes, current = [], None
    for el in elements:
        if el.kind == "heading":
            int_ext, loc, time = parse_heading(el.text)
            current = Scene(len(scenes) + 1, el.text, int_ext, loc, time, [el])
            scenes.append(current)
        elif current:
            current.elements.append(el)
    return scenes


def cue_name(text):
    return re.sub(r"\(.*?\)", "", text).replace("^", "").strip().upper()


def caps_phrases(text):
    for m in CAPS_RUN_RE.finditer(text):
        phrase = m.group(0).strip("-' ")
        if len(phrase) < 2 or not re.search(r"[A-Z]{2}", phrase):
            continue
        yield phrase, text[m.end():m.end() + 2]


def analyse(scenes):
    # Pass 1: cast = every speaker + anyone introduced as "NAME (description)".
    cast = []
    def add_cast(name):
        if name and name not in cast:
            cast.append(name)
    for sc in scenes:
        for el in sc.elements:
            if el.kind == "character":
                add_cast(cue_name(el.text))
            elif el.kind == "action":
                for phrase, after in caps_phrases(el.text):
                    if after.startswith(" (") and phrase not in NON_PROP_WORDS:
                        add_cast(phrase)

    # A CAPS phrase that names a set (e.g. HARBOR BRIDGE) is a location, not a prop.
    set_names = {part for sc in scenes for part in [sc.location, sc.location.split(" - ")[0]]}
    all_props = []

    # Pass 2: per-scene characters and explicitly tagged (CAPS) props.
    for sc in scenes:
        chars = []
        for el in sc.elements:
            if el.kind == "character":
                chars.append(cue_name(el.text))
            elif el.kind in ("action", "parenthetical"):
                for name in cast:
                    if re.search(r"\b" + re.escape(name) + r"\b", el.text, re.I):
                        chars.append(name)
            if el.kind not in ("action", "parenthetical"):
                continue
            for phrase, after in caps_phrases(el.text):
                base = re.sub(r"'S$", "", phrase)
                is_vehicle = bool(set(base.split()) & VEHICLE_WORDS)
                if (base in cast or after.startswith(" (") or base in NON_PROP_WORDS
                        or (base in set_names and not is_vehicle)):
                    continue
                if base not in sc.props:
                    sc.props.append(base)
                if base not in all_props:
                    all_props.append(base)
        sc.characters = sorted(set(chars), key=cast.index)

    # Pass 3: later lowercase references to a prop already tagged elsewhere.
    for sc in scenes:
        text = " ".join(el.text for el in sc.elements if el.kind in ("action", "parenthetical"))
        own_heads = {p.split()[-1] for p in sc.props}
        own_words = {w for p in sc.props for w in p.split()}
        for prop in all_props:
            if prop in sc.props or set(prop.split()) <= own_words:
                continue
            head = prop.split()[-1]
            if re.search(r"\b" + re.escape(prop) + r"\b", text, re.I) or (
                    head not in own_heads and re.search(r"\b" + re.escape(head) + r"s?\b", text, re.I)):
                sc.props_referenced.append(prop)

    # Vehicles get their own breakdown category; a set like INT. TAXI needs the picture car too.
    for sc in scenes:
        set_vehicle = sc.location.split(" - ")[0]
        if set_vehicle in VEHICLE_WORDS and set_vehicle not in sc.props + sc.props_referenced:
            sc.props_referenced.append(set_vehicle)
        for bucket in (sc.props, sc.props_referenced):
            for p in list(bucket):
                if set(p.split()) & VEHICLE_WORDS and len(p.split()) == 1:
                    bucket.remove(p)
                    sc.vehicles.append(p)

    # Page length and a one-line synopsis.
    for sc in scenes:
        prev, total = None, 0
        for el in sc.elements:
            total += element_lines(el, prev)
            prev = el.kind
        sc.lines = total
        sc.eighths = max(1, round(total * 8 / LINES_PER_PAGE))
        first_action = next((e.text for e in sc.elements if e.kind == "action"), "")
        sc.synopsis = re.split(r"(?<=[.!?])\s", first_action)[0]

    return cast


# --------------------------------------------------------------------------- output

STRIP_CLASSES = {
    ("INT", "DAY"): "int-day", ("EXT", "DAY"): "ext-day",
    ("INT", "NIGHT"): "int-night", ("EXT", "NIGHT"): "ext-night",
}


def strip_class(sc):
    ie = "EXT" if sc.int_ext.startswith("EXT") or sc.int_ext == "EST" else "INT"
    t = sc.time
    if t in ("DAWN", "DUSK", "SUNRISE", "SUNSET", "MAGIC HOUR"):
        return "dawn-dusk"
    tod = "NIGHT" if t in ("NIGHT", "EVENING", "LATER NIGHT") else "DAY"
    return STRIP_CLASSES[(ie, tod)]


def to_json(title, cast, scenes):
    return {
        "title": title,
        "total_eighths": sum(s.eighths for s in scenes),
        "total_pages": format_eighths(sum(s.eighths for s in scenes)),
        "cast": [{"id": i + 1, "name": n} for i, n in enumerate(cast)],
        "scenes": [{
            "number": s.number, "heading": s.heading, "int_ext": s.int_ext,
            "location": s.location, "time": s.time, "synopsis": s.synopsis,
            "characters": s.characters, "props": s.props,
            "props_referenced": s.props_referenced, "vehicles": s.vehicles,
            "eighths": s.eighths, "pages": format_eighths(s.eighths),
            "strip": strip_class(s),
        } for s in scenes],
    }


def render_html(data):
    e = html.escape
    cast_ids = {c["name"]: c["id"] for c in data["cast"]}
    rows = []
    for s in data["scenes"]:
        ids = " ".join(f'<span class="cid" title="{e(c)}">{cast_ids[c]}</span>' for c in s["characters"])
        props = [f"<span>{e(p.title())}</span>" for p in s["props"]]
        props += [f'<span class="ref" title="Referenced, tagged in another scene">{e(p.title())}</span>' for p in s["props_referenced"]]
        veh = "".join(f'<span class="veh">{e(v.title())}</span>' for v in s["vehicles"])
        rows.append(f'''
      <tr class="strip {s['strip']}" data-scene="{s['number']}" data-loc="{e(s['location'])}" data-time="{e(s['time'])}" data-ie="{e(s['int_ext'])}">
        <td class="num">{s['number']}</td>
        <td class="ie">{e(s['int_ext'])}</td>
        <td class="set"><strong>{e(s['location'])}</strong><div class="syn">{e(s['synopsis'])}</div></td>
        <td class="tod">{e(s['time'])}</td>
        <td class="pg">{e(s['pages'])}</td>
        <td class="cast">{ids}</td>
        <td class="props">{"".join(props)}{veh}</td>
      </tr>''')

    cast_rows = "".join(
        f'<li><span class="cid">{c["id"]}</span>{e(c["name"].title())}'
        f'<em>{sum(c["name"] in s["characters"] for s in data["scenes"])} sc · '
        f'{format_eighths(sum(s["eighths"] for s in data["scenes"] if c["name"] in s["characters"]))} pg</em></li>'
        for c in data["cast"])

    sheets = []
    for s in data["scenes"]:
        def lst(items):
            return ", ".join(e(i.title()) for i in items) or "—"
        sheets.append(f'''
      <article class="sheet">
        <header class="{s['strip']}"><b>Scene {s['number']}</b> {e(s['heading'])} <span>{e(s['pages'])} pg</span></header>
        <dl>
          <dt>Synopsis</dt><dd>{e(s['synopsis'])}</dd>
          <dt>Cast</dt><dd>{lst(s['characters'])}</dd>
          <dt>Props</dt><dd>{lst(s['props'] + s['props_referenced'])}</dd>
          <dt>Vehicles</dt><dd>{lst(s['vehicles'])}</dd>
        </dl>
      </article>''')

    return TEMPLATE.format(
        title=e(data["title"]), total=e(data["total_pages"]), nscenes=len(data["scenes"]),
        ncast=len(data["cast"]), nsets=len({s["location"] for s in data["scenes"]}),
        rows="".join(rows), cast=cast_rows, sheets="".join(sheets),
    )


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} Stripboard</title>
<style>
  :root {{
    --bg: #f4f1ea; --panel: #fffdf8; --ink: #1d1b18; --muted: #6b665d; --line: #d8d2c4;
    --int-day: #ffffff; --ext-day: #fff3a6; --int-night: #bcd5f5; --ext-night: #bfe6c4; --dawn-dusk: #f9c9d6;
    --strip-ink: #1d1b18; --chip: #1d1b18; --chip-ink: #fffdf8;
  }}
  @media (prefers-color-scheme: dark) {{
    :root:not([data-theme="light"]) {{
      --bg: #161513; --panel: #201f1c; --ink: #ece8df; --muted: #a39d92; --line: #3a3732;
      --chip: #ece8df; --chip-ink: #161513;
    }}
  }}
  :root[data-theme="dark"] {{
    --bg: #161513; --panel: #201f1c; --ink: #ece8df; --muted: #a39d92; --line: #3a3732;
    --chip: #ece8df; --chip-ink: #161513;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink);
         font: 15px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }}
  main {{ max-width: 1100px; margin: 0 auto; padding: 32px 16px 64px; }}
  h1 {{ font: 700 30px/1.1 "Courier Prime", "Courier New", monospace; margin: 0 0 4px; letter-spacing: .02em; }}
  h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); margin: 40px 0 12px; }}
  .sub {{ color: var(--muted); margin: 0 0 20px; }}
  .stats {{ display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }}
  .stat {{ background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 16px; min-width: 110px; }}
  .stat b {{ display: block; font-size: 22px; font-variant-numeric: tabular-nums; }}
  .stat span {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }}
  .controls {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }}
  .controls button {{ font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
                      border: 1px solid var(--line); background: var(--panel); color: var(--ink); }}
  .controls button[aria-pressed="true"] {{ background: var(--ink); color: var(--bg); border-color: var(--ink); }}
  .legend {{ display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--muted); margin-left: auto; }}
  .legend i {{ display: inline-block; width: 14px; height: 14px; border-radius: 3px; vertical-align: -3px; margin-right: 5px; border: 1px solid rgba(0,0,0,.25); }}
  .board {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }}
  table {{ border-collapse: separate; border-spacing: 0 3px; width: 100%; min-width: 760px; padding: 0 3px; }}
  th {{ text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted);
        padding: 10px 10px 4px; font-weight: 600; }}
  .strip td {{ padding: 8px 10px; color: var(--strip-ink); border-top: 1px solid rgba(0,0,0,.18); border-bottom: 1px solid rgba(0,0,0,.18); vertical-align: top; }}
  .strip td:first-child {{ border-left: 1px solid rgba(0,0,0,.18); border-radius: 4px 0 0 4px; }}
  .strip td:last-child {{ border-right: 1px solid rgba(0,0,0,.18); border-radius: 0 4px 4px 0; }}
  .int-day td, header.int-day {{ background: var(--int-day); }}
  .ext-day td, header.ext-day {{ background: var(--ext-day); }}
  .int-night td, header.int-night {{ background: var(--int-night); }}
  .ext-night td, header.ext-night {{ background: var(--ext-night); }}
  .dawn-dusk td, header.dawn-dusk {{ background: var(--dawn-dusk); }}
  .cast {{ white-space: nowrap; }}
  .num {{ font: 700 18px "Courier New", monospace; width: 44px; text-align: center; }}
  .ie, .tod {{ font: 600 12px "Courier New", monospace; white-space: nowrap; }}
  .set strong {{ font-family: "Courier New", monospace; }}
  .syn {{ font-size: 12px; opacity: .75; margin-top: 2px; }}
  .pg {{ font: 700 14px "Courier New", monospace; white-space: nowrap; font-variant-numeric: tabular-nums; }}
  .cid {{ display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%;
          background: #1d1b18; color: #fffdf8; font-size: 11px; font-weight: 700; margin: 0 3px 3px 0; }}
  .props span {{ display: inline-block; font-size: 12px; padding: 1px 7px; margin: 0 4px 4px 0; border-radius: 10px;
                 background: rgba(0,0,0,.08); }}
  .props .ref {{ font-style: italic; background: transparent; border: 1px dashed rgba(0,0,0,.3); }}
  .props .veh {{ background: rgba(0,0,0,.75); color: #fff; }}
  tr.daybreak td {{ background: #1d1b18; color: #fffdf8; font: 700 12px "Courier New", monospace; text-align: center;
                    letter-spacing: .1em; padding: 5px; border-radius: 4px; }}
  .castlist {{ list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }}
  .castlist li {{ background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; }}
  .castlist .cid {{ background: var(--chip); color: var(--chip-ink); margin: 0; }}
  .castlist em {{ margin-left: auto; color: var(--muted); font-size: 12px; font-style: normal; }}
  .sheets {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }}
  .sheet {{ background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }}
  .sheet header {{ color: #1d1b18; padding: 8px 12px; font: 600 13px "Courier New", monospace; display: flex; gap: 8px; border-bottom: 1px solid rgba(0,0,0,.15); }}
  .sheet header span {{ margin-left: auto; white-space: nowrap; }}
  .sheet dl {{ margin: 0; padding: 10px 12px; display: grid; grid-template-columns: 80px 1fr; gap: 4px 10px; font-size: 13px; }}
  .sheet dt {{ color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding-top: 2px; }}
  .sheet dd {{ margin: 0; }}
  footer {{ margin-top: 40px; color: var(--muted); font-size: 12px; }}
  @media print {{ .controls button {{ display: none; }} body {{ background: #fff; }} }}
</style>
</head>
<body>
<main>
  <h1>{title}</h1>
  <p class="sub">Production breakdown &amp; stripboard</p>

  <div class="stats">
    <div class="stat"><b>{nscenes}</b><span>Scenes</span></div>
    <div class="stat"><b>{total}</b><span>Pages</span></div>
    <div class="stat"><b>{ncast}</b><span>Cast</span></div>
    <div class="stat"><b>{nsets}</b><span>Sets</span></div>
  </div>

  <div class="controls">
    <button type="button" data-sort="scene" aria-pressed="true">Script order</button>
    <button type="button" data-sort="loc" aria-pressed="false">Group by set</button>
    <button type="button" data-sort="time" aria-pressed="false">Group by INT/EXT · time</button>
    <div class="legend">
      <span><i style="background:var(--int-day)"></i>Int · Day</span>
      <span><i style="background:var(--ext-day)"></i>Ext · Day</span>
      <span><i style="background:var(--int-night)"></i>Int · Night</span>
      <span><i style="background:var(--ext-night)"></i>Ext · Night</span>
      <span><i style="background:var(--dawn-dusk)"></i>Dawn / Dusk</span>
    </div>
  </div>

  <div class="board">
    <table>
      <thead><tr><th>Sc</th><th>I/E</th><th>Set · synopsis</th><th>D/N</th><th>Pages</th><th>Cast</th><th>Props &amp; vehicles</th></tr></thead>
      <tbody id="strips">{rows}
      </tbody>
    </table>
  </div>

  <h2>Cast</h2>
  <ul class="castlist">{cast}</ul>

  <h2>Breakdown sheets</h2>
  <div class="sheets">{sheets}
  </div>

  <footer>Page lengths are estimated in eighths (55 formatted lines per page). Dashed props are mentions of an item tagged in another scene.</footer>
</main>
<script>
  const body = document.getElementById('strips');
  const strips = [...body.querySelectorAll('tr.strip')];
  const timeRank = t => {{ const o = {time_order}; const i = o.indexOf(t); return i < 0 ? o.length : i; }};
  const keyFns = {{
    scene: r => [+r.dataset.scene],
    loc:   r => [r.dataset.loc, +r.dataset.scene],
    time:  r => [r.dataset.ie, timeRank(r.dataset.time), r.dataset.loc, +r.dataset.scene],
  }};
  const cmp = (a, b) => {{ for (let i = 0; i < a.length; i++) {{ if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; }} return 0; }};
  function arrange(mode) {{
    body.querySelectorAll('tr.daybreak').forEach(r => r.remove());
    const sorted = strips.slice().sort((a, b) => cmp(keyFns[mode](a), keyFns[mode](b)));
    let group = null;
    sorted.forEach(r => {{
      const g = mode === 'loc' ? r.dataset.loc : mode === 'time' ? r.dataset.ie + ' · ' + r.dataset.time : null;
      if (g !== null && g !== group) {{
        group = g;
        const hdr = document.createElement('tr');
        hdr.className = 'daybreak';
        hdr.innerHTML = '<td colspan="7"></td>';
        hdr.firstChild.textContent = g;
        body.appendChild(hdr);
      }}
      body.appendChild(r);
    }});
    document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === mode));
  }}
  document.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => arrange(b.dataset.sort)));
</script>
</body>
</html>
""".replace("{time_order}", json.dumps(TIME_ORDER).replace("{", "{{").replace("}", "}}"))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("script", help="Fountain screenplay (.fountain)")
    ap.add_argument("-o", "--output", default="stripboard.html", help="HTML stripboard to write")
    ap.add_argument("--json", help="also write the breakdown as JSON")
    args = ap.parse_args(argv)

    with open(args.script, encoding="utf-8") as f:
        source = f.read()
    m = re.search(r"^Title:\s*(.+)$", source, re.M)
    title = m.group(1).strip() if m else "Untitled"

    scenes = build_scenes(parse(source))
    if not scenes:
        sys.exit("No scene headings found.")
    cast = analyse(scenes)
    data = to_json(title, cast, scenes)

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(render_html(data))
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    print(f"{title}: {len(scenes)} scenes, {data['total_pages']} pages")
    print(f"{'SC':>3}  {'I/E':<4} {'SET':<20} {'TIME':<6} {'PGS':>6}  CAST / PROPS")
    for s in data["scenes"]:
        print(f"{s['number']:>3}  {s['int_ext']:<4} {s['location'][:20]:<20} {s['time']:<6} {s['pages']:>6}  "
              f"{', '.join(s['characters'])}")
        print(f"{'':>45}props: {', '.join(s['props'] + s['props_referenced']) or '-'}"
              f"{'  vehicles: ' + ', '.join(s['vehicles']) if s['vehicles'] else ''}")
    print(f"Wrote {args.output}" + (f" and {args.json}" if args.json else ""))


if __name__ == "__main__":
    main()
