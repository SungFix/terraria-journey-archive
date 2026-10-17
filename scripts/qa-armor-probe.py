"""Inspect redirects and HTML structure of armor items from the official Wiki."""
import json
import re
import urllib.parse
import urllib.request
from bs4 import BeautifulSoup

def fetch(path, query):
    url = "https://terraria.wiki.gg" + path + "?" + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={"User-Agent": "JourneyArchiveArmorQA/1.0"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return json.load(response)

cases = [
    ("en", "Molten Helmet", 231),
    ("pt", "Elmo Derretido", 231),
    ("en", "Molten Breastplate", 232),
    ("en", "Molten Greaves", 233),
    ("en", "Copper Helmet", 89),
    ("en", "Hallowed Helmet", 553),
    ("en", "Solar Flare Helmet", 2763),
    ("en", "Nebula Helmet", 2760),
    ("en", "Iron Pickaxe", 1),
]
for lang, name, item_id in cases:
    try:
        path = ("/pt" if lang == "pt" else "") + "/api.php"
        data = fetch(path, {"action": "parse", "page": name,
                            "prop": "text|displaytitle|sections",
                            "redirects": 1, "format": "json"})
        parsed = data.get("parse", {})
        markup = parsed.get("text", {}).get("*", "")
        soup = BeautifulSoup(markup, "html.parser")
        root = soup.select_one(".mw-parser-output") or soup
        print("\nCASE", lang, name, item_id, "TITLE", parsed.get("title"),
              "HTML", len(markup), "ERROR", data.get("error"))
        print("HEADINGS", [(el.name, el.get("id"), el.get_text(" ", strip=True)[:70])
                           for el in root.find_all(re.compile("^h[2-5]$"))[:14]])
        print("TOP_CHILDREN", [(el.name, el.get("class"), el.get("id"),
                               el.get_text(" ", strip=True)[:80])
                              for el in root.find_all(recursive=False)[:22]])
        print("SECTIONS", [(section.get("line"), section.get("anchor"))
                           for section in parsed.get("sections", [])[:14]])
        for el in root.select('.infobox, .section, [class*="infobox"]'):
            txt = el.get_text(" ", strip=True)
            if len(txt) < 1000 and any(term in txt for term in
                  [name, "Molten Helmet", "Elmo Derretido"]):
                print("BLOCK", el.name, el.get("class"), el.get("id"),
                      repr(txt[:170]), "IMG",
                      [(im.get("alt"), im.get("src")) for im in el.select("img")[:2]])
                if name == "Molten Helmet" and lang == "en":
                    print("BLOCK_PARENT",
                          [(a.name, a.get("class"), a.get("id")) for a in
                           list(el.parents)[:4]])
        print("MATCHED_IMAGES", [(im.get("alt"), im.get("src")) for im in root.select("img")
                                  if name.lower() in
                                  ((im.get("alt") or "") + (im.get("src") or "")).lower()][:8])
    except Exception as e:
        print("ERROR", lang, name, type(e).__name__, str(e)[:190])

for title in ["File:Molten Helmet.png", "File:Molten armor.png",
              "File:Item_231.png", "File:Copper Helmet.png",
              "File:Solar Flare Helmet.png"]:
    try:
        data = fetch("/api.php", {"action": "query", "titles": title,
                                  "prop": "imageinfo", "iiprop": "url|size",
                                  "format": "json"})
        page = next(iter(data["query"]["pages"].values()))
        print("IMAGEFILE", title, "exists", "missing" not in page,
              "INFO", page.get("imageinfo", [{}])[0].get("url", "N/A"))
    except Exception as e:
        print("IMAGEFAIL", title, type(e).__name__, str(e)[:120])
