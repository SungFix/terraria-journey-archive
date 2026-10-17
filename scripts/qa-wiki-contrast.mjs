// Regression audit for all item categories, using genuine Terraria Wiki
// article HTML as test fixtures and verifying browser-computed contrast.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = 'http://127.0.0.1:8765';
const catalog = JSON.parse(fs.readFileSync('data/catalog-base.json', 'utf8')).items;
const byName = new Map(catalog.map(item => [item.en.toLowerCase(), item]));
const cases = [
  ['Iron Pickaxe', 'pt'],
  ['Dirt Block', 'en'],
  ['Zenith', 'en'],
  ['Hermes Boots', 'en'],
  ['Ironskin Potion', 'en'],
  ['Terra Blade', 'en'],
];
const screens = [1440, 390];
fs.mkdirSync('/tmp/terraria-contrast-qa', { recursive: true });

function sampleColors(rgbString) {
 const v = (rgbString.match(/[\d.]+/g) || []).map(Number);
 return v.length >= 3 ? v.slice(0, 3) : [0,0,0];
}
function luminance(color) {
 const arr = sampleColors(color).map(v => {
   const c = v / 255;
   return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
 });
 return .2126 * arr[0] + .7152 * arr[1] + .0722 * arr[2];
}
function ratio(front,back) {
 const [a,b] = [luminance(front),luminance(back)].sort((x,y)=>y-x);
 return (a+.05)/(b+.05);
}
const browser = await chromium.launch({ headless:true });
const failures=[];
const results=[];
for (const [name,lang] of cases) {
 const item = byName.get(name.toLowerCase());
 if (!item) {failures.push('Catalog has no '+name);continue}
 for (const width of screens) {
  const page = await browser.newPage({ viewport:{width,height:880} });
  const errors=[];
  page.on('pageerror', err => errors.push(err.message));
  await page.route('**/*', async route => {
    const url=route.request().url();
    if (url.startsWith(base))return route.continue();
    if (url.includes('terraria.wiki.gg')&&url.includes('/api.php?')) {
      const address = new URL(url);
      const locale = address.pathname.startsWith('/pt/')?'pt':address.pathname.startsWith('/es/')?'es':'en';
      const source = path.resolve('tests/wiki-article-fixtures/'+(locale==='pt'?'Iron_Pickaxe_pt':name.replaceAll(' ','_')+'_en')+'.html');
      if (!fs.existsSync(source)) {
        return route.fulfill({status:200,contentType:'application/json',
          headers:{'access-control-allow-origin':'*'},
          body:JSON.stringify({error:{code:'missingtitle',info:'Not available in this language'}})});
      }
      return route.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},
        body:JSON.stringify({parse:{title:name,revid:1,text:{'*':fs.readFileSync(source,'utf8')}}})});
    }
    return route.abort();
  });
  await page.addInitScript(({lang}) => {
     localStorage.setItem('journey-archive-lang-v1',lang);
     localStorage.setItem('journey-archive-article-lang-v1',lang);
  },{lang});
  try {
    await page.goto(base+'/?item='+item.id,{waitUntil:'domcontentloaded',timeout:25000});
    await page.locator('.wiki-article-layout').waitFor({state:'visible',timeout:15000});
    const audit=await page.evaluate(()=>{
      const cells=[...document.querySelectorAll('#wikiContent table :is(td,th)')]
         .filter(x=>x.getClientRects().length && x.textContent.trim().length>0);
      const sample=cells.slice(0,140).map(cell=>{
        const cs=getComputedStyle(cell);
        const row=getComputedStyle(cell.closest('tr')||cell);
        return {text:cell.textContent.trim().slice(0,20),
           fore:cs.color,back:cs.backgroundColor,
           rowBg:row.backgroundColor,
           className:cell.closest('.wiki-aside')?'side':'main'};
      });
      return {totalCells:cells.length,
        backgrounds:sample,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        renderedText:document.querySelector('#wikiContent')?.innerText?.length||0,
        itemSeparators:(()=>{
          const refs=[...document.querySelectorAll('#wikiContent span.i')].filter(i=>{
            const head=i.firstElementChild;
            const later=[...i.children].slice(1);
            return head?.tagName==='A'&&!!head.querySelector('img')
              &&later.some(el=>el.tagName==='SPAN'
                 &&!el.classList.contains('wiki-item-separator')&&!!el.textContent.trim());
          });
          return {eligible:refs.length,missing:refs.filter(i=>
            !i.children[1]?.classList.contains('wiki-item-separator')).length};
        })(),
        itemAmounts:(()=>{
          const amounts=[...document.querySelectorAll('#wikiContent span.i + span.am')]
            .filter(el=>el.previousElementSibling?.querySelector('img'));
          const sample=amounts.map(el=>{
            const r=el.getBoundingClientRect(),itemRect=el.previousElementSibling.getBoundingClientRect();
            const sameLine=Math.abs(r.top-itemRect.top)<20;
            return {
              label:el.previousElementSibling.textContent.trim().slice(0,35),
              amount:el.textContent.trim(),
              marked:el.classList.contains('journey-item-quantity'),
              gap:sameLine?Math.round(r.left-itemRect.right):null
            };
          });
          return {
            found:amounts.length,
            unformatted:sample.filter(e=>!e.marked||!e.amount.startsWith('× ')).length,
            cramped:sample.filter(e=>e.gap!==null&&e.gap<5).length,
            example:sample.slice(0,8)
          };
        })(),
        threeDSLogos:[...document.querySelectorAll('#wikiContent img')].filter(img=>{
          const src=img.getAttribute('src')||'',alt=img.getAttribute('alt')||'';
          return /(?:^|\/)(?:3ds|nintendo[_ -]?3ds)(?:[_ -]?(?:logo|icon))?\.(?:svg|png|webp|gif)(?:[?#/]|$)/i.test(src)
            || /^(?:vers[aã]o para )?(?:nintendo\s+)?3ds$/i.test(alt);
        }).map(img=>({src:img.src,alt:img.alt})),
        treeChain:(()=>{
          const t=document.querySelector('.crafting-tree table.diagram');
          const out=[];let el=t;
          while(el&&out.length<14){
            const r=el.getBoundingClientRect(),c=getComputedStyle(el);
            out.push({tag:el.tagName,cls:String(el.className).slice(0,55),width:Math.round(r.width),
              clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,overflow:c.overflowX,
              contain:c.contain,display:c.display});
            el=el.parentElement;
          }
          return out;
        })(),
        offenders:[...document.querySelectorAll('body *')].filter(el=>{
          const c=getComputedStyle(el),r=el.getBoundingClientRect();
          return c.display!=='none'&&c.visibility!=='hidden'&&r.right>innerWidth+15&&r.width>20;
        }).sort((a,b)=>b.getBoundingClientRect().right-a.getBoundingClientRect().right).slice(0,15).map(el=>{
          const r=el.getBoundingClientRect(),c=getComputedStyle(el);
          return {node:el.tagName,cls:String(el.className).slice(0,70),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),
            css:{position:c.position,display:c.display,overflow:c.overflow,width:c.width,maxWidth:c.maxWidth},txt:el.textContent.trim().slice(0,70)};
        })};
    });
    const low=[];
    for(const cell of audit.backgrounds) {
      const background=cell.back==='rgba(0, 0, 0, 0)'?cell.rowBg:cell.back;
      const score=ratio(cell.fore,background);
      if(score<4.5)low.push({text:cell.text,color:cell.fore,bg:background,score:+score.toFixed(1)});
      if(['rgb(248, 243, 232)','rgb(244, 238, 226)','rgb(250, 245, 235)'].includes(background))
        low.push({text:cell.text,problem:'light background returned'});
    }
    const pass = !errors.length && !low.length && !audit.threeDSLogos.length && audit.itemSeparators.missing===0 && audit.itemAmounts.unformatted===0 && audit.itemAmounts.cramped===0 && (name!=='Iron Pickaxe'||audit.itemAmounts.found>=2) && audit.overflow<=6 && audit.renderedText>150;
    results.push({name,width,passed:pass,cells:audit.totalCells,lowContrast:low.slice(0,5),itemSeparators:audit.itemSeparators,itemAmounts:audit.itemAmounts,
      overflow:audit.overflow,threeDSLogos:audit.threeDSLogos,treeChain:audit.overflow>6?audit.treeChain:[],offenders:audit.overflow>6?audit.offenders:[],errors:errors.slice(0,3)});
    if(!pass)failures.push(name+' ('+width+'px): '+JSON.stringify(results.at(-1)));
    if(name==='Iron Pickaxe'||name==='Zenith'){
      await page.screenshot({path:'/tmp/terraria-contrast-qa/'+name.replaceAll(' ','-')+'-'+width+'.png'});
    }
  } catch(e) {failures.push(name+' '+width+': '+String(e).slice(0,500))}
  finally{await page.close()}
 }
}
// The catalog must also separate icon and name in every visible card.
const catalogPage=await browser.newPage({viewport:{width:390,height:850}});
try{
 await catalogPage.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
 await catalogPage.locator('.item-card').first().waitFor({state:'visible',timeout:15000});
 const cardAudit=await catalogPage.evaluate(()=>{
   const cards=[...document.querySelectorAll('.item-card')];
   const missing=cards.filter(card=>{
     const children=[...card.querySelector('.item-open')?.children||[]];
     return !(children.length===3 && children[1].classList.contains('item-separator')
       && children[1].textContent.trim()==='•' && children[2].classList.contains('item-info'));
   });
   return {cards:cards.length,missing:missing.length};
 });
 results.push({name:'Catalog icons and item names',width:390,passed:cardAudit.cards>=50&&cardAudit.missing===0,
   itemSeparators:cardAudit});
 if(cardAudit.cards<50||cardAudit.missing)failures.push('Catalog separator layout: '+JSON.stringify(cardAudit));
}catch(e){failures.push('Catalog: '+String(e).slice(0,400))}
finally{await catalogPage.close()}
await browser.close();
console.log(JSON.stringify({audited:results.length,results,failures},null,2));
if(failures.length)process.exitCode=1;
