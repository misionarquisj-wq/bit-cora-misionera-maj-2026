
(function(){
 const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const items=window.BITACORA_DATA.items;
 window.BitacoraSearch={find(q){const n=norm(q).trim();if(!n)return[];return items.map(x=>({...x,_hay: norm([x.title,x.section,x.body,(x.tags||[]).join(' ')].join(' '))})).filter(x=>x._hay.includes(n)).slice(0,30)}};
})();
