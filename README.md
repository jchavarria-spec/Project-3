# Project-3 — Fountain screenplay breakdown

- `screenplay.fountain` — *The Last Fare*, a 3-page short in [Fountain](https://fountain.io) format (5 scenes, 4 characters, 4 locations).
- `breakdown.py` — reads a Fountain script and produces a production breakdown and a color-coded stripboard. Python 3 standard library only.
- `stripboard.html` / `breakdown.json` — the generated output for the screenplay. Open `stripboard.html` in any browser.

```sh
python3 breakdown.py screenplay.fountain -o stripboard.html --json breakdown.json
```

## What the breakdown finds

| Field | How it is detected |
| --- | --- |
| Scene, INT/EXT, set, day/night | Parsed from scene headings (`INT. TAXI - MOVING - NIGHT`). |
| Characters | Dialogue speakers, anyone introduced in caps with a description (`OLD MAN (70s, ...)`), and cast names mentioned in action lines. |
| Props | CAPITALIZED items in action lines and parentheticals (standard breakdown convention). Later lowercase mentions of a tagged prop are listed too, shown dashed. |
| Vehicles | Props containing a vehicle word (taxi, car, truck, ...), plus the picture car when the set itself is a vehicle. |
| Page length | Eighths of a page, from the formatted line count at standard margins (55 lines/page). |

## Stripboard colors

Int · Day white, Ext · Day yellow, Int · Night blue, Ext · Night green, Dawn/Dusk pink. Strips can be shown in script order, grouped by set, or grouped by INT/EXT and time of day. Below the board are the cast list (with scene and page counts) and a breakdown sheet per scene.

Writing tip: put props in CAPS in action lines and keep sound effects lowercase so they aren't picked up as props.
