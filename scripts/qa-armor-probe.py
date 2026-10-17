"""Inspect real Terraria Wiki item redirects and armor piece structure."""
import urllib.parse, urllib.request, json, re
from bs4 import BeautifulSoup
BASE='https://terraria.wiki.gg'
def fetch(path,query):
    url=BASE+path+'?'+urllib.parse.urlencode(query)
    req=urllib.request.Request(url,headers={'User-Agent':'JourneyArchive-Armor-QA/1.0 (SungFix/terraria-journey-archive)'})
    with urllib.request.urlopen(req,timeout=45) as r:return json.load(r)

cases=[
 ('en','Molten Helmet',231),('pt','Elmo Derretido',231),
 ('en','Molten Breastplate',232),('en','Molten Greaves',233),
 ('en','Copper Helmet',89),('en','Hallowed Helmet',553),
 ('en','Solar Flare Helmet',2763),('en','Nebula Helmet',2760),
 ('en','Iron Pickaxe',1)
]
for lang,name,item_id in cases:
 try:
    p=('/pt' if lang=='pt' else '')+'/api.php'
    d=fetch(p,{'action':'parse','page':name,'prop':'text|displaytitle|sections','redirects':1,'format':'json'})
    parsed=d.get('parse',{});html=parsed.get('text',{}).get('*','')
    soup=BeautifulSoup(html,'html.parser')
    print('\n=== CASE',lang,name,'ID',item_id,'TITLE',parsed.get('title'),'HTML',len(html),'ERROR',d.get('error'),'===')
    print('top heading/infobox:',[(x.name,x.get('class'),(x.get_text(' ',strip=True)[:90])) for x in soup.select('.mw-parser-output > .infobox, .mw-parser-output > h2, .mw-parser-output > h3')][:18])
    print('piece mentions',len(soup.find_all(string=re.compile(re.escape(name),re.I))))
    print('heading IDs',[(x.name,x.get('id'),x.get_text(' ',strip=True)[:70]) for x in soup.find_all(re.compile('^h[2-5]
    for el in soup.select('[class*="infobox"], [id*="Molten"], [id*="molten"], [class*="item"]')[:16]:
       if el.name not in ('div','section','span','table','li'):continue
       txt=el.get_text(' ',strip=True)
       if any(x in txt for x in [name.split()[0],'Defense','Defesa']):
        print(' DOM',el.name,el.get('class'),el.get('id'),'HEAD',txt[:160],'IMG',[(im.get('alt'),im.get('src')) for im in el.select('img')[:2]])
    print('Images relevant',[(im.get('alt'),im.get('src')) for im in soup.select('img') if any(word in (str(im.get('alt'))+' '+str(im.get('src'))).lower() for word in [name.lower().replace(' ','_'),name.lower()])][:8])
    print('Sections',[(sec.get('line'),sec.get('anchor')) for sec in parsed.get('sections',[])[:15]])
 except Exception as e: print('ERROR',type(e).__name__,str(e)[:220])
for title in ['File:Molten Helmet.png','File:Molten_armor.png','File:Item_231.png','File:Copper Helmet.png','File:Solar Flare Helmet.png']:
 try:
  d=fetch('/api.php',{'action':'query','titles':title,'prop':'imageinfo','iiprop':'url|size','format':'json'})
  page=list(d['query']['pages'].values())[0]
  print('IMAGEFILE',title,'MISSING' in str(page.get('missing')),'info',page.get('imageinfo',[{}])[0].get('url','N/A'))
 except Exception as e: print('IMAGEFAIL',title,repr(e))
))[:15]])
    for el in soup.select('[class*="infobox"], [id*="Molten"], [id*="molten"], [class*="item"]')[:16]:
       if el.name not in ('div','section','span','table','li'):continue
       txt=el.get_text(' ',strip=True)
       if any(x in txt for x in [name.split()[0],'Defense','Defesa']):
        print(' DOM',el.name,el.get('class'),el.get('id'),'HEAD',txt[:160],'IMG',[(im.get('alt'),im.get('src')) for im in el.select('img')[:2]])
    print('Images relevant',[(im.get('alt'),im.get('src')) for im in soup.select('img') if any(word in (str(im.get('alt'))+' '+str(im.get('src'))).lower() for word in [name.lower().replace(' ','_'),name.lower()])][:8])
    print('Sections',[(sec.get('line'),sec.get('anchor')) for sec in parsed.get('sections',[])[:15]])
 except Exception as e: print('ERROR',type(e).__name__,str(e)[:220])
for title in ['File:Molten Helmet.png','File:Molten_armor.png','File:Item_231.png','File:Copper Helmet.png','File:Solar Flare Helmet.png']:
 try:
  d=fetch('/api.php',{'action':'query','titles':title,'prop':'imageinfo','iiprop':'url|size','format':'json'})
  page=list(d['query']['pages'].values())[0]
  print('IMAGEFILE',title,'MISSING' in str(page.get('missing')),'info',page.get('imageinfo',[{}])[0].get('url','N/A'))
 except Exception as e: print('IMAGEFAIL',title,repr(e))
