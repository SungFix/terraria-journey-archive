#!/usr/bin/env python3
"""Update the local Journey Mode item catalog using the official research list.

Facts only: item ID, English item name, page title and research count.
Preserve previously known keys/translated names. Does not download wiki article text.
"""
import datetime
import json
from pathlib import Path
from urllib.parse import urlencode, unquote, urlparse
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / "data" / "catalog-base.json"
URL = "https://terraria.wiki.gg/api.php?" + urlencode({
    "action": "parse",
    "page": "Journey_Mode/Research_list",
    "prop": "text|revid",
    "format": "json",
    "origin": "*",
})

def build():
    prev = json.loads(FILE.read_text(encoding="utf-8"))
    prior = {int(item["id"]): item for item in prev.get("items", [])}
    with urlopen(Request(URL,headers={"User-Agent":"JourneyArchive/1.1 (noncommercial, repository SungFix/terraria-journey-archive)"}),timeout=60) as response:
        data = json.load(response)
    parsed = data["parse"]
    doc = BeautifulSoup(parsed["text"]["*"], "html.parser")
    table = doc.select_one("table.terraria")
    if not table:
        raise RuntimeError("Official research list table missing; refusing empty update")
    rows, unavailable = [], []
    for tr in table.select("tr"):
        cells = tr.find_all("td", recursive=False)
        if len(cells) < 3:
            continue
        raw_id = cells[0].get_text(" ",strip=True).replace(",","").strip()
        raw_qty = cells[-1].get_text(" ",strip=True).replace(",","").strip()
        if not raw_id.isdecimal():
            continue
        item_id = int(raw_id)
        a = cells[1].find("a",href=True)
        name = cells[1].get_text(" ",strip=True)
        if raw_qty.lower() in ("n/a","na","—","-"):
            unavailable.append(item_id)
            continue
        if not raw_qty.isdecimal():
            raise RuntimeError("Unexpected research count on ID %s: %r" %(raw_id,raw_qty))
        quantity = int(raw_qty)
        if not 1 <= quantity <= 9999 or not 1 <= item_id <= 20000 or not name:
            raise RuntimeError("Invalid item: id=%s name=%s qty=%s" %(item_id,name,quantity))
        previous = prior.get(item_id,{})
        title = previous.get("wikiTitle") or name
        if a is not None:
            target = urlparse(a["href"])
            if target.path.startswith("/wiki/"):
                title = unquote(target.path.split("/wiki/",1)[1]).replace("_"," ")
        entry = {"id":item_id,"en":name,"qty":quantity,"wikiTitle":title}
        if previous.get("key"):
            entry["key"] = previous["key"]
        if previous.get("pt"):
            entry["pt"] = previous["pt"]
        if previous.get("es"):
            entry["es"] = previous["es"]
        rows.append(entry)
    ids = [item["id"] for item in rows]
    if len(ids)!=len(set(ids)) or len(ids)<6000 or max(ids)<6100:
        raise RuntimeError("Suspicious catalog: %s entries; highest ID %s" %(len(ids),max(ids,default=0)))
    rows.sort(key=lambda item:item["id"])
    output = {
      "version":"official-journey-research-list",
      "source":"https://terraria.wiki.gg/wiki/Journey_Mode/Research_list",
      "revision":parsed.get("revid"),
      "updated":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
      "count":len(rows),
      "unresearchableExcluded":len(unavailable),
      "items":rows,
    }
    FILE.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("Updated official Journey catalog:",len(rows),"researchable items;",len(unavailable),"not researchable; max ID",max(ids))
if __name__=="__main__":
    build()
