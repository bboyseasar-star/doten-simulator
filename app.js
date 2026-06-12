'use strict';
(function(){
const COL={ink:'#1f2937',muted:'#94a3b8',grid:'#fde7cf',axis:'#9aa0aa',blue:'#2563eb',ember:'#ef4444',fire:'#f97316',green:'#16a34a',triFill:'rgba(249,115,22,.28)',triLine:'#f97316'};
const $=id=>document.getElementById(id);

let W=4, H=3;                 // AB(横), AD(縦)
let x=0;                      // 道のり
let playing=false, speed=1, raf=null, last=0;

const rectCv=$('rectCanvas'), rg=rectCv.getContext('2d');
const grCv=$('graphCanvas'), gg=grCv.getContext('2d');

// 道のり x → P座標(矩形描画座標系: cm単位、A原点、Bは右、Cは右上、Dは左上)
function totalLen(){ return W+H+W; }     // A→B→C→D
function phaseOf(x){ if(x<=W) return 0; if(x<=W+H) return 1; return 2; }
function pAt(x){
  if(x<=W) return {x:x, y:0};            // AB上：(t,0)
  if(x<=W+H) return {x:W, y:x-W};        // BC上：(W, s)
  return {x:W-(x-W-H), y:H};             // CD上：(W-u, H)
}
function areaAt(x){
  // △APD 面積 = 1/2 * AD(=H) * (Pのx座標)
  return 0.5*H*pAt(x).x;
}
function eqText(ph){
  const a=(H/2);
  if(ph===0) return `y = ${fmt(a)}x`;
  if(ph===1) return `y = ${fmt(a*W)}（一定・傾き0）`;
  // 区間③：y = a*(2W+H - x)
  return `y = ${fmt(a)}(${fmt(2*W+H)} − x)`;
}
function fmt(n){ return Number.isInteger(n)?n:(+n.toFixed(2)); }

/* ---------- 左：長方形 ---------- */
function drawRect(){
  const c=rg, cw=rectCv.width, ch=rectCv.height, pad=46;
  c.clearRect(0,0,cw,ch);
  const sx=(cw-2*pad)/Math.max(W,1)/1.0, sy=(ch-2*pad)/Math.max(H,1);
  const s=Math.min(sx,sy);
  // 矩形のピクセル原点（左下=A）
  const ox=pad, oy=ch-pad;
  const PX=(mx)=>ox+mx*s, PY=(my)=>oy-my*s;
  // 三角形 APD の塗り（A=(0,0), P, D=(0,H)）
  const p=pAt(x);
  c.fillStyle=COL.triFill; c.strokeStyle=COL.triLine; c.lineWidth=2;
  c.beginPath(); c.moveTo(PX(0),PY(0)); c.lineTo(PX(p.x),PY(p.y)); c.lineTo(PX(0),PY(H)); c.closePath(); c.fill(); c.stroke();
  // 長方形
  c.strokeStyle=COL.ink; c.lineWidth=2.5;
  c.strokeRect(PX(0),PY(H),W*s,H*s);
  // 頂点ラベル
  c.fillStyle=COL.blue; c.font='bold 15px Outfit';
  label(c,'A',PX(0),PY(0),-14,18); label(c,'D',PX(0),PY(H),-14,-8);
  c.fillStyle=COL.ink; label(c,'B',PX(W),PY(0),8,18); label(c,'C',PX(W),PY(H),8,-8);
  // 頂点点
  dot(c,PX(0),PY(0),COL.blue); dot(c,PX(0),PY(H),COL.blue);
  // 動点P
  dot(c,PX(p.x),PY(p.y),COL.ember,7);
  c.fillStyle=COL.ember; c.font='bold 16px Outfit'; c.fillText('P',PX(p.x)+9,PY(p.y)-9);
  // 辺の長さ
  c.fillStyle=COL.muted; c.font='12px Outfit';
  c.fillText(`AB=${W}`, PX(W/2)-14, PY(0)+34);
  c.save(); c.translate(PX(0)-30,PY(H/2)); c.rotate(-Math.PI/2); c.fillText(`AD=${H}`,-14,0); c.restore();
}
function dot(c,x,y,col,r=5){ c.fillStyle=col; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); c.strokeStyle='#fff'; c.lineWidth=2; c.stroke(); }
function label(c,t,x,y,dx,dy){ c.fillText(t,x+dx,y+dy); }

/* ---------- 右：面積グラフ ---------- */
function drawGraph(){
  const c=gg, cw=grCv.width, ch=grCv.height, pad=42;
  c.clearRect(0,0,cw,ch);
  const maxX=totalLen(), maxY=0.5*H*W*1.15;
  const GX=mx=>pad+mx/maxX*(cw-pad-14);
  const GY=my=>ch-pad-my/maxY*(ch-pad-16);
  // grid
  c.strokeStyle=COL.grid; c.lineWidth=1;
  for(let i=0;i<=maxX;i++){ c.beginPath(); c.moveTo(GX(i),GY(0)); c.lineTo(GX(i),GY(maxY)); c.stroke(); }
  for(let j=0;j<=maxY;j+=2){ c.beginPath(); c.moveTo(GX(0),GY(j)); c.lineTo(GX(maxX),GY(j)); c.stroke(); }
  // axes
  c.strokeStyle=COL.axis; c.lineWidth=2;
  c.beginPath(); c.moveTo(GX(0),GY(0)); c.lineTo(GX(maxX),GY(0)); c.stroke();
  c.beginPath(); c.moveTo(GX(0),GY(0)); c.lineTo(GX(0),GY(maxY)); c.stroke();
  c.fillStyle=COL.muted; c.font='12px Outfit'; c.textAlign='center';
  for(let i=0;i<=maxX;i+=2) c.fillText(i,GX(i),GY(0)+16);
  c.textAlign='right'; for(let j=0;j<=maxY;j+=4) c.fillText(j,GX(0)-6,GY(j)+4);
  c.textAlign='left'; c.fillText('y(cm²)',GX(0)+4,GY(maxY)-4); c.fillText('x(cm)',GX(maxX)-34,GY(0)+30);
  // 折れ線（区切り点）
  const xs=[0,W,W+H,maxX];
  c.strokeStyle=COL.grid; c.setLineDash([4,4]);
  xs.forEach(xx=>{ c.beginPath(); c.moveTo(GX(xx),GY(0)); c.lineTo(GX(xx),GY(maxY)); c.stroke(); }); c.setLineDash([]);
  // 既に通った部分を描く（x まで）
  c.strokeStyle=COL.fire; c.lineWidth=3; c.beginPath();
  let started=false;
  for(let t=0;t<=x+1e-9;t+=0.05){ const px=GX(t),py=GY(areaAt(t)); if(!started){c.moveTo(px,py);started=true;}else c.lineTo(px,py); }
  c.lineTo(GX(x),GY(areaAt(x))); c.stroke();
  // うすく全体（未来）
  c.strokeStyle='rgba(249,115,22,.25)'; c.lineWidth=2; c.beginPath(); started=false;
  for(let t=0;t<=maxX+1e-9;t+=0.05){ const px=GX(t),py=GY(areaAt(t)); if(!started){c.moveTo(px,py);started=true;}else c.lineTo(px,py); } c.stroke();
  // 現在点
  dot(c,GX(x),GY(areaAt(x)),COL.ember,6);
}

/* ---------- 更新 ---------- */
function update(){
  const ph=phaseOf(x), area=areaAt(x), p=pAt(x);
  $('xOut').textContent=x.toFixed(1);
  $('eqNow').textContent='区間'+['①','②','③'][ph]+'：'+eqText(ph);
  $('readout').innerHTML=`P の位置：(${fmt(p.x)}, ${fmt(p.y)})　／　△APD の面積 <b>y = ${fmt(area)} cm²</b>　／　いまは <b>区間${['①','②','③'][ph]}</b>（${['辺AB上','辺BC上','辺CD上'][ph]}）`;
  document.querySelectorAll('.phase').forEach((el,i)=>el.classList.toggle('active',i===ph));
  $('ph0').textContent='y = '+fmt(H/2)+'x（増加）';
  $('ph1').textContent='y = '+fmt(H/2*W)+'（一定）';
  $('ph2').textContent='y = '+fmt(H/2)+'('+fmt(2*W+H)+'−x)（減少）';
  drawRect(); drawGraph();
}

/* ---------- アニメ ---------- */
function loop(ts){
  if(!playing) return;
  if(!last) last=ts;
  const dt=(ts-last)/1000; last=ts;
  x+=dt*2*speed;
  if(x>=totalLen()){ x=totalLen(); playing=false; $('playBtn').textContent='▶ 再生'; }
  $('xSlider').value=x; update();
  if(playing) raf=requestAnimationFrame(loop);
}
$('playBtn').onclick=()=>{
  if(x>=totalLen()) x=0;
  playing=!playing;
  $('playBtn').textContent=playing?'⏸ 一時停止':'▶ 再生';
  last=0; if(playing) raf=requestAnimationFrame(loop);
};
$('resetBtn').onclick=()=>{ playing=false; $('playBtn').textContent='▶ 再生'; x=0; $('xSlider').value=0; update(); };
$('speed').oninput=e=>speed=+e.target.value;
$('xSlider').oninput=e=>{ playing=false; $('playBtn').textContent='▶ 再生'; x=+e.target.value; update(); };
function setSize(){
  W=+$('wSlider').value; H=+$('hSlider').value;
  $('wOut').textContent=W; $('hOut').textContent=H;
  $('xSlider').max=totalLen(); if(x>totalLen()) x=totalLen(); $('xSlider').value=x;
  update();
}
$('wSlider').oninput=setSize; $('hSlider').oninput=setSize;

update();
})();
