"""Regenerates src/core/data/*.json from a checkout of the game repository.

Usage: python3 scripts/gen-game-data.py /path/to/sunflower-land
Reads recipes (cooking, juices, tools), marketplace ids and the chapter
ticket rules, which the delivery and valuation code needs.
"""
import json, re, sys, pathlib

game = pathlib.Path(sys.argv[1]) / "src/features/game"
out = pathlib.Path(__file__).resolve().parent.parent / "src/core/data"
out.mkdir(parents=True, exist_ok=True)

ENTRY = re.compile(r'^  (?:"([^"]+)"|([A-Z][A-Za-z]*)): \{', re.M)
DEC = re.compile(r'(?:"([^"]+)"|([A-Za-z]+)):\s*new Decimal\(([\d.]+)\)')

def blocks(text):
    marks = list(ENTRY.finditer(text))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        yield m.group(1) or m.group(2), text[m.end():end]

def recipe(body):
    ing = re.search(r'ingredients:[^{]*\{(.*?)\}', body, re.S)
    if not ing:
        return None
    items = {(a or b): float(n) for a, b, n in DEC.findall(ing.group(1))}
    price = re.search(r'\bprice:\s*([\d.]+)', body)
    r = {"items": items}
    if price:
        r["coins"] = float(price.group(1))
    return r if items or price else None

recipes = {}
for f in ["types/consumables.ts", "types/tools.ts"]:
    for name, body in blocks((game / f).read_text()):
        r = recipe(body)
        if r and name not in recipes:
            recipes[name] = r

fish = sorted(set(re.findall(r'^  (?:"([^"]+)"|(\w+)): \{', (game / "types/consumables.ts").read_text()
    .split("export const FISH:")[1].split("export const")[0], re.M)) and
    [a or b for a, b in re.findall(r'^  (?:"([^"]+)"|(\w+)): \{', (game / "types/consumables.ts").read_text()
    .split("export const FISH:")[1].split("export const")[0], re.M)])

idx = (game / "types/index.ts").read_text()
known = idx.split("export const KNOWN_IDS")[1].split("};")[0]
ids = {(a or b): int(n) for a, b, n in re.findall(r'^\s+(?:"([^"]+)"|(\w+)): (\d+),', known, re.M)}

bump = (game / "types/bumpkin.ts").read_text()
wsec = bump.split("export const ITEM_IDS")[1].split("};")[0]
wids = {(a or b): int(n) for a, b, n in re.findall(r'^\s+(?:"([^"]+)"|(\w+)): (\d+),', wsec, re.M)}

deliver = (game / "events/landExpansion/deliver.ts").read_text()
tsec = deliver.split("TICKET_REWARDS: Record<QuestNPCName, number> = {")[1].split("};")[0]
tickets = {(a or b): int(n) for a, b, n in re.findall(r'(?:"([^"]+)"|(\w+)):\s*(\d+)', tsec)}

chore = (game / "events/landExpansion/completeNPCChore.ts").read_text()
csec = chore.split("export const CHAPTER_TICKET_BOOST_ITEMS")[1].split("\n};")[0]
boosts = {}
for m in re.finditer(r'"([^"]+)": \{(.*?)\}', csec, re.S):
    boosts[m.group(1)] = re.findall(r':\s*"([^"]+)"', m.group(2))

chap = (game / "types/chapters.ts").read_text().split("export const CHAPTERS")[1].split("\n};")[0]
chapters = {}
for m in re.finditer(r'"([^"]+)": \{\s*startDate: new Date\("([^"]+)"\),(?:.*?\n)*?\s*endDate: new Date\("([^"]+)"\)', chap):
    chapters[m.group(1)] = {"start": m.group(2), "end": m.group(3)}

craft = (game / "types/craftables.ts").read_text()
dims = craft.split("export const COLLECTIBLES_DIMENSIONS")[1].split("\n};")[0]
placeable = sorted({(a or b) for a, b in re.findall(r'^  (?:"([^"]+)"|(\w+)):', dims, re.M)})

json.dump({"recipes": recipes, "fish": fish}, open(out / "recipes.json", "w"), separators=(",", ":"))
json.dump({"collectibles": ids, "wearables": wids, "placeable": placeable}, open(out / "ids.json", "w"), separators=(",", ":"))
json.dump({"tickets": tickets, "boosts": boosts, "chapters": chapters}, open(out / "chapters.json", "w"), indent=1)
print(len(recipes), "recipes,", len(fish), "fish,", len(ids), "ids,", len(wids), "wearables,", len(chapters), "chapters")
