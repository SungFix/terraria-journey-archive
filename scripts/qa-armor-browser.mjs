import { chromium } from 'playwright';
import fs from 'node:fs';
const base='http://127.0.0.1:8765';
const fixtureDir='tests/armor-api-fixtures';
const cases=[
  {id:231,name:'Molten Helmet',locale:'en',title:'Molten Helmet',file:'Molten_Helmet'},
  {id:231,name:'Molten Helmet',locale:'pt',title:'Elmo Derretido',file:'Molten_Helmet'},
  {id:232,name:'Molten Breastplate',locale:'en',title:'Molten Breastplate',file:'Molten_Breastplate'},
  {id:233,name:'Molten Greaves',locale:'en',title:'Molten Greaves',file:'Molten_Greaves'},
  {id:89,name:'Copper Helmet',locale:'en',title:'Copper Helmet',file:'Copper_Helmet'},
  {id:553,name:'Hallowed Helmet',locale:'en',title:'Hallowed Helmet',file:'Hallowed_Helmet'},
  {id:2763,name:'Solar Flare Helmet',locale:'en',title:'Solar Flare Helmet',file:'Solar_Flare_Helmet'},
  {id:2760,name:'Nebula Helmet',locale:'en',title:'Nebula Helmet',file:'Nebula_Helmet'}
];
const transparent='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9xSqUAAAAASUVORK5CYII=';
const browser=await chromium.launch({headless:true});
const failures=[],results=[];
for(const tc of cases){
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.addInitScript(({lang})=>{
    localStorage.setItem('journey-archive-lang-v1',lang);
    localStorage.setItem('journey-archive-article-lang-v1',lang);
  },{lang:tc.locale});
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(base))return route.continue();
    if(url.includes('/api.php?')&&url.includes('terraria.wiki.gg')){
      const api=new URL(url);const locale=api.pathname.startsWith('/pt/')?'pt':'en';
      const name=(api.searchParams.get('page')||'').replaceAll('_',' ');
      const routeName=locale==='pt'&&['Elmo Derretido','Molten Helmet'].includes(name)?'Molten_Helmet':name.replaceAll(' ','_');
      const filepath=fixtureDir+'/'+locale+'_'+routeName+'.json';
      if(fs.existsSync(filepath))
        return route.fulfill({status:200,contentType:'application/json',
          headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(filepath,'utf8')});
      return route.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},
        body:JSON.stringify({error:{code:'missingtitle',info:'No fixture for '+name}})});
    }
    if(/\.(png|webp|gif|svg)(?:[?#]|$)/i.test(url)||url.includes('/images/'))
      return route.fulfill({status:200,contentType:'image/png',
        headers:{'access-control-allow-origin':'*'},body:Buffer.from(transparent,'base64')});
    return route.abort();
  });
  try{
    await page.goto(base+'/?item='+tc.id,{waitUntil:'domcontentloaded',timeout:25000});
    await page.locator('.journey-exact-armor-piece').waitFor({timeout:17000});
    const result=await page.evaluate(()=>{
      const main=document.querySelector('#wikiContent'),box=document.querySelector('.journey-exact-armor-piece');
      const title=box?.querySelector('.title')?.textContent?.trim()||'';
      const row=box?.querySelector('.ids, .section.ids')?.textContent?.trim()||'';
      const icon=document.querySelector('#detailSprite img.sprite')?.src||'';
      const long=main?.textContent?.length||0;
      const other=document.querySelector('.journey-other-armor-pieces');
      return {title,row,icon,long,otherCollapsed:!other||!other.open,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        loaderVisible:!document.querySelector('#articleLoader')?.hidden,
        article:document.querySelector('#articleFrame')?.hidden===false};
    });
    const expectedFile=tc.file+'.png';
    const checks={
      selected:result.title.toLowerCase()===tc.title.toLowerCase(),
      correctId:new RegExp('(?:^|\\D)'+tc.id+'(?:\\D|$)').test(result.row),
      correctSprite:decodeURIComponent(result.icon).includes(expectedFile),
      readable:result.long>300,
      articleOpen:result.article&&!result.loaderVisible,
      noOverflow:result.overflow<=8,
      extrasHidden:result.otherCollapsed,
      noJS:errors.length===0,
      spriteSourceIsWiki:result.icon.startsWith('https://terraria.wiki.gg/images/')
    };
    const passed=Object.values(checks).every(Boolean);
    results.push({name:tc.name,locale:tc.locale,width,passed,checks,details:result,errors});
    if(!passed)failures.push(tc.name+' '+tc.locale+' '+width+': '+JSON.stringify({checks,details:result,errors}));
    if(tc.id===231&&width===390)await page.screenshot({path:'/tmp/armor-qa-'+tc.locale+'.png',fullPage:true});
  }catch(e){failures.push(tc.name+' '+tc.locale+' '+width+': '+String(e).slice(0,400))}
  finally{await page.close()}
 }
}
await browser.close();
console.log(JSON.stringify({audited:results.length,results,failures},null,2));
if(failures.length)process.exitCode=1;
