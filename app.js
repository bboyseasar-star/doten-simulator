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
 $('explorationNote').textContent=m.time?'💡 2点の動きと面積の変わり方を調べよう。':'💡 辺ごとに面積の変わり方を調べよう。';
 $('linkedBase').hidden=!m.time;$('speedLabel').textContent=m.time?'再生速度':'速さ';
 $('speed').setAttribute('aria-label',m.time?'シミュレーターの再生速度':'点Pの移動速度');
 $('xLabel').textContent=m.time?'経過時間 x＝':'Pの位置（道のり x＝';$('xUnit').textContent=m.time?' 秒':' cm）';
 $('xSlider').setAttribute('aria-label',m.time?'経過時間':'点Pが動いた道のり');
 $('axisNote').textContent=m.time?'横軸：経過時間 x（秒）／ 縦軸：面積 y':'横軸：動いた道のり x ／ 縦軸：面積 y';
 rectCv.setAttribute('aria-label',`${m.shape}${Object.keys(vertices()).join('')}と動点${m.time?'P・Q':'P'}、${m.area}`);
 grCv.setAttribute('aria-label',`${m.time?'経過時間':'動いた道のり'}と${m.area}の面積のグラフ`);
}
function dot(c,px,py,col,r=5){c.fillStyle=col;c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();}
function drawRect(){
 const c=rg,cw=rectCv.width,ch=rectCv.height,pad=48,figureWidth=problem==='trapezoid'?2*W:W,s=Math.min((cw-2*pad)/figureWidth,(ch-2*pad)/H),ox=(cw-figureWidth*s)/2,oy=(ch+H*s)/2;
 const PX=mx=>ox+mx*s,PY=my=>oy-my*s,v=vertices(),p=pAt(x),m=model(),fixed=m.fixed.map(name=>v[name]);
 c.clearRect(0,0,cw,ch);c.fillStyle=COL.triFill;c.strokeStyle=COL.triLine;c.lineWidth=2;
 const shaded=m.time?[v.A,v.B,qAt(x),p]:[fixed[0],p,fixed[1]];
 c.beginPath();shaded.forEach((point,i)=>{if(i===0)c.moveTo(PX(point.x),PY(point.y));else c.lineTo(PX(point.x),PY(point.y));});c.closePath();c.fill();c.stroke();
 c.strokeStyle=COL.ink;c.lineWidth=2.5;c.beginPath();Object.values(v).forEach((point,i)=>{if(i===0)c.moveTo(PX(point.x),PY(point.y));else c.lineTo(PX(point.x),PY(point.y));});c.closePath();c.stroke();
 if(problem==='triangle'){
  const marker=Math.min(14,s*.25),bx=PX(W),by=PY(0);
  c.lineWidth=1.5;c.beginPath();c.moveTo(bx-marker,by);c.lineTo(bx-marker,by-marker);c.lineTo(bx,by-marker);c.stroke();
 }
 c.font='bold 16px Outfit';Object.entries(v).forEach(([name,point])=>{c.fillStyle=m.fixed.includes(name)?COL.blue:COL.ink;c.fillText(name,PX(point.x)+(point.x===0?-19:9),PY(point.y)+(point.y===0?22:-10));});
 fixed.forEach(point=>dot(c,PX(point.x),PY(point.y),COL.blue));dot(c,PX(p.x),PY(p.y),COL.ember,7);c.fillStyle=COL.ember;c.font='bold 16px Outfit';c.fillText('P',PX(p.x)+11,PY(p.y)+(p.y===H?20:-11));
 if(m.time){const q=qAt(x);dot(c,PX(q.x),PY(q.y),COL.q,7);c.fillStyle=COL.q;c.fillText('Q',PX(q.x)+(q.x===0?11:-18),PY(q.y)-12);}
 c.fillStyle=COL.muted;c.font='13px Outfit';c.textAlign='center';const top=problem==='textbook'||m.time;
 c.fillText(`${m.horizontal} = ${W} cm`,PX(W/2),PY(top?H:0)+(top?-29:39));
 if(m.time)c.fillText(`BC = ${2*W} cm`,PX(W),PY(0)+39);
 c.save();c.translate(problem==='triangle'?PX(W)+32:PX(0)-31,PY(H/2));c.rotate(-Math.PI/2);c.fillText(`${m.vertical} = ${H} cm`,0,0);c.restore();c.textAlign='left';
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
 // 現在点を通る補助線。端点でも描画領域の外へ線を出さない。
 c.save();c.beginPath();c.rect(GX(0),GY(maxY),GX(maxX)-GX(0),GY(0)-GY(maxY));c.clip();
 c.strokeStyle='#a855f7';c.lineWidth=1.5;c.setLineDash([5,4]);
 c.beginPath();c.moveTo(GX(x),GY(0));c.lineTo(GX(x),GY(maxY));
 c.moveTo(GX(0),GY(areaAt(x)));c.lineTo(GX(maxX),GY(areaAt(x)));c.stroke();
 c.setLineDash([]);c.restore();
 function path(points,col,width){c.strokeStyle=col;c.lineWidth=width;c.beginPath();points.forEach((t,i)=>{if(i===0)c.moveTo(GX(t),GY(areaAt(t)));else c.lineTo(GX(t),GY(areaAt(t)));});c.stroke();}
 path(corners,'rgba(249,115,22,.25)',2);path([...corners.filter(t=>t<x),x],COL.fire,3);dot(c,GX(x),GY(areaAt(x)),COL.ember,6);
}
function update(){
 const ph=phaseOf(x),area=areaAt(x),m=model(),edge=m.route[ph]+m.route[ph+1];
 $('xOut').textContent=fmt(x);
 $('readout').innerHTML=`${m.area}の面積 <b>${fmt(area)} cm²</b><br>${m.time?'Pは辺AD上 ／ Qは辺BC上':`いまは <b>辺${edge}上</b>`}`;
 drawRect();if($('showGraph').checked)drawGraph();
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
syncProblemLabels();syncGraphVisibility();update();
})();
