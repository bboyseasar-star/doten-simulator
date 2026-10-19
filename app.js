'use strict';
(function(){
const COL={ink:'#1f2937',muted:'#64748b',grid:'#fde7cf',axis:'#9aa0aa',blue:'#2563eb',ember:'#ef4444',fire:'#f97316',q:'#16a34a',triFill:'rgba(249,115,22,.28)',triLine:'#f97316'};
const $=id=>document.getElementById(id);
const rectCv=$('rectCanvas'), grCv=$('graphCanvas');
const rg=rectCv.getContext('2d'), gg=grCv.getContext('2d');
if(!rg||!gg) return;
const PROBLEMS={
 original:{shape:'長方形',route:['A','B','C','D'],fixed:['A','D'],area:'△APD',horizontal:'AB',vertical:'AD',initial:[4,3]},
 textbook:{shape:'長方形',route:['A','B','C','D'],fixed:['A','D'],area:'△APD',horizontal:'AD',vertical:'AB',initial:[4,3]},
 triangle:{shape:'直角三角形',route:['A','B','C'],fixed:['A','C'],area:'△APC',horizontal:'AB',vertical:'BC',initial:[4,3]},
 trapezoid:{shape:'台形',route:['D','A','D'],fixed:['A','B'],area:'四角形ABQP',horizontal:'AD',vertical:'AB',initial:[2,2],time:true}
};
let problem='original',W=4,H=3,x=0,playing=false,speed=0.5,raf=null,last=null;
function model(){return PROBLEMS[problem];}
function abLen(){return problem==='textbook'?H:W;}
function adLen(){return problem==='textbook'?W:H;}
function routeLengths(){if(problem==='trapezoid')return [W,W];return problem==='triangle'?[W,H]:[abLen(),adLen(),abLen()];}
function totalLen(){return routeLengths().reduce((sum,length)=>sum+length,0);}
function phaseOf(value){let end=0;const lengths=routeLengths();for(let i=0;i<lengths.length;i++){end+=lengths[i];if(value<=end)return i;}return lengths.length-1;}
// 図形内の座標（右向きx、上向きy）。
function vertices(){
 if(problem==='trapezoid')return {A:{x:0,y:H},B:{x:0,y:0},C:{x:2*W,y:0},D:{x:W,y:H}};
 if(problem==='textbook')return {A:{x:0,y:H},B:{x:0,y:0},C:{x:W,y:0},D:{x:W,y:H}};
 if(problem==='triangle')return {A:{x:0,y:0},B:{x:W,y:0},C:{x:W,y:H}};
 return {A:{x:0,y:0},B:{x:W,y:0},C:{x:W,y:H},D:{x:0,y:H}};
}
function pAt(value){
 const t=Math.max(0,Math.min(totalLen(),value)),v=vertices(),route=model().route.map(name=>v[name]),lengths=routeLengths();
 let distance=t;
 for(let i=0;i<lengths.length;i++){
  if(distance<=lengths[i]||i===lengths.length-1){const ratio=Math.max(0,Math.min(1,distance/lengths[i]));return{x:route[i].x+(route[i+1].x-route[i].x)*ratio,y:route[i].y+(route[i+1].y-route[i].y)*ratio};}
  distance-=lengths[i];
 }
 return route[route.length-1];
}
function qAt(value){return {x:Math.max(0,Math.min(totalLen(),value)),y:0};}
function areaAt(value){
 const t=Math.max(0,Math.min(totalLen(),value));
 if(problem==='trapezoid')return H*(Math.abs(t-W)+t)/2;
 if(problem==='triangle')return t<=W?H*t/2:W*(W+H-t)/2;
 const a=adLen()/2;if(t<=abLen())return a*t;if(t<=abLen()+adLen())return a*abLen();return a*(totalLen()-t);
}
function fmt(n){return Number.isInteger(n)?n:Number(n.toFixed(2));}
function syncProblemLabels(){
 const m=model(),route=m.route.join('→');
 $('problemDescription').textContent=m.time?'PはD→A→D、QはB→Cへ、ともに1 cm/秒で動く。四角形ABQPの面積はどう変わる？':`点Pが ${route} と動くと、${m.area}の面積はどう変わる？`;
 $('figureTitle').textContent=`① ${m.shape}と動く点${m.time?'P・Q':'P'}`;
 $('fixedLegend').textContent=`${m.fixed.join('・')}は固定`;
 $('routeLegend').textContent=m.time?'PはD→A→D ／ QはB→C':`Pは ${route}`;
 $('areaLegend').textContent=`${m.area}の面積＝y`;
 $('wLabel').textContent=m.time?'AD（上底）':`${m.horizontal}（横）`;$('hLabel').textContent=m.time?'AB（高さ）':`${m.vertical}（縦）`;
 $('wSlider').setAttribute('aria-label',`${$('wLabel').textContent}の長さ`);$('hSlider').setAttribute('aria-label',`${$('hLabel').textContent}の長さ`);
 $('explorationNote').textContent=m.time?'💡 2点の動きと面積の変わり方を調べよう。':'💡 辺ごとに面積の変わり方を調べよう。';
 $('linkedBase').hidden=!m.time;$('hintCaption').textContent=m.time?'平行な辺・高さ':'底辺・高さ';$('speedLabel').textContent=m.time?'再生速度':'速さ';
 $('speed').setAttribute('aria-label',m.time?'シミュレーターの再生速度':'点Pの移動速度');
 $('xLabel').textContent=m.time?'経過時間 x＝':'Pの位置（道のり x＝';$('xUnit').textContent=m.time?' 秒':' cm）';
 $('xSlider').setAttribute('aria-label',m.time?'経過時間':'点Pが動いた道のり');
 $('axisNote').textContent=m.time?'横軸：経過時間 x（秒）／ 縦軸：面積 y':'横軸：動いた道のり x ／ 縦軸：面積 y';
 rectCv.setAttribute('aria-label',`${m.shape}${Object.keys(vertices()).join('')}と動点${m.time?'P・Q':'P'}、${m.area}`);
 grCv.setAttribute('aria-label',`${m.time?'経過時間':'動いた道のり'}と${m.area}の面積のグラフ`);
}
function dot(c,px,py,col,r=5){c.fillStyle=col;c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();}
// ヒントの色：xとともに増える＝紫、減る＝灰（破線）、変わらない＝墨。
const HC={x:'#7c3aed',rest:'#64748b',fixed:'#334155'},MINUS='−',JP='"BIZ UDPGothic",sans-serif';
let hintLevel='none',segOn=false;
function unit(a,b){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;return{x:dx/l,y:dy/l};}
// 問題・区間ごとのヒント。dims：寸法線（図には短いラベル）、perp：垂線、rights：直角マーク、eq/aux：③に出す式。座標は図形内座標。
// fixedの辺は既存の長さ表示を消し（ヒント側に数値を出す）、xで変わる辺は既存表示を空いた場所へ逃がす。
function hintSpec(){
 const v=vertices(),p=pAt(x),T=totalLen(),ph=phaseOf(x),dims=[],rights=[],eq=[],aux=[],M=MINUS,len=hintLevel==='len';let perp=null;
 const ok=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y)>1e-9,paren=val=>/x/.test(val)&&val!=='x'?`(${val})`:val;
 // val：図に出す短い値（xを含むかどうかで役割が決まる）。
 const d=(a,b,n,role,name,seg,val,edge)=>{eq.push(len?`${name} ${seg}＝${paren(val)} cm`:`${name} ${seg}`);if(ok(a,b))dims.push({a,b,n,role,name,seg,val,edge});};
 const sub=(seg,val)=>{if(len)aux.push(`${seg}＝${paren(val)} cm`);};
 if(problem==='trapezoid'){
  const q=qAt(x);
  d(v.A,p,{x:0,y:1},x<W?'rest':'x','平行な辺','AP',x<W?`${W}${M}x`:`x${M}${W}`,'AD');
  d(v.B,q,{x:0,y:-1},'x','平行な辺','BQ','x','BC');
  d(v.B,v.A,{x:-1,y:0},'fixed','高さ','AB',String(H),'AB');rights.push({c:v.B,u:{x:0,y:1},w:{x:1,y:0},role:'fixed'});
 }else if(problem==='triangle'){
  rights.push({c:v.B,u:{x:-1,y:0},w:{x:0,y:1},role:'fixed'});
  if(ph===0){d(v.A,p,{x:0,y:-1},'x','底辺','AP','x','AB');d(v.B,v.C,{x:1,y:0},'fixed','高さ','BC',String(H),'BC');}
  else{d(p,v.C,{x:1,y:0},'rest','底辺','PC',`${T}${M}x`,'BC');d(v.A,v.B,{x:0,y:-1},'fixed','高さ','AB',String(W),'AB');sub('BP',`x${M}${W}`);}
 }else{
  // 底辺AD：originalは左の縦辺、textbookは上の横辺。
  const tb=problem==='textbook',ab=abLen(),ad=adLen();
  d(v.A,v.D,tb?{x:0,y:1}:{x:-1,y:0},'fixed','底辺','AD',String(ad),'AD');
  if(ph===0){d(v.A,p,tb?{x:-1,y:0}:{x:0,y:-1},'x','高さ','AP','x','AB');if(ok(v.A,p))rights.push({c:v.A,u:unit(v.A,v.D),w:unit(v.A,v.B),role:'x'});}
  else if(ph===1){
   const foot=tb?{x:p.x,y:H}:{x:0,y:p.y};
   perp={a:p,b:foot,val:String(ab)};eq.push(len?`高さ＝AB＝${ab} cm`:'高さ＝AB');rights.push({c:foot,u:unit(foot,p),w:tb?{x:foot.x<W?1:-1,y:0}:{x:0,y:foot.y<H?1:-1},role:'fixed'});
   sub('BP',`x${M}${ab}`);
  }else{
   d(p,v.D,tb?{x:1,y:0}:{x:0,y:1},'rest','高さ','PD',`${T}${M}x`,'CD');if(ok(p,v.D))rights.push({c:v.D,u:unit(v.D,v.A),w:unit(v.D,v.C),role:'rest'});
   sub('CP',`x${M}${ab+ad}`);
  }
 }
 return{dims,perp,rights,eq,aux,hide:new Set(dims.filter(dm=>dm.role==='fixed').map(dm=>dm.edge)),moved:new Set(dims.filter(dm=>dm.role!=='fixed').map(dm=>dm.edge))};
}
// ③の「ヒントの式」欄。補助の式は薄い字で添える。
function syncHintEq(hint){
 const el=$('hintEq');if(!el)return;el.hidden=!hint;if(!hint){el.textContent='';return;}
 const html=hint.eq.join(' ／ ')+(hint.aux.length?` <span class="aux">（${hint.aux.join('、')}）</span>`:'');if(el.innerHTML!==html)el.innerHTML=html;
}
function rrect(c,x0,y0,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x0+r,y0);c.arcTo(x0+w,y0,x0+w,y0+h,r);c.arcTo(x0+w,y0+h,x0,y0+h,r);c.arcTo(x0,y0+h,x0,y0,r);c.arcTo(x0,y0,x0+w,y0,r);c.closePath();}
function hits(r,list){return list.some(o=>r.x<o.x+o.w&&o.x<r.x+r.w&&r.y<o.y+o.h&&o.y<r.y+r.h);}
function segBox(a,b,g){return{x:Math.min(a.x,b.x)-g,y:Math.min(a.y,b.y)-g,w:Math.abs(a.x-b.x)+2*g,h:Math.abs(a.y-b.y)+2*g};}
// 線分が矩形にかかるか（図形の辺の上に文字を乗せないため）。
function crosses(r,a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2)+1;for(let i=0;i<=n;i++){const px=a.x+(b.x-a.x)*i/n,py=a.y+(b.y-a.y)*i/n;if(px>r.x-1.5&&px<r.x+r.w+1.5&&py>r.y-1.5&&py<r.y+r.h+1.5)return true;}return false;}
// 寸法線・垂線・直角マークを描き、文字が避ける範囲を返す。dm.mainRectは自分のラベルだけが重なってよい範囲。
function drawHintLines(c,hint,P,off,k){
 const rects=[],style=role=>{c.setLineDash(role==='rest'?[6,4]:[]);c.strokeStyle=HC[role];c.lineWidth=role==='x'?3:role==='rest'?2.5:2;};
 hint.dims.forEach(dm=>{
  const a=P(dm.a),b=P(dm.b),n={x:dm.n.x,y:-dm.n.y};dm.ca=a;dm.cb=b;dm.cn=n;dm.len=Math.hypot(b.x-a.x,b.y-a.y);
  const a2={x:a.x+n.x*off,y:a.y+n.y*off},b2={x:b.x+n.x*off,y:b.y+n.y*off};
  c.setLineDash([]);c.strokeStyle=HC[dm.role];c.lineWidth=1;dm.ext=[];[a,b].forEach(e=>{const e1={x:e.x+n.x*4,y:e.y+n.y*4},e2={x:e.x+n.x*(off+6),y:e.y+n.y*(off+6)};c.beginPath();c.moveTo(e1.x,e1.y);c.lineTo(e2.x,e2.y);c.stroke();const er=segBox(e1,e2,1.5);dm.ext.push(er);rects.push(er);});
  style(dm.role);c.beginPath();c.moveTo(a2.x,a2.y);c.lineTo(b2.x,b2.y);c.stroke();dm.mainRect=segBox(a2,b2,2);rects.push(dm.mainRect);
 });
 c.setLineDash([]);
 if(hint.perp){const pp=hint.perp,a=P(pp.a),b=P(pp.b);pp.ca=a;pp.cb=b;c.strokeStyle=HC.fixed;c.lineWidth=2;c.setLineDash([3,4]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);pp.mainRect=segBox(a,b,2);rects.push(pp.mainRect);}
 const sz=Math.max(10,Math.min(14,10*k));
 hint.rights.forEach(r=>{const o=P(r.c),u={x:r.u.x,y:-r.u.y},w={x:r.w.x,y:-r.w.y},q={x:o.x+(u.x+w.x)*sz,y:o.y+(u.y+w.y)*sz};c.strokeStyle=HC[r.role];c.lineWidth=1.5;c.beginPath();c.moveTo(o.x+u.x*sz,o.y+u.y*sz);c.lineTo(q.x,q.y);c.lineTo(o.x+w.x*sz,o.y+w.y*sz);c.stroke();rects.push(segBox(o,q,1.5));});
 return rects;
}
// 白いピル型ラベル。寸法線の外側（線上かその先）に置く。中心はまず線分の範囲内、無理なら端の外（長さの1/2まで）。自分の寸法線と両端の補助線には重なってよい。
// 他のラベル・寸法線・頂点名・P/Q・直角マークに重なる位置は使わない。置けなければ文字を短くし、それでも無理なら省く。
function drawHintLabels(c,hint,occ,lines,cw,ch,fs,off,k,h){
 const name=hintLevel==='name',padX=7*k,bounds=r=>r.x>=1&&r.y>=1&&r.x+r.w<=cw-1&&r.y+r.h<=ch-1;
 c.font=`bold ${fs}px ${JP}`;c.textAlign='center';c.textBaseline='middle';
 const width=text=>c.measureText(text).width+2*padX;
 function draw(text,col,r){occ.push({x:r.x-2,y:r.y-2,w:r.w+4,h:r.h+4});c.fillStyle='rgba(255,255,255,.92)';rrect(c,r.x,r.y,r.w,r.h,6*k);c.fill();c.strokeStyle=col;c.lineWidth=1.5*k;c.stroke();c.fillStyle=col;c.fillText(text,r.x+r.w/2,r.y+r.h/2+fs*.04);}
 function place(texts,col,a,b,sides,own){
  const t=unit(a,b),L=Math.hypot(b.x-a.x,b.y-a.y),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2},others=lines.filter(r=>!own.includes(r));
  for(const text of texts){
   const w=width(text);
   const fr=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(i/8,-i/8);return o;};
  for(const shifts of [[0,...fr(1,8)].map(f=>f*Math.max(0,L/2-2)),fr(9,16).map(f=>f*L/2)])for(const [n,offs] of sides){
    // e：法線方向の半幅、oMax：図の外枠まで寄せられる最大の距離。
    const e=Math.abs(n.x)*w/2+Math.abs(n.y)*h/2,oMax=(n.x>.5?cw-1-m.x:n.x<-.5?m.x-1:n.y>.5?ch-1-m.y:m.y-1)-e;
    for(const o of offs(e,oMax))for(const sh of shifts){
     const cx=m.x+n.x*o+t.x*sh,cy=m.y+n.y*o+t.y*sh,r={x:cx-w/2,y:cy-h/2,w,h};
     if(bounds(r)&&!hits(r,occ)&&!hits(r,others)){draw(text,col,r);return;}
    }
   }
  }
 }
 hint.dims.forEach(dm=>{if(dm.len<1)return;const full=`${dm.name} ${dm.val}`,short=dm.seg==='AP'&&problem==='trapezoid'?'上底':dm.seg==='BQ'?'下底':null,texts=(name&&dm.role!=='fixed'?[dm.name]:[full,dm.name]).concat(short?[short]:[]);
  // 縦の辺：外枠ぎりぎりまで外へ寄せた位置を先に。中心が図の内側に入る位置は使わない。横の辺：線上→線の外。
  const vert=Math.abs(dm.cn.x)>.5,offs=(e,oMax)=>vert?[...new Set([Math.min(off+e+3,oMax),off])].filter(o=>o>=Math.max(2,off-e+2)&&o<=oMax+.01):[off,off+e+3];
  place(texts,HC[dm.role],dm.ca,dm.cb,[[dm.cn,offs]],[dm.mainRect,...dm.ext]);});
 if(hint.perp){const pp=hint.perp,t=unit(pp.ca,pp.cb);place([`高さ ${pp.val}`,'高さ'],HC.fixed,pp.ca,pp.cb,[[{x:-t.y,y:t.x},e=>[e+4]],[{x:t.y,y:-t.x},e=>[e+4]]],[pp.mainRect]);}
 c.textBaseline='alphabetic';c.textAlign='left';
}
function drawRect(){
 const c=rg,cw=rectCv.width,ch=rectCv.height,pad=56,figureWidth=problem==='trapezoid'?2*W:W,s=Math.min((cw-2*pad)/figureWidth,(ch-2*pad)/H),ox=(cw-figureWidth*s)/2,oy=(ch+H*s)/2;
 const PX=mx=>ox+mx*s,PY=my=>oy-my*s,P=pt=>({x:PX(pt.x),y:PY(pt.y)}),v=vertices(),p=pAt(x),m=model(),fixed=m.fixed.map(name=>v[name]),ph=phaseOf(x);
 // CSSで縮小表示されても文字が画面上で読める大きさになるようにする（ヒント13px・上限14px、頂点名13px、長さ11px以上）。
 const sc=Math.min(rectCv.clientWidth/cw,rectCv.clientHeight/ch)||1,k=1/sc,fs=Math.min(14*k,Math.max(11,13*k)),hp=fs*1.05+3*k,off=Math.max(18,Math.ceil(hp/2)+9),vf=Math.max(16,13*k),lf=Math.max(13,11*k),lw=vf*.72;
 const hint=hintLevel==='none'?null:hintSpec(),hide=hint?hint.hide:new Set(),moved=hint?hint.moved:new Set(),occ=[];
 syncHintEq(hint);
 const bounds=r=>r.x>=1&&r.y>=1&&r.x+r.w<=cw-1&&r.y+r.h<=ch-1,poly=Object.values(v).map(P),edges=poly.map((a,i)=>[a,poly[(i+1)%poly.length]]);
 c.clearRect(0,0,cw,ch);c.fillStyle=COL.triFill;c.strokeStyle=COL.triLine;c.lineWidth=2;
 const shaded=m.time?[v.A,v.B,qAt(x),p]:[fixed[0],p,fixed[1]];
 c.beginPath();shaded.forEach((point,i)=>{if(i===0)c.moveTo(PX(point.x),PY(point.y));else c.lineTo(PX(point.x),PY(point.y));});c.closePath();c.fill();c.stroke();
 c.strokeStyle=COL.ink;c.lineWidth=2.5;c.beginPath();poly.forEach((point,i)=>{if(i===0)c.moveTo(point.x,point.y);else c.lineTo(point.x,point.y);});c.closePath();c.stroke();
 if(problem==='triangle'&&!hint){
  const marker=Math.min(14,s*.25),bx=PX(W),by=PY(0);
  c.lineWidth=1.5;c.beginPath();c.moveTo(bx-marker,by);c.lineTo(bx-marker,by-marker);c.lineTo(bx,by-marker);c.stroke();
 }
 const lines=hint?drawHintLines(c,hint,P,off,k):[];
 // 頂点名：図形の外側の斜め。
 c.font=`bold ${vf}px Outfit`;c.textAlign='center';c.textBaseline='middle';
 const box=(cx,cy)=>({x:cx-lw/2-1,y:cy-vf*.42,w:lw+2,h:vf*.84});
 Object.entries(v).forEach(([name,point])=>{const cx=PX(point.x)+(point.x===0?-(lw/2+9):lw/2+9),cy=PY(point.y)+(point.y===0?vf*.5+8:-(vf*.5+8));c.fillStyle=m.fixed.includes(name)?COL.blue:COL.ink;c.fillText(name,cx,cy);occ.push(box(cx,cy));});
 const mark=(px,py,r)=>occ.push({x:px-r,y:py-r,w:2*r,h:2*r});
 fixed.forEach(point=>{dot(c,PX(point.x),PY(point.y),COL.blue);mark(PX(point.x),PY(point.y),7);});
 const pc=P(p);dot(c,pc.x,pc.y,COL.ember,7);mark(pc.x,pc.y,8);
 let qc=null;if(m.time){qc=P(qAt(x));dot(c,qc.x,qc.y,COL.q,7);mark(qc.x,qc.y,8);}
 // P・Qの文字：いる辺の外側の向きに置き、寸法線の先（端の外）を優先。寸法線・頂点名・辺・もう一方の文字に重ねない。
 const cen={x:poly.reduce((a,q)=>a+q.x,0)/poly.length,y:poly.reduce((a,q)=>a+q.y,0)/poly.length};
 function tag(txt,col,pt,ea,eb,dimFrom){
  const t=unit(ea,eb);let n={x:-t.y,y:t.x};if(n.x*((ea.x+eb.x)/2-cen.x)+n.y*((ea.y+eb.y)/2-cen.y)<0)n={x:-n.x,y:-n.y};
  const ta=dimFrom&&Math.hypot(pt.x-dimFrom.x,pt.y-dimFrom.y)>1?unit(dimFrom,pt):t,dn=vf*.5+6,dt=lw/2+8,far=off+hp/2+vf*.45+4,list=[];
  const add=(a,b)=>list.push({x:pt.x+n.x*a+ta.x*b,y:pt.y+n.y*a+ta.y*b});
  add(dn,dt);add(dn,0);add(dn,-dt);add(far,0);add(far,dt);add(-dn,dt);add(-dn,0);add(-dn,-dt);
  [1,1.5,2,2.6].forEach(f=>{for(let i=0;i<16;i++){const an=i*Math.PI/8;list.push({x:pt.x+Math.cos(an)*(lw/2+10)*f,y:pt.y+Math.sin(an)*(vf*.42+10)*f});}});
  const ok=q=>{const r=box(q.x,q.y);return bounds(r)&&!hits(r,occ)&&!hits(r,lines)&&!edges.some(([a,b])=>crosses(r,a,b));};
  const pick=list.find(ok)||list[0];c.fillStyle=col;c.fillText(txt,pick.x,pick.y);occ.push(box(pick.x,pick.y));
 }
 const route=m.route.map(nm=>P(v[nm])),dimAt=pt=>{const dm=hint&&hint.dims.find(dm=>dm.len>=1&&(Math.hypot(dm.cb.x-pt.x,dm.cb.y-pt.y)<1||Math.hypot(dm.ca.x-pt.x,dm.ca.y-pt.y)<1));return dm?(Math.hypot(dm.cb.x-pt.x,dm.cb.y-pt.y)<1?dm.ca:dm.cb):null;};
 // 既存のグレーの長さ表示。fixedの辺は消す（ヒントに数値がある）。xで変わる辺は、ヒントの後で空いた場所へ逃がす（空きがなければ出さない）。
 c.textAlign='center';c.textBaseline='middle';
 const top=problem==='textbook'||m.time,dd=Math.max(34,lf/2+24);
 const lab=(edge,text,a,b,n,rot)=>{
  if(hide.has(edge))return;const A=P(a),B=P(b),cn={x:n.x,y:-n.y},mid={x:(A.x+B.x)/2,y:(A.y+B.y)/2},tw=c.measureText(text).width,bw=rot?lf+4:tw+6,bh=rot?tw+6:lf+4,th=rot?bw/2:bh/2;
  const mv=moved.has(edge),ds=mv?[off+hp/2+4+th]:[dd],t=unit(A,B),el=Math.hypot(B.x-A.x,B.y-A.y),sl=mv?[0,.1,-.1].map(f=>f*el):[0];
  const rs=[];ds.forEach(d0=>sl.forEach(s0=>{const cx=mid.x+cn.x*d0+t.x*s0,cy=mid.y+cn.y*d0+t.y*s0;rs.push({cx,cy,r:{x:cx-bw/2,y:cy-bh/2,w:bw,h:bh}});}));
  const pick=rs.find(o=>bounds(o.r)&&!hits(o.r,occ)&&!hits(o.r,lines))||(hint?null:rs[0]);if(!pick)return;
  c.save();c.translate(pick.cx,pick.cy);if(rot)c.rotate(-Math.PI/2);c.fillText(text,0,0);c.restore();occ.push(pick.r);
 };
 // 固定の位置の表示 → ヒント → 逃がす表示（ヒントの後に空きを探す）の順。
 const hz=m.horizontal,tri=problem==='triangle',labs=[[hz,`${hz} = ${W} cm`,{x:0,y:top?H:0},{x:W,y:top?H:0},{x:0,y:top?1:-1},false],[m.vertical,`${m.vertical} = ${H} cm`,{x:tri?W:0,y:0},{x:tri?W:0,y:H},{x:tri?1:-1,y:0},true]];
 if(m.time)labs.push(['BC',`BC = ${2*W} cm`,{x:0,y:0},{x:2*W,y:0},{x:0,y:-1},false]);
 const drawLabs=mv=>{c.fillStyle=COL.muted;c.font=`${lf}px Outfit`;c.textAlign='center';c.textBaseline='middle';labs.filter(l=>moved.has(l[0])===mv).forEach(l=>lab(...l));c.textAlign='left';c.textBaseline='alphabetic';};
 drawLabs(false);
 if(hint)drawHintLabels(c,hint,occ,lines,cw,ch,fs,off,k,hp);
 // P・Qの文字は、ヒントのラベルを置いた後に空いた場所へ。
 c.font=`bold ${vf}px Outfit`;c.textAlign='center';c.textBaseline='middle';
 if(qc)tag('Q',COL.q,qc,P(v.B),P(v.C),dimAt(qc));
 tag('P',COL.ember,pc,route[ph],route[ph+1],dimAt(pc));
 drawLabs(true);
 c.textAlign='left';c.textBaseline='alphabetic';
}
function drawGraph(){
 const c=gg,cw=grCv.width,ch=grCv.height,pad=44,maxX=totalLen(),maxY=(problem==='trapezoid'?1.5:0.5)*H*W*1.15;
 const GX=mx=>pad+mx/maxX*(cw-pad-18),GY=my=>ch-pad-my/maxY*(ch-pad-20);
 c.clearRect(0,0,cw,ch);c.strokeStyle=COL.grid;c.lineWidth=1;
 for(let i=0;i<=maxX;i++){c.beginPath();c.moveTo(GX(i),GY(0));c.lineTo(GX(i),GY(maxY));c.stroke();}
 const gridStep=maxY>20?5:1;for(let j=0;j<=maxY;j+=gridStep){c.beginPath();c.moveTo(GX(0),GY(j));c.lineTo(GX(maxX),GY(j));c.stroke();}
 c.strokeStyle=COL.axis;c.lineWidth=2;c.beginPath();c.moveTo(GX(maxX),GY(0));c.lineTo(GX(0),GY(0));c.lineTo(GX(0),GY(maxY));c.stroke();
 c.fillStyle=COL.muted;c.font='12px Outfit';c.textAlign='center';for(let i=0;i<=maxX;i+=2)c.fillText(i,GX(i),GY(0)+17);
 c.textAlign='right';const yStep=[1,2,5,10,20].find(step=>maxY/step<=8)||20;for(let j=0;j<=maxY;j+=yStep)c.fillText(j,GX(0)-7,GY(j)+4);
 c.textAlign='left';c.fillText('y (cm²)',GX(0)+4,GY(maxY)-5);c.fillText(model().time?'x (秒)':'x (cm)',GX(maxX)-37,GY(0)+32);
 const corners=[0];routeLengths().forEach(length=>corners.push(corners[corners.length-1]+length));c.strokeStyle=COL.grid;c.setLineDash([4,4]);corners.slice(1,-1).forEach(t=>{c.beginPath();c.moveTo(GX(t),GY(0));c.lineTo(GX(t),GY(maxY));c.stroke();});c.setLineDash([]);
 // 現在点からx軸・y軸への補助線。描画領域の外へ線を出さない。
 c.save();c.beginPath();c.rect(GX(0),GY(maxY),GX(maxX)-GX(0),GY(0)-GY(maxY));c.clip();
 c.strokeStyle=HC.x;c.lineWidth=1.5;c.setLineDash([5,4]);
 c.beginPath();c.moveTo(GX(x),GY(areaAt(x)));c.lineTo(GX(x),GY(0));
 c.moveTo(GX(x),GY(areaAt(x)));c.lineTo(GX(0),GY(areaAt(x)));c.stroke();
 c.setLineDash([]);c.restore();
 function path(points,col,width){c.strokeStyle=col;c.lineWidth=width;c.beginPath();points.forEach((t,i)=>{if(i===0)c.moveTo(GX(t),GY(areaAt(t)));else c.lineTo(GX(t),GY(areaAt(t)));});c.stroke();}
 path(corners,'rgba(249,115,22,.25)',2);path([...corners.filter(t=>t<x),x],COL.fire,3);dot(c,GX(x),GY(areaAt(x)),COL.ember,6);
}
// 線分図：道のり（台形は時間）を1本（台形は2本）の帯で表す。CSSの実サイズ×dprで描く。
const segCv=$('segCanvas'),sg=segCv?segCv.getContext('2d'):null;
function segFont(size,bold){return `${bold?'bold ':''}${size}px ${JP}`;}
function segBar(c,L,R,top,h,xr){
 c.save();rrect(c,L,top,R-L,h,h/2);c.clip();c.fillStyle='#e2e8f0';c.fillRect(L,top,R-L,h);
 c.strokeStyle='#a3adbb';c.lineWidth=1;c.beginPath();for(let i=L-h;i<R;i+=5){c.moveTo(i,top+h);c.lineTo(i+h,top);}c.stroke();
 c.fillStyle=HC.x;c.fillRect(L,top,Math.max(0,xr-L),h);c.restore();
}
function drawSeg(){
 if(!segOn||!sg)return;
 const dpr=window.devicePixelRatio||1,w=segCv.clientWidth,h=segCv.clientHeight;if(!w||!h)return;
 const bw=Math.round(w*dpr),bh=Math.round(h*dpr);if(segCv.width!==bw||segCv.height!==bh){segCv.width=bw;segCv.height=bh;}
 const c=sg,T=totalLen(),lens=routeLengths(),ph=phaseOf(x),m=model(),route=m.route,ends=[0],big=h>=68;lens.forEach(l=>ends.push(ends[ends.length-1]+l));
 const L=m.time?30:14,R=w-14,X=t=>L+(R-L)*t/T,xr=X(Math.max(0,Math.min(T,x))),cur=i=>i===ph||i===ph+1;
 c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.textAlign='center';c.textBaseline='alphabetic';
 const vline=(t,top,bh)=>{c.strokeStyle='#334155';c.lineWidth=1.5;c.beginPath();c.moveTo(X(t),top-3);c.lineTo(X(t),top+bh+2);c.stroke();};
 // 帯の上：頂点名（いまの区間は太字）と辺の長さ。
 const names=(list,y)=>{list.forEach((nm,i)=>{c.font=segFont(11,cur(i));c.fillStyle=cur(i)?COL.ink:'#94a3b8';c.fillText(nm,X(ends[i]),y);});c.font=segFont(10);c.fillStyle=COL.muted;lens.forEach((l,i)=>{const t=`${l} cm`;const tw=c.measureText(t).width,cx=(X(ends[i])+X(ends[i+1]))/2;if(tw+22<X(ends[i+1])-X(ends[i])&&Math.abs(cx-xr)>tw/2+8)c.fillText(t,cx,y);});};
 const ticks=y=>{let lastR=-Infinity;ends.forEach((t,i)=>{c.font=segFont(10,cur(i));const tw=c.measureText(String(t)).width;if(X(t)-tw/2<lastR+3)return;c.fillStyle=cur(i)?COL.ink:COL.muted;c.fillText(String(t),X(t),y);lastR=X(t)+tw/2;});};
 const now=`いま：${ends[ph]}≦x≦${ends[ph+1]}`;
 if(m.time){
  const pt=14,bh=big?8:7,yT=big?33:32,qt=big?38:37,yN=h-6,q=Math.max(0,Math.min(T,x));
  c.font=segFont(12,true);c.textAlign='left';c.fillStyle=COL.ember;c.fillText('P',8,pt+bh/2+4);c.fillStyle=COL.q;c.fillText('Q',8,qt+bh/2+4);c.textAlign='center';
  segBar(c,L,R,pt,bh,xr);segBar(c,L,R,qt,bh,X(q));ends.forEach(t=>vline(t,pt,bh));[0,T].forEach(t=>vline(t,qt,bh));
  names(route,10);ticks(yT);
  dot(c,xr,pt+bh/2,COL.ember,5);dot(c,X(q),qt+bh/2,COL.q,5);
  c.font=segFont(11,true);c.fillStyle=COL.ink;c.fillText('B',L,yN);c.fillText('C',R,yN);
  const room=R-L-30;let info=`${now}　P・Qとも秒速1 cm`;if(c.measureText(info).width>room)info=`${now}　秒速1 cm`;if(c.measureText(info).width>room)info=now;
  c.fillStyle='#5b21b6';c.fillText(info,(L+R)/2,yN);
 }else{
  const top=15,bh=big?11:9,yT=top+bh+11,yB=yT+(big?9:8),yN=h-5;
  segBar(c,L,R,top,bh,xr);ends.forEach(t=>vline(t,top,bh));names(route,10);ticks(yT);dot(c,xr,top+bh/2,COL.ember,5);
  // 下の括弧：0〜xは「x」、x〜終点は「残り」。狭いときは文字を省く。
  c.textBaseline='middle';
  const brace=(a,b,text,alt,col)=>{if(b-a<2)return;c.font=segFont(10,true);let t=text;if(c.measureText(t).width+10>b-a)t=alt;if(t&&c.measureText(t).width+10>b-a)t='';const tw=t?c.measureText(t).width+6:0,mid=(a+b)/2;c.strokeStyle=col;c.lineWidth=1.5;c.beginPath();c.moveTo(a+1,yB-4);c.lineTo(a+1,yB);c.lineTo(mid-tw/2,yB);c.moveTo(mid+tw/2,yB);c.lineTo(b-1,yB);c.lineTo(b-1,yB-4);c.stroke();if(t){c.fillStyle=col;c.fillText(t,mid,yB+1);}};
  brace(L,xr,'x','x',HC.x);brace(xr,R,`残り(${T}${MINUS}x)`,'残り',HC.rest);
  c.textBaseline='alphabetic';c.textAlign='left';c.font=segFont(11,true);c.fillStyle='#5b21b6';const info=`${now}（辺${route[ph]}${route[ph+1]}）`;c.fillText(info,L-6,yN);
  const all=`全体 ${T} cm`;c.font=segFont(10);if(L-6+c.measureText(info).width+16+c.measureText(all).width<R+6){c.textAlign='right';c.fillStyle=COL.muted;c.fillText(all,R+6,yN);}
 }
 c.textAlign='left';
 const label=m.time?`線分図：PはD→A→D、QはB→C、ともに全体${T}秒。いま${fmt(x)}秒、${now}`:`線分図：道のり全体${T} cm、x＝${fmt(x)} cm、残り${fmt(T-x)} cm、${now}`;
 if(segCv.getAttribute('aria-label')!==label)segCv.setAttribute('aria-label',label);
}
function update(){
 const ph=phaseOf(x),area=areaAt(x),m=model(),edge=m.route[ph]+m.route[ph+1];
 $('xOut').textContent=fmt(x);
 $('readout').innerHTML=`${m.area}の面積 <b>${fmt(area)} cm²</b><br>${m.time?'Pは辺AD上 ／ Qは辺BC上':`いまは <b>辺${edge}上</b>`}`;
 drawRect();drawSeg();if($('showGraph').checked)drawGraph();
}
function stop(){playing=false;if(raf!==null)cancelAnimationFrame(raf);raf=null;last=null;$('playBtn').textContent='▶ 再生';}
function loop(ts){
 raf=null;if(!playing)return;if(last===null)last=ts;const dt=Math.min((ts-last)/1000,0.1);last=ts;x=Math.min(totalLen(),x+dt*(model().time?1:2)*speed);$('xSlider').value=x;update();if(x>=totalLen())stop();else raf=requestAnimationFrame(loop);
}
$('playBtn').onclick=()=>{if(playing){stop();return;}if(x>=totalLen()){x=0;$('xSlider').value=0;update();}playing=true;last=null;$('playBtn').textContent='⏸ 一時停止';raf=requestAnimationFrame(loop);};
$('resetBtn').onclick=()=>{stop();x=0;$('xSlider').value=0;update();};
$('speed').oninput=e=>{speed=Number(e.target.value);};
$('xSlider').oninput=e=>{stop();x=Math.max(0,Math.min(totalLen(),Number(e.target.value)||0));update();};
function setSize(){W=Number($('wSlider').value);H=Number($('hSlider').value);$('wOut').textContent=W;$('hOut').textContent=H;$('bOut').textContent=2*W;$('xSlider').max=totalLen();x=Math.min(x,totalLen());$('xSlider').value=x;update();}
$('wSlider').oninput=setSize;$('hSlider').oninput=setSize;
$('problemSelect').onchange=e=>{stop();problem=Object.hasOwn(PROBLEMS,e.target.value)?e.target.value:'original';x=0;$('xSlider').value=0;$('wSlider').value=model().initial[0];$('hSlider').value=model().initial[1];syncProblemLabels();setSize();};
function syncGraphVisibility(){const visible=$('showGraph').checked;$('graphWrap').hidden=!visible;$('axisNote').hidden=!visible;$('graphPlaceholder').hidden=visible;if(visible)drawGraph();}
$('showGraph').onchange=syncGraphVisibility;
document.querySelectorAll('input[name=hintLevel]').forEach(r=>{r.onchange=e=>{if(!e.target.checked)return;hintLevel=['none','name','len'].includes(e.target.value)?e.target.value:'none';rectCv.closest('.workspace').classList.toggle('hint-on',hintLevel!=='none');update();};});
function syncSeg(){segOn=$('segToggle').checked;$('segWrap').hidden=!segOn;rectCv.closest('.stage').classList.toggle('seg-on',segOn);drawSeg();}
$('segToggle').onchange=syncSeg;
// 表示サイズが変わったら描き直す（ラベルの文字サイズ・線分図の解像度）。
if(typeof ResizeObserver==='function'){new ResizeObserver(()=>drawRect()).observe(rectCv);if(segCv)new ResizeObserver(()=>drawSeg()).observe(segCv);}else window.addEventListener('resize',()=>{drawRect();drawSeg();});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{drawRect();drawSeg();}).catch(()=>{});
syncProblemLabels();syncGraphVisibility();syncSeg();update();
})();
