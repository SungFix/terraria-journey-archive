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
    const pass = !errors.length && !low.length && audit.overflow<=6 && audit.renderedText>150;
    results.push({name,width,passed:pass,cells:audit.totalCells,lowContrast:low.slice(0,5),
      overflow:audit.overflow,offenders:audit.overflow>6?audit.offenders:[],errors:errors.slice(0,3)});
    if(!pass)failures.push(name+' ('+width+'px): '+JSON.stringify(results.at(-1)));
    if(name==='Iron Pickaxe'||name==='Zenith'){
      await page.screenshot({path:'/tmp/terraria-contrast-qa/'+name.replaceAll(' ','-')+'-'+width+'.png'});
    }
  } catch(e) {failures.push(name+' '+width+': '+String(e).slice(0,500))}
  finally{await page.close()}
 }
}
await browser.close();
console.log(JSON.stringify({audited:results.length,results,failures},null,2));
if(failures.length)process.exitCode=1;
