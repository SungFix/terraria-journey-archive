'use strict';
/* Journey Archive Wiki: local, independent item articles and original guides. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const LANG = {pt:'pt-BR',en:'en-US',es:'es-ES'};
const GUIDES = window.JOURNEY_GUIDES || {};
const NOTES = window.JOURNEY_ITEM_NOTES || {};
const params = new URLSearchParams(location.search);
const WORDS = {
pt:{home:'Página principal',wiki:'Wiki integrada',search:'Buscar itens e guias...',go:'Pesquisar',item:'Item',items:'Itens',guides:'Guias',browse:'Catálogo de pesquisa',unknown:'Artigo não encontrado',back:'Voltar à wiki',read:'Leia mais',research:'Pesquisa necessária',type:'Categoria',status:'Situação',done:'Pesquisado',pending:'Pendente',partial:'Em andamento',needed:'Necessários',submitted:'Entregues',mark:'Marcar pesquisado',unmark:'Desmarcar',fromSave:'✓ Pesquisado no personagem',overview:'Visão geral',obtaining:'Como obter',related:'Itens relacionados',guidance:'Pesquisar no Jornada',intro:'Esta wiki faz parte do Journey Archive: todos os links de itens e guias permanecem neste site.',source:'Base histórica de 5.068 itens; conteúdos da versão mais recente ainda podem faltar.',unverified:'Para este item, a base local ainda não inclui receita ou fonte de obtenção verificada. Não apresentamos informações inventadas.',generic:'Este item pertence à categoria',researchHint:'Abra o menu de Pesquisa do Modo Jornada e entregue a quantidade indicada. Ao concluir, a duplicação ficará disponível para seu personagem.',finished:'Item pesquisado',placeholder:'Aguardando dados do personagem',stats:'Meu progresso',total:'Itens na base',complete:'Pesquisados',remaining:'Restantes',cards:'Itens em destaque',categories:'Categorias',guideTitle:'Guias do Terraria',searchResult:'Resultados da busca',noResults:'Nenhum resultado encontrado.',tooMany:'Exibindo apenas os primeiros resultados. Use filtros do catálogo para ver todos.',synced:'A sincronização do personagem também aparece nesta wiki.',translation:'Nomes não traduzidos permanecem em inglês.',english:'Em inglês',see:'Veja também',quantity:'Quantidade',gameVersion:'Requisitos históricos, sujeitos a atualizações.',unlocked:'Desbloqueado'},
en:{home:'Home',wiki:'Integrated Wiki',search:'Search items and guides...',go:'Search',item:'Item',items:'Items',guides:'Guides',browse:'Research catalog',unknown:'Article not found',back:'Back to wiki',read:'Read more',research:'Research requirement',type:'Category',status:'Status',done:'Researched',pending:'Pending',partial:'In progress',needed:'Needed',submitted:'Submitted',mark:'Mark researched',unmark:'Unmark',fromSave:'✓ Researched in your save',overview:'Overview',obtaining:'How to obtain',related:'Related items',guidance:'Journey Mode Research',intro:'This is Journey Archive’s integrated wiki. Item and guide links remain on this site.',source:'Historical base of 5,068 items; some newer content may be missing.',unverified:'A verified recipe or drop source is not yet available for this item in the local catalog; no details are invented.',generic:'This item belongs to',researchHint:'Submit the required number in Journey Mode’s Research menu. Duplication is unlocked for this character once completed.',finished:'Researched item',placeholder:'Awaiting character data',stats:'My progress',total:'Items in base',complete:'Researched',remaining:'Remaining',cards:'Featured items',categories:'Categories',guideTitle:'Terraria guides',searchResult:'Search results',noResults:'No results found.',tooMany:'Only the first results are shown; use catalog filters for the rest.',synced:'Character sync updates this wiki as well.',translation:'Untranslated names remain in English.',english:'English name',see:'See also',quantity:'Quantity',gameVersion:'Historical requirements; updates may change them.',unlocked:'Unlocked'},
es:{home:'Inicio',wiki:'Wiki integrada',search:'Buscar objetos y guías...',go:'Buscar',item:'Objeto',items:'Objetos',guides:'Guías',browse:'Catálogo de investigación',unknown:'Artículo no encontrado',back:'Volver a la wiki',read:'Leer más',research:'Investigación necesaria',type:'Categoría',status:'Estado',done:'Investigado',pending:'Pendiente',partial:'En progreso',needed:'Necesarios',submitted:'Entregados',mark:'Marcar investigado',unmark:'Desmarcar',fromSave:'✓ Investigado en tu partida',overview:'Resumen',obtaining:'Cómo obtener',related:'Objetos relacionados',guidance:'Investigación del Modo Viaje',intro:'Esta es la wiki integrada de Journey Archive. Todos los enlaces de objetos y guías siguen dentro del sitio.',source:'Base histórica de 5068 objetos; puede faltar contenido reciente.',unverified:'Esta base local no dispone de una receta o fuente verificada para el objeto. No se inventan datos.',generic:'Este objeto pertenece a',researchHint:'Entrega la cantidad necesaria en Investigación del Modo Viaje para desbloquear la duplicación con este personaje.',finished:'Objeto investigado',placeholder:'Esperando datos del personaje',stats:'Mi progreso',total:'Objetos en la base',complete:'Investigados',remaining:'Pendientes',cards:'Objetos destacados',categories:'Categorías',guideTitle:'Guías de Terraria',searchResult:'Resultados',noResults:'Sin resultados.',tooMany:'Solo se muestran los primeros resultados. Usa los filtros del catálogo.',synced:'La sincronización del personaje también actualiza esta wiki.',translation:'Los nombres no traducidos aparecen en inglés.',english:'Nombre en inglés',see:'Ver también',quantity:'Cantidad',gameVersion:'Requisitos históricos que pueden cambiar.',unlocked:'Desbloqueado'}
};
const CATS = {weapons:{icon:'⚔',pt:'Armas',en:'Weapons',es:'Armas'},equipment:{icon:'✦',pt:'Equipamentos',en:'Equipment',es:'Equipo'},building:{icon:'▤',pt:'Blocos e paredes',en:'Blocks & walls',es:'Bloques y paredes'},consumables:{icon:'⚗',pt:'Poções e consumíveis',en:'Potions & consumables',es:'Pociones y consumibles'},furniture:{icon:'▣',pt:'Móveis',en:'Furniture',es:'Muebles'},materials:{icon:'◆',pt:'Materiais',en:'Materials',es:'Materiales'},other:{icon:'◇',pt:'Outros',en:'Other',es:'Otros'}};
const COMMON_ES = {1:'Pico de hierro',2:'Bloque de tierra',3:'Bloque de piedra',8:'Antorcha',9:'Madera',23:'Gel',29:'Cristal de vida',50:'Espejo mágico',54:'Botas de Hermes'};
const S = {lang:'pt',items:[],byId:new Map(),marked:new Set(),sync:{countsById:{},unknownByKey:{}},loading:true};
const w = k => WORDS[S.lang][k] || WORDS.pt[k] || k;
const num = n => Number(n||0).toLocaleString(LANG[S.lang]);
const gTitle = g => g.title[S.lang] || g.title.pt;
const gDescription = g => g.description[S.lang] || g.description.pt;
const catName = c => (CATS[c]||CATS.other)[S.lang];
function safeGet(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(_){return null}}
function readProgress(){
 const marked=safeGet('journey-archive-marked-v1');
 S.marked=new Set(Array.isArray(marked)?marked.map(Number).filter(Number.isInteger):[]);
 const sync=safeGet('journey-archive-auto-sync-v1');
 if(sync&&sync.countsById&&typeof sync.countsById==='object')S.sync=sync;
}
function categorize(item){
 const n=item.en||'';
 if(/\b(Wall|Block|Brick|Platform|Stone|Sand|Beam|Dirt|Plating)\b/i.test(n))return'building';
 if(/\b(Potion|Elixir|Flask)\b/i.test(n))return'consumables';
 if(/\b(Table|Chair|Workbench|Bench|Furnace|Anvil|Door|Chest|Bed|Lamp|Lantern|Toilet|Sink|Bathtub|Bookcase|Dresser|Chandelier|Piano|Candelabra)\b/i.test(n))return'furniture';
 if(/\b(Sword|Bow|Gun|Staff|Yoyo|Whip|Spear|Boomerang|Blade|Cannon|Dagger|Launcher|Saber|Flail|Grenade)\b/i.test(n))return'weapons';
 if(/\b(Boots|Wings|Necklace|Emblem|Charm|Ring|Glove|Shield|Band|Horseshoe|Pickaxe|Hammer|Axe|Helmet|Breastplate|Greaves|Mask|Hood|Chestplate|Robe|Pants|Leggings)\b/i.test(n))return'equipment';
 if(/\b(Bar|Gel|Lens|Soul|Seed|Fang|Scale|Feather|Shard|Essence|Crystal|Ore|Tissue)\b/i.test(n))return'materials';
 return'other';
}
function itemName(item){return S.lang==='pt'?(item.pt||item.en):S.lang==='es'?(item.es||COMMON_ES[item.id]||item.en):item.en}
function actualCount(item){
 const id=String(item.id),values=S.sync.countsById||{};
 if(Object.prototype.hasOwnProperty.call(values,id)){const q=Number(values[id]);if(Number.isFinite(q)&&q>=0)return q}
 const want=norm(item.key||item.en||'').replace(/[^a-z0-9]/g,'');
 for(const [key,value] of Object.entries(S.sync.unknownByKey||{})){
  if(norm(key.split(':').pop()).replace(/[^a-z0-9]/g,'')===want)return Number(value)||0;
 }
 return 0;
}
function autoDone(item){return actualCount(item)>=item.qty}
function done(item){return S.marked.has(item.id)||autoDone(item)}
function aggregate(){const total=S.items.length,researched=S.items.reduce((sum,item)=>sum+(done(item)?1:0),0);return{total,researched,left:total-researched,p:total?Math.round(researched/total*100):0}}
function syncSidebar(){const s=aggregate();$('#sideProgress').textContent=s.p+'%';$('#sideCount').textContent=num(s.researched)+' / '+num(s.total);$('#sideBar').style.width=s.p+'%';return s}
function mergeCatalog(obj){
 const list=Array.isArray(obj)?obj:obj?.items;if(!Array.isArray(list))return;
 for(const item of list){
  if(!item||!Number.isInteger(item.id)||item.id<1||item.id>15000||typeof item.en!=='string'||!item.en||!Number.isInteger(item.qty)||item.qty<1||item.qty>9999)continue;
  S.byId.set(item.id,Object.assign({},S.byId.get(item.id)||{},item));
 }
 S.items=[...S.byId.values()].sort((a,b)=>a.id-b.id);
}
function spriteURL(item,attempt){
 const file=encodeURIComponent(item.en.trim().replace(/\s+/g,'_').replace(/\//g,'_')+'.png');
 return attempt===0?'https://terraria.wiki.gg/wiki/Special:Redirect/file/'+file:'https://raw.githubusercontent.com/natan-dot-com/Terraria-Dataset/master/img_sprites/'+file;
}
function sprite(item){
 return '<img data-sprite="'+item.id+'" data-attempt="0" loading="lazy" decoding="async" alt="'+esc(itemName(item))+'" src="'+esc(spriteURL(item,0))+'"><span class="pixel-fallback" hidden aria-hidden="true">◆</span>';
}
document.addEventListener('error',e=>{
 const img=e.target;if(!(img instanceof HTMLImageElement)||!img.dataset.sprite)return;
 const item=S.byId.get(Number(img.dataset.sprite));if(!item)return;
 const next=Number(img.dataset.attempt||0)+1;
 if(next===1){img.dataset.attempt='1';img.src=spriteURL(item,1)}
 else{img.hidden=true;if(img.nextElementSibling)img.nextElementSibling.hidden=false}
},true);
function crumb(...parts){$('#bread').innerHTML='<a href="wiki.html">'+esc(w('wiki'))+'</a>'+parts.map(part=>' <span aria-hidden="true">›</span> <span>'+esc(part)+'</span>').join('')}
function tile(item){
 return '<a href="wiki.html?item='+item.id+'" class="item-tile"><span class="tile-image">'+sprite(item)+'</span><span style="min-width:0"><strong>'+esc(itemName(item))+'</strong><small>#'+item.id+' · '+(done(item)?w('done'):num(item.qty)+'×')+'</small></span></a>';
}
function guideCard(slug){
 const g=GUIDES[slug];return '<a class="guide-card" href="wiki.html?guide='+slug+'"><span class="guide-symbol">'+g.icon+'</span><strong>'+esc(gTitle(g))+'</strong><span>'+esc(gDescription(g))+'</span></a>';
}
function guideLinks(limit){return Object.keys(GUIDES).slice(0,limit||12).map(k=>guideCard(k)).join('')}
function homeView(){
 const s=syncSidebar(),featured=[8,29,50,54,2,9,757,4956].map(id=>S.byId.get(id)).filter(Boolean);
 crumb(w('home'));
 $('#view').innerHTML='<section class="hero"><span class="hero-label">✦ TERRARIA · JOURNEY ARCHIVE ✦</span><h1>'+esc(w('wiki'))+'</h1><p>'+esc(w('intro'))+'</p><div class="hero-actions"><a class="button gold" href="wiki.html?guide=journey">◈ '+esc(gTitle(GUIDES.journey))+'</a><a class="button outline" href="index.html#catalogo">▦ '+esc(w('browse'))+'</a></div></section>'+
 '<div class="rail-stats"><div class="rail-stat"><strong>'+num(s.total)+'</strong><span>'+w('total')+'</span></div><div class="rail-stat"><strong>'+num(s.researched)+'</strong><span>'+w('complete')+'</span></div><div class="rail-stat"><strong>'+num(s.left)+'</strong><span>'+w('remaining')+'</span></div></div>'+
 '<section class="section"><h2 class="section-title">'+w('guideTitle')+'</h2><div class="guide-grid">'+guideLinks()+'</div></section>'+
 '<section class="section"><h2 class="section-title">'+w('categories')+'</h2><div class="pills">'+Object.keys(CATS).map(c=>'<a href="wiki.html?category='+c+'" class="pill">'+CATS[c].icon+' '+esc(catName(c))+'</a>').join('')+'</div></section>'+
 '<section class="section"><h2 class="section-title">'+w('cards')+'</h2><div class="item-list">'+featured.map(tile).join('')+'</div></section>'+
 '<p class="callout warning">'+w('source')+' '+w('translation')+'</p>';
}
function guideView(slug){
 const g=GUIDES[slug];if(!g)return notFound();
 const parts=g.sections[S.lang]||g.sections.pt;crumb(w('guides'),gTitle(g));
 const toc=parts.map((p,i)=>'<a href="#section-'+i+'">'+esc(p[0])+'</a>').join('');
 const article=parts.map((p,i)=>'<section id="section-'+i+'"><h2>'+esc(p[0])+'</h2><p>'+esc(p[1])+'</p></section>').join('');
 const related=Object.keys(GUIDES).filter(k=>k!==slug).slice(0,6).map(k=>'<a href="wiki.html?guide='+k+'" class="pill">'+esc(gTitle(GUIDES[k]))+'</a>').join('');
 $('#view').innerHTML='<div class="heading-row"><div><p>'+g.icon+' '+w('guides')+'</p><h1>'+esc(gTitle(g))+'</h1><p>'+esc(gDescription(g))+'</p></div><a class="button outline" href="wiki.html">← '+w('back')+'</a></div>'+
 '<div class="item-layout"><article class="article-body"><div class="toc"><strong>☰ '+w('guides')+'</strong>'+toc+'</div>'+article+'<h2>'+w('see')+'</h2><div class="pills">'+related+'</div></article>'+
 '<aside class="infobox"><div class="infobox-title">'+g.icon+' '+esc(gTitle(g))+'</div><div class="infobox-preview"><span style="font-size:70px">'+g.icon+'</span></div>'+
 '<table><tr><th>'+w('type')+'</th><td>'+w('guides')+'</td></tr><tr><th>'+w('items')+'</th><td>'+num(S.items.length)+'</td></tr></table><a class="button" href="index.html#catalogo">'+w('browse')+'</a></aside></div>';
}
function itemNotes(item){
 const note=NOTES[item.key];
 if(note)return note[S.lang]||note.pt;
 return [w('generic')+' '+catName(categorize(item)).toLowerCase()+'.',w('unverified')];
}
function itemView(id){
 const item=S.byId.get(id);if(!item)return notFound();
 const category=categorize(item),note=itemNotes(item),submitted=actualCount(item),isDone=done(item),pct=isDone?100:Math.min(100,Math.round(submitted/item.qty*100));
 const related=S.items.filter(x=>x.id!==id&&categorize(x)===category).sort((a,b)=>Math.abs(a.id-id)-Math.abs(b.id-id)).slice(0,8);
 const auto=autoDone(item);
 crumb(w('items'),itemName(item));
 $('#view').innerHTML='<div class="heading-row"><div><p>'+w('items')+' / '+esc(catName(category))+'</p><h1>'+esc(itemName(item))+'</h1>'+(itemName(item)!==item.en?'<p>'+w('english')+': '+esc(item.en)+'</p>':'')+'</div><a class="button outline" href="index.html#catalogo">← '+w('browse')+'</a></div>'+
 '<div class="item-layout"><article class="article-body"><div class="pills"><span class="pill">'+CATS[category].icon+' '+esc(catName(category))+'</span><span class="pill neutral">Item #'+id+'</span>'+(isDone?'<span class="pill">✓ '+w('done')+'</span>':'')+'</div>'+
 '<h2>'+w('overview')+'</h2><p>'+esc(note[0])+'</p>'+
 '<div class="detail-grid"><div class="detail"><span>'+w('research')+'</span><strong>'+num(item.qty)+'×</strong></div><div class="detail"><span>'+w('submitted')+'</span><strong>'+num(submitted)+'×</strong></div><div class="detail"><span>'+w('status')+'</span><strong>'+(isDone?w('done'):submitted?w('partial'):w('pending'))+'</strong></div></div>'+
 '<h2>'+w('research')+'</h2><div class="research-meter"><div class="meter-top"><span>'+num(Math.min(submitted,item.qty))+' / '+num(item.qty)+'</span><strong>'+pct+'%</strong></div><div class="meter"><div style="width:'+pct+'%"></div></div></div><div class="callout">'+w('researchHint')+'</div>'+
 '<h2>'+w('obtaining')+'</h2><p>'+esc(note[1])+'</p>'+(!NOTES[item.key]?'<p class="note">'+w('unverified')+'</p>':'')+
 '<p class="note">'+w('gameVersion')+'</p><div class="article-actions"><button type="button" id="markItem" class="button" '+(auto?'disabled':'')+'>'+ (auto?w('fromSave'):isDone?w('unmark'):w('mark'))+'</button><a href="wiki.html?guide=journey" class="button outline">◈ '+esc(gTitle(GUIDES.journey))+'</a></div>'+
 '<h2>'+w('related')+'</h2><div class="item-list">'+related.map(tile).join('')+'</div></article>'+
 '<aside class="infobox"><div class="infobox-title">'+esc(itemName(item))+'</div><div class="infobox-preview">'+sprite(item)+'</div><table><tr><th>'+w('type')+'</th><td>'+esc(catName(category))+'</td></tr><tr><th>ID</th><td>#'+item.id+'</td></tr><tr><th>'+w('research')+'</th><td>'+num(item.qty)+'×</td></tr><tr><th>'+w('status')+'</th><td>'+(isDone?w('done'):w('pending'))+'</td></tr></table><a class="button" href="wiki.html?category='+category+'">'+w('see')+' '+esc(catName(category))+'</a></aside></div>';
 $('#markItem')?.addEventListener('click',()=>{
  if(auto)return;
  if(S.marked.has(id))S.marked.delete(id);else S.marked.add(id);
  try{localStorage.setItem('journey-archive-marked-v1',JSON.stringify([...S.marked]))}catch(e){console.warn('Storage disabled',e)}
  render();toast(done(item)?w('finished'):w('pending'));
 });
}
function searchItems(q){
 const n=norm(q.trim());if(!n)return[];
 return S.items.filter(i=>String(i.id)===n||[i.en,i.pt,i.es,i.key].some(v=>norm(v).includes(n))).sort((a,b)=>{
  const score=i=>String(i.id)===n?0:norm(itemName(i))===n?1:norm(itemName(i)).startsWith(n)?2:3;
  return score(a)-score(b)||a.id-b.id;
 });
}
function categoryView(c){
 if(!CATS[c])return notFound();
 const filtered=S.items.filter(i=>categorize(i)===c);crumb(w('categories'),catName(c));
 listingView(CATS[c].icon+' '+catName(c),filtered,[]);
}
function searchView(q){
 const items=searchItems(q);
 const guides=Object.entries(GUIDES).filter(([slug,g])=>[slug,...Object.values(g.title),...Object.values(g.description)].some(v=>norm(v).includes(norm(q)))).map(([slug])=>slug);
 crumb(w('searchResult'),q);listingView(w('searchResult')+': '+q,items,guides);
}
function listingView(title,items,guides){
 $('#view').innerHTML='<div class="heading-row"><div><p>⌕ '+w('wiki')+'</p><h1>'+esc(title)+'</h1><p>'+num(items.length)+' '+w('items')+' · '+num(guides.length)+' '+w('guides')+'</p></div><a class="button outline" href="wiki.html">← '+w('back')+'</a></div>'+
 (guides.length?'<section class="section"><h2 class="section-title">'+w('guides')+'</h2><div class="guide-grid">'+guides.map(guideCard).join('')+'</div></section>':'')+
 '<section class="section"><h2 class="section-title">'+w('items')+'</h2><div class="item-list">'+items.slice(0,240).map(tile).join('')+'</div>'+(!items.length?'<p>'+w('noResults')+'</p>':'')+(items.length>240?'<p class="callout warning">'+w('tooMany')+' <a href="index.html#catalogo">'+w('browse')+'</a></p>':'')+'</section>';
}
function notFound(){crumb(w('unknown'));$('#view').innerHTML='<section class="hero"><h1>'+w('unknown')+'</h1><a class="button" href="wiki.html">← '+w('back')+'</a></section>'}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2700)}
function liveSearch(q){
 const box=$('#searchResults');if(norm(q).trim().length<2){box.hidden=true;return}
 const items=searchItems(q).slice(0,10);
 const guides=Object.keys(GUIDES).filter(k=>norm(gTitle(GUIDES[k])).includes(norm(q))).slice(0,4);
 box.hidden=false;
 box.innerHTML='<div class="result-heading">'+w('searchResult')+'</div>'+
 guides.map(k=>'<a class="result-link" href="wiki.html?guide='+k+'"><span>'+GUIDES[k].icon+'</span><span>'+esc(gTitle(GUIDES[k]))+'</span><small>'+w('guides')+'</small></a>').join('')+
 items.map(i=>'<a class="result-link" href="wiki.html?item='+i.id+'"><span>◇</span><span>'+esc(itemName(i))+'</span><small>#'+i.id+'</small></a>').join('')+
 '<a class="result-link" href="wiki.html?q='+encodeURIComponent(q)+'">⌕ '+w('searchResult')+': '+esc(q)+'</a>';
}
function render(){
 syncSidebar();
 document.documentElement.lang=LANG[S.lang];
 $('#language').value=S.lang;$('#search').placeholder=w('search');$('#searchGo').textContent=w('go');
 document.title=w('wiki')+' | Terraria Journey Archive';
 const guide=params.get('guide'),cat=params.get('category'),id=params.get('item'),q=params.get('q');
 if(id!==null){const n=Number(id);Number.isInteger(n)&&n>0?itemView(n):notFound()}
 else if(guide!==null)guideView(guide);
 else if(cat!==null)categoryView(cat);
 else if(q!==null){$('#search').value=q;searchView(q)}
 else homeView();
}
async function loadTranslations(){
 try{
  const base='https://raw.githubusercontent.com/Pixelnando/terraria-pt-BR-localization-files/main/';
  const files=await Promise.all(['en-US','pt-BR'].map(lang=>fetch(base+'Terraria.Localization.Content.'+lang+'.Items.json').then(r=>{if(!r.ok)throw Error('locale');return r.json()})));
  const en=files[0].ItemName||{},pt=files[1].ItemName||{};
  for(const item of S.items)if(item.key){if(en[item.key])item.en=en[item.key];if(pt[item.key])item.pt=pt[item.key]}
  render();
 }catch(e){/* Internal content always works without remote translations. */}
}
async function pollSync(){
 try{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),2000);
  let res;try{res=await fetch('http://127.0.0.1:47838/status',{cache:'no-store',mode:'cors',targetAddressSpace:'loopback',signal:controller.signal})}finally{clearTimeout(timeout)}
  if(!res.ok)return;const data=await res.json();
  if(data.app==='journey-archive-companion'&&data.protocol===1&&data.ok&&data.countsById&&typeof data.countsById==='object'&&Object.keys(data.countsById).length<=9000){
   const old=JSON.stringify(S.sync.countsById||{}),newData={};
   for(const [key,v] of Object.entries(data.countsById))if(/^\d{1,5}$/.test(key)&&Number.isInteger(v)&&v>=0&&v<=100000)newData[key]=v;
   if(JSON.stringify(newData)!==old){
    S.sync={protocol:1,countsById:newData,unknownByKey:data.unknownByKey||{},unknownCount:data.unknownCount||0,player:String(data.player||'').slice(0,80)};
    try{localStorage.setItem('journey-archive-auto-sync-v1',JSON.stringify(S.sync))}catch(e){}
    render();
   }
  }
 }catch(e){/* Optional local companion may not be running. */}
}
async function boot(){
 let lang='pt';try{lang=localStorage.getItem('journey-archive-lang-v1')||'pt'}catch(e){}
 S.lang=LANG[lang]?lang:'pt';readProgress();
 $('#view').innerHTML='<div class="callout">Carregando a wiki integrada...</div>';
 try{const res=await fetch('./data/catalog-base.json');if(!res.ok)throw Error('catalog');mergeCatalog(await res.json())}
 catch(e){console.warn('Catalog unavailable',e)}
 const cache=safeGet('journey-archive-catalog-v1');if(cache&&Array.isArray(cache.items)&&cache.items.length>900)mergeCatalog(cache.items);
 if(!S.items.length)mergeCatalog([{id:1,en:'Iron Pickaxe',pt:'Picareta de Ferro',qty:1,key:'IronPickaxe'},{id:2,en:'Dirt Block',pt:'Bloco de Terra',qty:100,key:'DirtBlock'},{id:8,en:'Torch',pt:'Tocha',qty:100,key:'Torch'}]);
 $('#language').addEventListener('change',e=>{S.lang=LANG[e.target.value]?e.target.value:'pt';try{localStorage.setItem('journey-archive-lang-v1',S.lang)}catch(e){}render()});
 $('#search').addEventListener('input',e=>liveSearch(e.target.value));
 $('#search').addEventListener('keydown',e=>{if(e.key==='Enter')goSearch()});
 $('#searchGo').addEventListener('click',goSearch);
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.wiki-search-bar')&&!e.target.closest('#searchResults'))$('#searchResults').hidden=true});
 $('#menuToggle').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#menuToggle').setAttribute('aria-expanded',String(open))});
 window.addEventListener('storage',e=>{if(['journey-archive-marked-v1','journey-archive-auto-sync-v1'].includes(e.key)){readProgress();render()}if(e.key==='journey-archive-lang-v1'&&LANG[e.newValue]){S.lang=e.newValue;render()}});
 render();loadTranslations();pollSync();setInterval(pollSync,6000);
}
function goSearch(){const q=$('#search').value.trim();location.href=q?'wiki.html?q='+encodeURIComponent(q):'wiki.html'}
boot();
