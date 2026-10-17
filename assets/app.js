'use strict';
/* Journey Archive: one simple list, full Wiki articles shown inside this page.
   The Windows sync protocol and old localStorage keys remain unchanged. */

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const keyName=s=>normal(s).replace(/[^a-z0-9]/g,'');
const safeNum=n=>Number.isFinite(Number(n))?Number(n):0;
const LANGS={pt:'pt-BR',en:'en-US',es:'es-ES'};
const TEXT={
 pt:{title:'Itens do Modo Jornada',eyebrow:'✦ SUA COLEÇÃO',search:'Pesquisar um item pelo nome ou ID…',all:'Todos',pending:'Faltando',done:'Pesquisados',categories:['Todas as categorias','Armas','Ferramentas','Armaduras','Acessórios','Blocos e paredes','Poções','Materiais','Móveis','Outros'],progress:'itens pesquisados',of:'de',items:'itens',results:'itens encontrados',empty:'Nenhum item encontrado.',more:'Carregar mais',syncLive:'Sincronizado',syncOff:'Sem conexão com o aplicativo',syncWait:'Aguardando save',saved:'Progresso salvo',need:'Pesquisa necessária',count:'entregues',return:'Voltar aos itens',marked:'Pesquisado',notMarked:'Marcar pesquisado',unmark:'Desmarcar pesquisado',fromSave:'Pesquisado no personagem',researchLabel:'Pesquisa para duplicação',researchHint:'Progresso detectado no personagem ou marcado manualmente.',article:'Informações da Terraria Wiki',articleLoading:'Carregando informações completas, receitas e tabelas...',articleFail:'Não foi possível carregar o artigo completo da wiki agora.',articleRetry:'Tentar novamente',articleEnglish:'Artigo em inglês (tradução ainda indisponível)',articlePt:'Artigo em português',articleEs:'Artigo em espanhol',offline:'As informações completas dependem da conexão com a Terraria Wiki. Seu progresso continua funcionando normalmente.',source:'Artigo original e histórico de autores',license:'Texto disponibilizado sob CC BY-NC-SA 4.0; imagens podem ter licença própria.',catalogSource:'Lista de pesquisas atualizada pela wiki oficial',catalogFallback:'Base local histórica; pode faltar conteúdo da versão atual',export:'Progresso exportado',import:'Progresso importado',badImport:'Arquivo de progresso inválido',options:'Opções e backup',cat:'Categoria',generic:'Artigo',toastDone:'Item pesquisado',toastUndone:'Item desmarcado',itemId:'ID do item',privacy:'O save do personagem não é enviado ao site.',footer:'Projeto de fã não oficial. Terraria e seus sprites pertencem à Re-Logic.'},
 en:{title:'Journey Mode Items',eyebrow:'✦ YOUR COLLECTION',search:'Search by item name or ID…',all:'All',pending:'Missing',done:'Researched',categories:['All categories','Weapons','Tools','Armor','Accessories','Blocks & walls','Potions','Materials','Furniture','Other'],progress:'items researched',of:'of',items:'items',results:'matching items',empty:'No items found.',more:'Load more',syncLive:'Synced',syncOff:'Companion app disconnected',syncWait:'Waiting for save',saved:'Progress saved',need:'Research required',count:'submitted',return:'Back to items',marked:'Researched',notMarked:'Mark researched',unmark:'Unmark researched',fromSave:'Researched in your character',researchLabel:'Duplication research',researchHint:'Progress is synchronized with your save or marked manually.',article:'Terraria Wiki information',articleLoading:'Loading full article, recipes and tables...',articleFail:'Unable to load the complete Wiki article right now.',articleRetry:'Retry',articleEnglish:'Article in English',articlePt:'Article in Portuguese',articleEs:'Article in Spanish',offline:'Full details need a connection to Terraria Wiki. Your tracking still works.',source:'Original article and contributors',license:'Text under CC BY-NC-SA 4.0; images may have separate licenses.',catalogSource:'Research list updated from the official wiki',catalogFallback:'Historical local data; new game items may be absent',export:'Progress exported',import:'Progress imported',badImport:'Invalid progress file',options:'Options and backup',cat:'Category',generic:'Article',toastDone:'Item researched',toastUndone:'Item unmarked',itemId:'Item ID',privacy:'Character saves are never uploaded.',footer:'Unofficial fan project. Terraria and its sprites belong to Re-Logic.'},
 es:{title:'Objetos del Modo Viaje',eyebrow:'✦ TU COLECCIÓN',search:'Buscar por nombre o ID…',all:'Todos',pending:'Pendientes',done:'Investigados',categories:['Todas las categorías','Armas','Herramientas','Armaduras','Accesorios','Bloques y paredes','Pociones','Materiales','Muebles','Otros'],progress:'objetos investigados',of:'de',items:'objetos',results:'objetos encontrados',empty:'No se encontraron objetos.',more:'Mostrar más',syncLive:'Sincronizado',syncOff:'Programa desconectado',syncWait:'Esperando partida',saved:'Progreso guardado',need:'Investigación necesaria',count:'entregados',return:'Volver a los objetos',marked:'Investigado',notMarked:'Marcar investigado',unmark:'Desmarcar investigado',fromSave:'Investigado en el personaje',researchLabel:'Investigación para duplicar',researchHint:'Progreso del personaje o marcado manualmente.',article:'Información de Terraria Wiki',articleLoading:'Cargando artículo completo, recetas y tablas...',articleFail:'No se puede cargar el artículo completo ahora.',articleRetry:'Reintentar',articleEnglish:'Artículo en inglés (traducción no disponible)',articlePt:'Artículo en portugués',articleEs:'Artículo en español',offline:'La información completa requiere conexión a Terraria Wiki. Tu progreso sigue disponible.',source:'Artículo original y autores',license:'Texto bajo CC BY-NC-SA 4.0; imágenes pueden tener licencias diferentes.',catalogSource:'Lista de investigación actualizada de la wiki oficial',catalogFallback:'Datos históricos; pueden faltar novedades',export:'Progreso exportado',import:'Progreso importado',badImport:'Archivo de progreso inválido',options:'Opciones y copia de seguridad',cat:'Categoría',generic:'Artículo',toastDone:'Objeto investigado',toastUndone:'Objeto desmarcado',itemId:'ID de objeto',privacy:'El archivo del personaje nunca se sube.',footer:'Proyecto no oficial. Terraria y sus sprites pertenecen a Re-Logic.'}
};
const CAT_KEYS=['all','weapons','tools','armor','accessories','blocks','potions','materials','furniture','other'];
const COMMON_ES={1:'Pico de hierro',2:'Bloque de tierra',3:'Bloque de piedra',8:'Antorcha',9:'Madera',23:'Gel',29:'Cristal de vida',50:'Espejo mágico',54:'Botas de Hermes'};
const S={language:'pt',items:[],byId:new Map(),byTitle:new Map(),catalogOK:false,manual:new Set(),sync:{countsById:{},unknownByKey:{}},unknownIndex:new Map(),connected:false,syncWaiting:false,syncPlayer:'',filter:'all',category:'all',query:'',shown:80,view:'list',currentItem:null,currentTitle:'',currentLocale:'en',scrollY:0,fetchController:null,articleCache:new Map(),articleURL:'',wikiLoaded:false,debounce:null};

const tr=k=>TEXT[S.language][k]||TEXT.pt[k]||k;
const fmt=n=>safeNum(n).toLocaleString(LANGS[S.language]);
function safeJSON(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.warn('Storage unavailable:',k)}}
function loadSaved(){
 const marked=safeJSON('journey-archive-marked-v1');
 if(Array.isArray(marked))S.manual=new Set(marked.map(Number).filter(v=>Number.isInteger(v)&&v>0&&v<20000));
 const sync=safeJSON('journey-archive-auto-sync-v1');
 if(sync?.protocol===1&&sync.countsById&&typeof sync.countsById==='object')S.sync=sync;
 S.unknownIndex=new Map(Object.entries(S.sync.unknownByKey||{}).map(([k,v])=>[keyName(k.split(':').pop()),safeNum(v)]));
 try{const lng=localStorage.getItem('journey-archive-lang-v1');if(LANGS[lng])S.language=lng}catch(e){}
}
function setLanguage(next){
 if(!LANGS[next])return;
 S.language=next;
 try{localStorage.setItem('journey-archive-lang-v1',next)}catch(e){}
 translateStatic();
 if(S.view==='list'){S.shown=80;renderList()}
 else if(S.currentItem)showItemHeader(S.currentItem);
 else renderGenericHeader(S.currentTitle);
 if(S.view==='article')loadArticle(S.currentItem,S.currentTitle);
}
function nameOf(item){
 if(S.language==='pt')return item.pt||item.en;
 if(S.language==='es')return item.es||COMMON_ES[item.id]||item.en;
 return item.en;
}
function classify(item){
 const n=item.en||'';
 if(/\b(Potion|Flask|Elixir)\b/i.test(n))return'potions';
 if(/\b(Wall|Block|Brick|Platform|Dirt|Sand|Stone|Slab|Pillar|Ore Block)\b/i.test(n))return'blocks';
 if(/\b(Helmet|Mask|Hood|Breastplate|Greaves|Leggings|Chestplate|Robe|Platemail|Mail)\b/i.test(n))return'armor';
 if(/\b(Pickaxe|Axe|Hammer|Drill|Chainsaw|Hamaxe|Fishing Pole|Rod)\b/i.test(n))return'tools';
 if(/\b(Sword|Bow|Gun|Yoyo|Whip|Spear|Boomerang|Blade|Dagger|Launcher|Flail|Blaster|Staff|Cannon)\b/i.test(n))return'weapons';
 if(/\b(Boots|Wings|Necklace|Emblem|Charm|Ring|Glove|Shield|Band|Horseshoe|Quiver|Scarf|Balloon)\b/i.test(n))return'accessories';
 if(/\b(Chair|Table|Work Bench|Furnace|Anvil|Door|Chest|Bed|Lantern|Lamp|Chandelier|Bookcase|Dresser|Bathtub|Sink|Sofa|Toilet|Clock)\b/i.test(n))return'furniture';
 if(/\b(Ore|Bar|Gel|Lens|Soul|Seed|Fang|Scale|Feather|Shard|Essence|Crystal|Tissue|Silk|Cobweb|Leather|Wood)\b/i.test(n))return'materials';
 return'other';
}
function indexItems(){
 S.byId=new Map(S.items.map(it=>[it.id,it]));
 S.byTitle=new Map();
 for(const item of S.items){
  for(const n of [item.wikiTitle,item.en,item.pt,item.es])if(n)S.byTitle.set(keyName(n),item);
 }
}
function getSubmitted(item){
 let n=S.sync?.countsById?.[item.id];
 if(Number.isFinite(Number(n))&&Number(n)>=0&&n!==undefined)return Number(n);
 for(const id of [item.key,item.en,item.wikiTitle]){
  if(id){const saved=S.unknownIndex.get(keyName(id));if(Number.isFinite(saved))return saved}
 }
 return 0;
}
function autoDone(item){return getSubmitted(item)>=item.qty}
function isDone(item){return S.manual.has(item.id)||autoDone(item)}
function totals(){const done=S.items.reduce((n,item)=>n+(isDone(item)?1:0),0);return{done,total:S.items.length,percent:S.items.length?Math.round(done/S.items.length*100):0}}
function spriteURL(item,attempt){
 const filename=encodeURIComponent(String(item.wikiTitle||item.en).replace(/ /g,'_')+'.png');
 return attempt===0
  ?'https://raw.githubusercontent.com/natan-dot-com/Terraria-Dataset/master/img_sprites/'+filename
  :'https://terraria.wiki.gg/wiki/Special:Redirect/file/'+filename;
}
function makeSprite(item){
 const wrap=document.createElement('div');wrap.className='sprite-wrap';
 const img=document.createElement('img');img.className='sprite';img.loading='lazy';img.decoding='async';img.alt=nameOf(item);img.dataset.sprite=String(item.id);img.dataset.try='0';img.src=spriteURL(item,0);
 const fallback=document.createElement('span');fallback.className='sprite-fallback';fallback.hidden=true;fallback.textContent='◆';
 img.addEventListener('error',()=>{if(img.dataset.try==='0'){img.dataset.try='1';img.src=spriteURL(item,1)}else{img.hidden=true;fallback.hidden=false}});
 wrap.append(img,fallback);return wrap;
}
function updateProgress(){
 const o=totals();
 $('#progressLabel').textContent=fmt(o.done)+' '+tr('of')+' '+fmt(o.total)+' '+tr('progress');
 $('#percent').textContent=o.percent+'%';$('#progressFill').style.width=o.percent+'%';
 $('#progressBar').setAttribute('aria-valuenow',String(o.percent));
}
function updateStatus(){
 const el=$('#syncPill');el.classList.remove('live','wait');
 if(S.connected){el.classList.add(S.syncWaiting?'wait':'live')}
 $('#syncText').textContent=S.connected
  ?(S.syncWaiting?tr('syncWait'):tr('syncLive')+(S.syncPlayer?' · '+S.syncPlayer:''))
  :(Object.keys(S.sync.countsById||{}).length?tr('saved'):tr('syncOff'));
}
function updateCards(){
 for(const card of $$('.item-card')){
  const item=S.byId.get(Number(card.dataset.id));if(!item)continue;
  const checked=isDone(item);card.classList.toggle('complete',checked);
  const button=card.querySelector('.mark');button.setAttribute('aria-pressed',String(checked));button.title=autoDone(item)?tr('fromSave'):(checked?tr('unmark'):tr('notMarked'));button.disabled=autoDone(item);
 }
 updateProgress();
 if(S.currentItem)showResearchBar(S.currentItem);
}
function cardFor(item){
 const card=document.createElement('div');card.className='item-card';card.dataset.id=String(item.id);
 const link=document.createElement('a');link.href='?item='+item.id;link.className='item-open';
 link.setAttribute('aria-label',nameOf(item)+' — '+tr('article'));
 const image=document.createElement('span');image.className='sprite-box';image.append(...makeSprite(item).childNodes);
 const description=document.createElement('span');description.className='item-info';
 const name=document.createElement('strong');name.className='item-name';name.textContent=nameOf(item);
 const tiny=document.createElement('small');tiny.className='item-id';tiny.textContent='ID '+item.id;
 description.append(name,tiny);link.append(image,description);
 const footer=document.createElement('div');footer.className='item-footer';
 const q=document.createElement('span');q.className='qty';q.innerHTML='<strong>'+fmt(item.qty)+'×</strong> '+escapeHtml(tr('need'));
 const mark=document.createElement('button');mark.className='mark';mark.type='button';mark.dataset.mark=String(item.id);
 mark.setAttribute('aria-label',tr('notMarked')+': '+nameOf(item));
 footer.append(q,mark);card.append(link,footer);
 card.classList.toggle('complete',isDone(item));mark.setAttribute('aria-pressed',String(isDone(item)));mark.title=autoDone(item)?tr('fromSave'):(isDone(item)?tr('unmark'):tr('notMarked'));mark.disabled=autoDone(item);
 mark.addEventListener('click',()=>toggleItem(item.id));
 link.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();goToItem(item.id)});
 return card;
}
function filtered(){
 const search=keyName(S.query);const idSearch=S.query.trim();
 return S.items.filter(item=>{
  if(S.filter==='done'&&!isDone(item))return false;
  if(S.filter==='pending'&&isDone(item))return false;
  if(S.category!=='all'&&classify(item)!==S.category)return false;
  if(search){
   if(String(item.id)===idSearch)return true;
   if(![item.en,item.pt,item.es,item.wikiTitle,item.key].some(v=>v&&keyName(v).includes(search)))return false;
  }
  return true;
 });
}
function renderList(){
 const items=filtered(),count=Math.min(items.length,S.shown);
 $('#resultCount').textContent=fmt(items.length)+' '+tr('results');
 $('#empty').hidden=items.length>0;
 $('#sourceNote').textContent=S.catalogOK?tr('catalogSource'):tr('catalogFallback');
 const grid=$('#itemGrid');grid.replaceChildren();
 const fragment=document.createDocumentFragment();
 for(const item of items.slice(0,count))fragment.appendChild(cardFor(item));
 grid.appendChild(fragment);
 $('#moreBtn').hidden=items.length<=S.shown;
 $('#moreBtn').textContent=tr('more')+' ('+fmt(items.length-count)+')';
 updateProgress();
}
function toggleItem(id){
 const item=S.byId.get(id);if(!item||autoDone(item))return;
 if(S.manual.has(id))S.manual.delete(id);else S.manual.add(id);
 store('journey-archive-marked-v1',[...S.manual]);
 if(S.view==='list')renderList();else showItemHeader(item);
 toast(isDone(item)?tr('toastDone'):tr('toastUndone'));
}
function toast(txt){
 const toast=$('#toast');toast.className='';toast.textContent=txt;
 clearTimeout(toast._timer);toast._timer=setTimeout(()=>{toast.className='sr'},2400);
}
function showResearchBar(item){
 const n=getSubmitted(item),complete=isDone(item),pct=complete?100:Math.round(Math.min(n,item.qty)/item.qty*100);
 $('#detailResearch').textContent=fmt(item.qty)+'× · '+tr('researchLabel');
 $('#detailResearchHint').textContent=(complete?tr('marked')+' · ':'')+fmt(Math.min(n,item.qty))+'/'+fmt(item.qty)+' '+tr('count');
 $('#detailFill').style.width=pct+'%';$('#detailPercent').textContent=pct+'%';
 const btn=$('#detailMark');btn.disabled=autoDone(item);
 btn.textContent=autoDone(item)?'✓ '+tr('fromSave'):S.manual.has(item.id)?'✓ '+tr('unmark'):'✓ '+tr('notMarked');
}
function showItemHeader(item){
 const title=nameOf(item);$('#detailName').textContent=title;
 $('#detailOverline').textContent=tr('eyebrow');
 $('#detailSub').textContent=title!==item.en?item.en:'Terraria · '+tr('itemId')+' #'+item.id;
 $('#detailIndex').textContent=tr('itemId')+' #'+item.id;
 const art=$('#detailSprite');art.replaceChildren();art.append(...makeSprite(item).childNodes);
 const tags=$('#detailTags');tags.replaceChildren();
 for(const t of ['#'+item.id,fmt(item.qty)+'×',isDone(item)?tr('marked'):tr('pending')]){
  const span=document.createElement('span');span.className='tag'+(t===tr('marked')?' success':'');span.textContent=t;tags.appendChild(span);
 }
 $('#detailMark').hidden=false;$('#detailMark').onclick=()=>toggleItem(item.id);
 $('#detailResearch').parentElement.parentElement.hidden=false;
 showResearchBar(item);
}
function renderGenericHeader(title){
 $('#detailName').textContent=title;$('#detailOverline').textContent=tr('generic');
 $('#detailSub').textContent='Terraria Wiki';$('#detailIndex').textContent='';
 $('#detailSprite').replaceChildren();$('#detailTags').replaceChildren();
 $('#detailMark').hidden=true;
 $('#detailResearch').parentElement.parentElement.hidden=true;
}
function makeURL(params){const u=new URL(location.href);u.search='';u.hash='';for(const [k,v] of Object.entries(params))if(v!==null&&v!==undefined)u.searchParams.set(k,String(v));return u.pathname+u.search}
function goToItem(id,replace=false){
 if(!S.byId.has(id))return;
 if(S.view==='list')S.scrollY=window.scrollY;
 const path=makeURL({item:id});
 if(replace)history.replaceState({item:id},'',path);else history.pushState({item:id},'',path);
 applyRoute();window.scrollTo(0,0);
}
function goToTitle(title){
 const matched=S.byTitle.get(keyName(title));
 if(matched)return goToItem(matched.id);
 if(S.view==='list')S.scrollY=window.scrollY;
 history.pushState({article:title},'',makeURL({article:title}));
 applyRoute();window.scrollTo(0,0);
}
function goBack(){
 if(S.fetchController)S.fetchController.abort();
 history.pushState({},'',makeURL({}));
 applyRoute();window.scrollTo(0,S.scrollY||0);
}
function applyRoute(){
 const p=new URLSearchParams(location.search),id=Number(p.get('item')),title=p.get('article');
 if(p.has('item')&&Number.isInteger(id)&&S.byId.has(id)){
  S.view='article';S.currentItem=S.byId.get(id);S.currentTitle=S.currentItem.wikiTitle||S.currentItem.en;
  $('#listView').hidden=true;$('#detailView').hidden=false;showItemHeader(S.currentItem);
  loadArticle(S.currentItem,S.currentTitle);
 }else if(title&&title.length<=220){
  S.view='article';S.currentItem=null;S.currentTitle=title;
  $('#listView').hidden=true;$('#detailView').hidden=false;renderGenericHeader(title);
  loadArticle(null,title);
 }else{
  S.view='list';S.currentItem=null;S.currentTitle='';
  if(S.fetchController)S.fetchController.abort();
  $('#detailView').hidden=true;$('#listView').hidden=false;
  renderList();
 }
}
function articleCandidates(item,title){
 const enTitle=String(item?.wikiTitle||item?.en||title||'').trim();
 const choices=[];
 if(S.language==='pt'&&item?.pt)choices.push({locale:'pt',title:item.pt});
 if(S.language==='es'&&item?.es)choices.push({locale:'es',title:item.es});
 if(S.language==='es'&&!item?.es&&COMMON_ES[item?.id])choices.push({locale:'es',title:COMMON_ES[item.id]});
 if(enTitle)choices.push({locale:'en',title:enTitle});
 return choices.filter((x,i,a)=>a.findIndex(y=>y.locale===x.locale&&y.title===x.title)===i);
}
async function fetchArticle(candidate,signal){
 const code=candidate.locale,base='https://terraria.wiki.gg'+(code==='en'?'':'/'+code)+'/api.php';
 const query=new URLSearchParams({action:'parse',page:candidate.title,prop:'text|displaytitle|revid',format:'json',origin:'*'});
 const key=code+'|'+candidate.title;
 if(S.articleCache.has(key))return S.articleCache.get(key);
 const response=await fetch(base+'?'+query,{cache:'default',signal,headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('HTTP '+response.status);
 const data=await response.json();
 if(data.error||!data.parse?.text?.['*'])throw Error(data.error?.info||'Article not found');
 const parsed={html:data.parse.text['*'],title:data.parse.title||candidate.title,locale:code,revid:data.parse.revid||null};
 if(S.articleCache.size>=12)S.articleCache.delete(S.articleCache.keys().next().value);
 S.articleCache.set(key,parsed);
 return parsed;
}
function allowedURL(value,base){
 try{
  const url=new URL(value,base);
  if(!['http:','https:'].includes(url.protocol))return null;
  return url;
 }catch(e){return null}
}
function wikiDocument(html,locale){
 /* Insert only safe content from the public MediaWiki parse API.
    Script, event attributes, HTML forms and unsafe URL schemes are removed. */
 const doc=new DOMParser().parseFromString(html,'text/html');
 const root=doc.querySelector('.mw-parser-output')||doc.body;
 for(const bad of root.querySelectorAll('script,style,link,meta,iframe,object,embed,form,button,input,textarea,select,svg,math,canvas,video,noscript'))bad.remove();
 for(const bad of root.querySelectorAll('.mw-editsection,.mw-redirectedfrom,.noprint,.mw-jump-link,.printfooter'))bad.remove();
 const base='https://terraria.wiki.gg'+(locale==='en'?'':'/'+locale)+'/wiki/';
 for(const el of [...root.querySelectorAll('*')]){
  for(const attr of [...el.attributes]){
   const n=attr.name.toLowerCase();
   if(n.startsWith('on')||n==='style'||n==='srcset'||n==='formaction'||n==='autofocus'||n==='contenteditable'||n==='id'&&attr.value.length>200)el.removeAttribute(attr.name);
  }
  if(el.id)el.id='article-'+el.id;
  if(el.tagName==='IMG'){
   const src=el.getAttribute('data-src')||el.getAttribute('src')||'';
   const url=allowedURL(src,base);
   el.removeAttribute('data-src');
   el.removeAttribute('data-srcset');
   el.removeAttribute('src');
   if(url&&(url.hostname==='terraria.wiki.gg'||url.hostname.endsWith('.wiki.gg')))el.src=url.href;
   else{el.remove();continue}
   el.loading='lazy';el.decoding='async';el.removeAttribute('width');el.removeAttribute('height');
  }
  if(el.tagName==='AUDIO'){
   el.controls=true;el.preload='none';el.removeAttribute('autoplay');el.removeAttribute('loop');
  }
  if(el.tagName==='SOURCE'){
   const src=allowedURL(el.getAttribute('src')||'',base);
   if(src&&(src.hostname==='terraria.wiki.gg'||src.hostname.endsWith('.wiki.gg')))el.src=src.href;
   else{el.remove();continue}
  }
  if(el.tagName==='A'){
   if(el.classList.contains('new')){el.removeAttribute('href');continue}
   const href=el.getAttribute('href')||'';
   if(href.startsWith('#')){
    el.setAttribute('href','#article-'+href.slice(1));el.dataset.articleAnchor='1';
    continue;
   }
   const url=allowedURL(href,base);
   if(!url){el.removeAttribute('href');continue}
   if(url.hostname==='terraria.wiki.gg'&&/(?:^|\/)wiki\//.test(url.pathname)){
    let title=url.pathname.split('/wiki/').slice(1).join('/').replace(/_/g,' ');
    try{title=decodeURIComponent(title)}catch(e){}
    if(title.length<=220){
     const match=S.byTitle.get(keyName(title));
     el.href=match?'?item='+match.id:'?article='+encodeURIComponent(title);
     el.dataset.localLink='1';continue;
    }
   }
   el.href=url.href;el.target='_blank';el.rel='noopener noreferrer';
  }
  /* Wikitext tables can have incidental inline widths; CSS scrolls them. */
 }
 const fragment=document.createDocumentFragment();
 while(root.firstChild)fragment.appendChild(root.firstChild);
 return fragment;
}
function showLoader(message){
 $('#articleLoader').hidden=false;$('#articleFrame').hidden=true;$('#articleError').hidden=true;
 $('#loaderText').textContent=message||tr('articleLoading');
}
function showFailure(){
 $('#articleLoader').hidden=true;$('#articleFrame').hidden=true;
 $('#articleError').hidden=false;$('#articleErrorTitle').textContent=tr('articleFail');
 $('#articleErrorText').textContent=tr('offline');
 $('#retryArticle').textContent=tr('articleRetry');
}
function sourceFooter(article){
 const locale=article.locale,url='https://terraria.wiki.gg'+(locale==='en'?'':'/'+locale)+'/wiki/'+encodeURIComponent(article.title.replace(/ /g,'_'));
 S.articleURL=url;
 const c=$('#articleCredit');c.replaceChildren();
 const anchor=document.createElement('a');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.textContent=tr('source');
 const license=document.createElement('a');license.href='https://creativecommons.org/licenses/by-nc-sa/4.0/';license.target='_blank';license.rel='noopener noreferrer';license.textContent='CC BY-NC-SA 4.0';
 c.append(anchor,document.createTextNode(' · '),license,document.createTextNode(' · '+tr('license')));
}
async function loadArticle(item,title){
 if(S.fetchController)S.fetchController.abort();
 const controller=new AbortController();S.fetchController=controller;
 S.wikiLoaded=false;showLoader();
 const candidates=articleCandidates(item,title);
 for(const candidate of candidates){
  try{
   const article=await fetchArticle(candidate,controller.signal);
   if(controller.signal.aborted)return;
   const container=$('#wikiContent');container.replaceChildren(wikiDocument(article.html,article.locale));
   $('#articleLabel').textContent=tr('article');
   $('#articleLang').textContent=article.locale==='pt'?tr('articlePt'):article.locale==='es'?tr('articleEs'):tr('articleEnglish');
   sourceFooter(article);
   $('#articleLoader').hidden=true;$('#articleError').hidden=true;$('#articleFrame').hidden=false;
   S.currentLocale=article.locale;S.wikiLoaded=true;
   return;
  }catch(err){if(controller.signal.aborted)return;console.warn('Wiki article unavailable:',candidate.locale,err.message)}
 }
 if(!controller.signal.aborted)showFailure();
}
function translateStatic(){
 document.documentElement.lang=LANGS[S.language];
 $('#language').value=S.language;
 $('#eyebrow').textContent=tr('eyebrow');$('#listTitle').textContent=tr('title');
 $('#search').placeholder=tr('search');$('#empty').textContent=tr('empty');
 $('#moreBtn').textContent=tr('more');$('#backBtn').textContent='← '+tr('return');
 $('#settingsButton').setAttribute('aria-label',tr('options'));
 $('#category').options[0].text=tr('categories')[0];
 for(let i=1;i<CAT_KEYS.length;i++)$('#category').options[i].text=tr('categories')[i];
 for(const b of $$('button[data-filter]')){b.textContent=tr(b.dataset.filter)}
 $('#articleLabel').textContent=tr('article');$('#loaderText').textContent=tr('articleLoading');
 $('#retryArticle').textContent=tr('articleRetry');
 $('#footer').textContent=tr('footer');
 updateStatus();updateProgress();
}
async function loadLocales(){
 const base='https://raw.githubusercontent.com/Pixelnando/terraria-pt-BR-localization-files/main/';
 try{
  const [en,pt,es]=await Promise.allSettled(['en-US','pt-BR','es-ES'].map(async lng=>{
   const res=await fetch(base+'Terraria.Localization.Content.'+lng+'.Items.json',{cache:'force-cache'});
   if(!res.ok)throw Error('locale '+lng);
   return res.json();
  }));
  const map=lng=>lng.status==='fulfilled'?lng.value.ItemName||{}:{};
  const enNames=map(en),ptNames=map(pt),esNames=map(es);
  let changed=false;
  for(const item of S.items){
   if(!item.key)continue;
   if(enNames[item.key]){item.en=enNames[item.key];changed=true}
   if(ptNames[item.key]){item.pt=ptNames[item.key];changed=true}
   if(esNames[item.key]){item.es=esNames[item.key];changed=true}
  }
  if(changed){indexItems();if(S.view==='list')renderList();else if(S.currentItem){showItemHeader(S.currentItem);loadArticle(S.currentItem,S.currentTitle)}}
 }catch(e){}
}
async function loadCatalog(){
 try{
  const r=await fetch('data/catalog-base.json',{cache:'no-cache'});
  if(!r.ok)throw Error('catalog HTTP '+r.status);
  const j=await r.json();
  if(!Array.isArray(j.items)||j.items.length<5000)throw Error('catalog too small');
  S.items=j.items.filter(x=>Number.isInteger(x.id)&&x.id>0&&Number.isInteger(x.qty)&&x.qty>0&&typeof x.en==='string').sort((a,b)=>a.id-b.id);
  S.catalogOK=j.version==='official-journey-research-list';
 }catch(e){
  console.warn('Local item catalog unavailable',e);
  const legacy=safeJSON('journey-archive-catalog-v1');
  if(Array.isArray(legacy?.items)&&legacy.items.length>=50)S.items=legacy.items;
  if(!S.items.length)S.items=[{id:1,en:'Iron Pickaxe',pt:'Picareta de Ferro',qty:1,key:'IronPickaxe'},{id:2,en:'Dirt Block',pt:'Bloco de Terra',qty:100,key:'DirtBlock'},{id:8,en:'Torch',pt:'Tocha',qty:100,key:'Torch'}];
 }
 indexItems();translateStatic();applyRoute();loadLocales();
}
function localSyncValid(data){
 return data&&data.app==='journey-archive-companion'&&data.protocol===1&&typeof data.ok==='boolean'&&data.countsById&&typeof data.countsById==='object'&&!Array.isArray(data.countsById)&&Object.keys(data.countsById).length<15000;
}
async function pollCompanion(){
 const controller=new AbortController(),time=setTimeout(()=>controller.abort(),2350);
 try{
  const resp=await fetch('http://127.0.0.1:47838/status',{method:'GET',mode:'cors',cache:'no-store',targetAddressSpace:'loopback',signal:controller.signal});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  const json=await resp.json();
  if(!localSyncValid(json))throw Error('Companion protocol invalid');
  S.connected=true;S.syncWaiting=!json.ok;S.syncPlayer=String(json.player||'').slice(0,80);
  if(json.ok){
   const filtered={};
   for(const [id,q] of Object.entries(json.countsById)){
    if(/^\d{1,5}$/.test(id)&&Number.isInteger(q)&&q>=0&&q<=1000000)filtered[id]=q;
   }
   const next={protocol:1,player:S.syncPlayer,countsById:filtered,unknownByKey:json.unknownByKey||{},unknownCount:json.unknownCount||0};
   if(JSON.stringify(next.countsById)!==JSON.stringify(S.sync.countsById||{})||JSON.stringify(next.unknownByKey)!==JSON.stringify(S.sync.unknownByKey||{})){
    S.sync=next;S.unknownIndex=new Map(Object.entries(next.unknownByKey).map(([key,val])=>[keyName(key.split(':').pop()),safeNum(val)]));
    store('journey-archive-auto-sync-v1',S.sync);
    if(S.view==='list')renderList();else if(S.currentItem)showItemHeader(S.currentItem);
   }
  }
 }catch(e){S.connected=false;S.syncWaiting=false}
 finally{clearTimeout(time);updateStatus()}
}
function exportProgress(){
 const backup={app:'Journey Archive',version:2,language:S.language,researchedIds:[...S.manual].sort((a,b)=>a-b),createdAt:new Date().toISOString()};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='terraria-jornada-progresso.json';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);$('#settingsPanel').hidden=true;toast(tr('export'));
}
async function importProgress(file){
 if(!file)return;
 try{
  if(file.size>1500000)throw Error('File too big');
  const parsed=JSON.parse(await file.text());
  const list=Array.isArray(parsed)?parsed:Array.isArray(parsed.researchedIds)?parsed.researchedIds:parsed.marked;
  if(!Array.isArray(list)||list.some(id=>!Number.isInteger(Number(id))||Number(id)<1||Number(id)>20000))throw Error('Invalid ids');
  S.manual=new Set(list.map(Number));store('journey-archive-marked-v1',[...S.manual]);
  if(LANGS[parsed.language]){S.language=parsed.language;try{localStorage.setItem('journey-archive-lang-v1',S.language)}catch(e){}}
  translateStatic();if(S.view==='list')renderList();else if(S.currentItem)showItemHeader(S.currentItem);
  toast(tr('import'));
 }catch(e){toast(tr('badImport'))}
 $('#settingsPanel').hidden=true;$('#importFile').value='';
}
function bootEvents(){
 $('#language').addEventListener('change',e=>setLanguage(e.target.value));
 $('#search').addEventListener('input',e=>{S.query=e.target.value;S.shown=80;clearTimeout(S.debounce);S.debounce=setTimeout(renderList,100)});
 $('#category').addEventListener('change',e=>{S.category=e.target.value;S.shown=80;renderList()});
 for(const btn of $$('button[data-filter]'))btn.addEventListener('click',()=>{
  S.filter=btn.dataset.filter;S.shown=80;
  for(const b of $$('button[data-filter]')){b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn))}
  renderList();
 });
 $('#moreBtn').addEventListener('click',()=>{S.shown+=80;renderList()});
 $('#brandLink').addEventListener('click',e=>{e.preventDefault();goBack()});
 $('#backBtn').addEventListener('click',goBack);
 $('#detailMark').addEventListener('click',()=>{if(S.currentItem)toggleItem(S.currentItem.id)});
 $('#retryArticle').addEventListener('click',()=>loadArticle(S.currentItem,S.currentTitle));
 $('#settingsButton').addEventListener('click',()=>{const panel=$('#settingsPanel');panel.hidden=!panel.hidden;$('#settingsButton').setAttribute('aria-expanded',String(!panel.hidden))});
 document.addEventListener('click',e=>{if(!e.target.closest('.settings-wrap')){$('#settingsPanel').hidden=true;$('#settingsButton').setAttribute('aria-expanded','false')}});
 $('#exportBtn').addEventListener('click',exportProgress);
 $('#importFile').addEventListener('change',e=>importProgress(e.target.files[0]));
 $('#syncBtn').addEventListener('click',()=>{pollCompanion();$('#settingsPanel').hidden=true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#settingsPanel').hidden){$('#settingsPanel').hidden=true;return}if(S.view==='article')goBack()}});
 $('#wikiContent').addEventListener('click',e=>{
  const a=e.target.closest('a');if(!a)return;
  if(a.dataset.articleAnchor==='1'){
   e.preventDefault();const el=document.getElementById(a.hash.slice(1));if(el)el.scrollIntoView({behavior:'smooth'});return;
  }
  if(a.dataset.localLink==='1'){
   if(e.metaKey||e.ctrlKey||e.shiftKey)return;
   e.preventDefault();const href=a.getAttribute('href')||'',p=new URLSearchParams(href.startsWith('?')?href.slice(1):href.split('?')[1]||'');
   if(p.has('item'))goToItem(+p.get('item'));else if(p.has('article'))goToTitle(p.get('article'));
  }
 });
 window.addEventListener('popstate',()=>{applyRoute();window.scrollTo(0,S.view==='list'?S.scrollY:0)});
 window.addEventListener('storage',e=>{
  if(['journey-archive-marked-v1','journey-archive-auto-sync-v1'].includes(e.key)){loadSaved();if(S.view==='list')renderList();else if(S.currentItem)showItemHeader(S.currentItem)}
  if(e.key==='journey-archive-lang-v1'&&LANGS[e.newValue])setLanguage(e.newValue);
 });
}
function init(){
 loadSaved();bootEvents();translateStatic();
 $('#resultCount').textContent='...';$('#itemGrid').innerHTML='';
 loadCatalog();pollCompanion();setInterval(pollCompanion,5000);
}
init();
