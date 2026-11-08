"""Extract the user's nine native SVG mascots into app-ready, transparent assets.

Usage: python3 scripts/extract-character-assets.py /path/to/MindGPS_characters.svg
The source file is read only. The adjustments below intentionally retain its
palette, face shapes, pin silhouettes and drawing style.
"""

from copy import deepcopy
from pathlib import Path
import sys
import xml.etree.ElementTree as ET


SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
NAMES = [
    ("stage-star", "무대스타"),
    ("creator", "크리에이터"),
    ("comfort-friend", "토닥이"),
    ("game-hero", "게임히어로"),
    ("music-mate", "음악메이트"),
    ("sports-ace", "스포츠에이스"),
    ("artist", "그림작가"),
    ("ai-engineer", "AI공학자"),
    ("animal-guardian", "동물지킴이"),
]


def add(parent, tag, **attributes):
    return ET.SubElement(parent, f"{{{SVG}}}{tag}", {
        key.replace("_", "-"): str(value) for key, value in attributes.items()
    })


def extract(source: Path):
    root = ET.parse(source).getroot()
    cards = root.findall(f"{{{SVG}}}g")
    if len(cards) != len(NAMES):
        raise ValueError("Expected the supplied sheet with exactly nine character cards")
    target = Path(__file__).resolve().parents[1] / "src/assets/characters"
    target.mkdir(parents=True, exist_ok=True)
    # Indices refer to the supplied original sheet, before any removal.
    remove = {
        "stage-star": {18},  # Floating second star; keep the head star and microphone.
        "creator": {13, 14, 15, 18, 19},  # Keep the phone as the main identity cue.
        "comfort-friend": set(range(12, 20)),  # Replace all medical props and arms.
        "game-hero": {26},
        "music-mate": {20, 21},
        "sports-ace": set(range(16, 23)),  # Keep basketball/headband; remove other sports.
        "artist": {18, 19, 20},
        "animal-guardian": {24, 25, 26},  # Keep dog and the small body paw emblem.
    }
    for card, (stem, name) in zip(cards, NAMES):
        label = card.find(f"{{{SVG}}}text")
        if label is None or label.text != name:
            raise ValueError(f"Unexpected character order: expected {name}")
        original = card.find(f"{{{SVG}}}g")
        if original is None or original.get("transform") != "translate(20 22)":
            raise ValueError(f"Unexpected drawing structure: {name}")
        asset = ET.Element(f"{{{SVG}}}svg", {
            "viewBox": "-10 -10 280 280", "width": "280", "height": "280",
            "role": "img", "aria-labelledby": "character-title",
        })
        add(asset, "title", id="character-title").text = name
        drawing = add(asset, "g")
        for index, element in enumerate(original):
            if index not in remove.get(stem, set()):
                drawing.append(deepcopy(element))
        if stem == "comfort-friend":
            # A warm heart held with both arms, using the original blue and coral.
            for d in ("M67 173 Q69 204 101 206", "M193 173 Q191 204 159 206"):
                add(drawing, "path", d=d, fill="none", stroke="#4F7ABF",
                    stroke_width=10, stroke_linecap="round")
                add(drawing, "path", d=d, fill="none", stroke="#669DF6",
                    stroke_width=5, stroke_linecap="round")
            add(drawing, "path", d="M130 182 C119 164 91 169 94 190 C97 207 116 220 130 231 C144 220 163 207 166 190 C169 169 141 164 130 182 Z",
                fill="#F28B82", stroke="#B95047", stroke_width=4,
                stroke_linejoin="round")
            add(drawing, "path", d="M104 186 Q108 178 117 181", fill="none",
                stroke="#FAD4D1", stroke_width=4, stroke_linecap="round")
            for cx, angle in ((96, 45), (164, -45)):
                add(drawing, "ellipse", cx=cx, cy=203, rx=12, ry=17,
                    fill="#669DF6", stroke="#4F7ABF", stroke_width=4.5,
                    transform=f"rotate({angle} {cx} 203)")
        if stem == "sports-ace":
            # Replace the removed glove with a relaxed, clearly visible free hand.
            add(drawing, "ellipse", cx=46, cy=172, rx=12, ry=17,
                fill="#FFB36B", stroke="#C68B53", stroke_width=4.5,
                transform="rotate(35 46 172)")
        ET.indent(asset, space="  ")
        destination = target / f"{stem}.svg"
        destination.write_text(ET.tostring(asset, encoding="unicode") + "\n", encoding="utf-8")
        print(f"{destination.name}: {name}, {asset.get('viewBox')}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    extract(Path(sys.argv[1]))
