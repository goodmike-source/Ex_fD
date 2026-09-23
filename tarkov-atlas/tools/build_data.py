"""Convert a dated open-source quest snapshot to Tarkov Atlas offline assets."""
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "vendor" / "Tarkov-moa-0.9.0" / "data" / "snapshot"
PUBLIC = ROOT / "web" / "data"
PUBLIC.mkdir(parents=True, exist_ok=True)

# Static positioning metadata attributed to the-hideout/tarkov-dev map data.
MAPS = [
    ("Customs", "Таможня", "56f40101d2720b2a4d8b45d6", [[698,-307],[-372,237]], 180),
    ("Factory", "Завод", "55f2d3fd4bdc2d5f408b4567", [[77,-64.5],[-65.5,67.4]], 90),
    ("GroundZero", "Эпицентр", "653e6760052c01c1c805532f", [[249,-124],[-99,364]], 180),
    ("Interchange", "Развязка", "5714dbc024597771384a510d", [[598,-442],[-433,426]], 180),
    ("Labs", "Лаборатория", "5b0fc42d86f7744a585f9105", [[-80,-477],[-287,-193]], 270),
    ("Lighthouse", "Маяк", "5704e4dad2720bb55b8b4567", [[515,-998],[-545,725]], 180),
    ("Reserve", "Резерв", "5704e5fad2720bc05b8b4567", [[289,-293],[-303,244]], 180),
    ("Shoreline", "Берег", "5704e554d2720bac5b8b456e", [[504,-415],[-1056,618]], 180),
    ("StreetsOfTarkov", "Улицы Таркова", "5714dc692459777137212e12", [[323,-295],[-280,532]], 180),
    ("Terminal", "Терминал", "65cc8f81a9aac3e77d0cfd3e", [[463,-580],[-433,475]], 180),
    ("Woods", "Лес", "5704e3c2d2720bac5b8b4567", [[646,-914],[-761,442]], 180),
]

def build():
    base = json.loads((SNAPSHOT/"base.json").read_text(encoding="utf-8"))
    ru = json.loads((SNAPSHOT/"locale-ru.json").read_text(encoding="utf-8"))
    en = json.loads((SNAPSHOT/"locale-en.json").read_text(encoding="utf-8"))
    result_maps = []
    by_id = {}
    for key, title, mid, bounds, rotation in MAPS:
        path = ROOT/"web"/"maps"/(key+".svg")
        if not path.is_file() or path.stat().st_size < 10000:
            raise ValueError(f"SVG map is missing/incomplete: {path}")
        root = ET.parse(path).getroot()
        viewbox = root.attrib.get("viewBox")
        if not viewbox:
            raise ValueError(f"No SVG viewBox: {path}")
        nums = [float(n) for n in re.split(r"[,\s]+", viewbox.strip())]
        if len(nums) != 4 or nums[2] <= 0 or nums[3] <= 0:
            raise ValueError(f"Invalid SVG viewBox: {path}")
        item = {"key":key, "name":title,"id":mid,"bounds":bounds, "rotation":rotation,
                "width":nums[2], "height":nums[3]}
        result_maps.append(item)
        by_id[mid] = key
    # These are different game modes/floors of the same physical location.
    by_id.update({
        "59fc81d786f774390775787e":"Factory",
        "65b8d6f5cdde2479cb2a3125":"GroundZero",
        "68236e8153654e8c1200798a":"GroundZero",
        "6a294a5b5eb5f9a1700417b7":"Labs",
    })

    quests = []
    for task_id, task in base["tasks"].items():
        name_key = task.get("name", "")
        trader_id = task.get("trader", "")
        trader = base["traders"].get(trader_id, {})
        trader_key = trader.get("name", "")
        objectives = []
        zone_map_keys = set()
        for objective in task.get("objectives", []):
            objective_key = objective.get("description", "")
            zones = []
            for zone in objective.get("zones", []):
                raw = zone.get("position") or {}
                key = by_id.get(zone.get("map"))
                if key and all(k in raw for k in ("x","z")):
                    zones.append({
                        "map":key,"x":round(float(raw["x"]),3),
                        "y":round(float(raw.get("y",0)),3),
                        "z":round(float(raw["z"]),3),
                    })
                    zone_map_keys.add(key)
            objectives.append({
                "id":objective.get("id",""),
                "type":objective.get("type",""),
                "name":ru["tasks"].get(objective_key) or en["tasks"].get(objective_key) or objective_key,
                "optional":bool(objective.get("optional",False)),
                "count":objective.get("count") or 1,
                "zones":zones
            })
        keys = [by_id[mid] for mid in [task.get("map")] if mid in by_id]
        keys.extend(sorted(zone_map_keys))
        quests.append({
            "id":task_id,
            "name":ru["tasks"].get(name_key) or en["tasks"].get(name_key) or task.get("normalizedName",task_id),
            "trader":ru["traders"].get(trader_key) or en["traders"].get(trader_key) or "Торговец",
            "maps":list(dict.fromkeys(keys)),
            "kappa":bool(task.get("kappaRequired",False)),
            "faction":task.get("factionName") or "Any",
            "objectives":objectives,
        })
    quests.sort(key=lambda q:q["name"].casefold())
    (PUBLIC/"quests.json").write_text(json.dumps(quests,ensure_ascii=False,separators=(',',':')),encoding="utf-8")
    (PUBLIC/"maps.json").write_text(json.dumps(result_maps,ensure_ascii=False,separators=(',',':')),encoding="utf-8")
    (PUBLIC/"meta.json").write_text(json.dumps({
        "questSnapshotDate":base.get("generatedAt"),"questCount":len(quests),"mapCount":len(result_maps),
        "notes":"Quest data is a dated snapshot, not a live TarkovHead feed."
    },ensure_ascii=False),encoding="utf-8")
    assert len(result_maps)==11 and len(quests)>=500
    assert sum(bool(obj["zones"]) for quest in quests for obj in quest["objectives"])>250
    print(f"PASS: {len(result_maps)} local maps, {len(quests)} localized quests")

if __name__=="__main__":
    build()
