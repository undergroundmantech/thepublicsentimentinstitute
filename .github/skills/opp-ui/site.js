// OnPoint Politics mock behavior, verbatim. Port into React hooks.
(function(){
  var $=function(s,r){return (r||document).querySelector(s)};var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  // tabs
  var tabs=$$('.tab');function show(v){tabs.forEach(function(t){t.setAttribute('aria-selected',t.dataset.view===v)});$$('.view').forEach(function(x){x.classList.toggle('on',x.id==='view-'+v)});window.scrollTo(0,0)}
  tabs.forEach(function(t){t.addEventListener('click',function(){show(t.dataset.view);try{history.replaceState(null,'','#'+t.dataset.view)}catch(e){}})});
  var h=(location.hash||'').replace('#','');if(['home','map','brand'].indexOf(h)>-1)show(h);

  // count up + bars
  function countUp(el){var end=parseFloat(el.dataset.count),pre=el.dataset.prefix||'',suf=el.dataset.suffix||'',dec=(String(el.dataset.count).split('.')[1]||'').length,t0=null;function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/1400);p=1-Math.pow(1-p,3);el.textContent=pre+(end*p).toFixed(dec)+suf;if(p<1)requestAnimationFrame(step)}requestAnimationFrame(step)}
  $$('[data-count]').forEach(countUp);
  setTimeout(function(){$$('[data-w]').forEach(function(i){i.style.width=i.dataset.w+'%'})},150);

  // ticker
  var tick=[['OH Sen','Brown','d','D +5.2'],['TX Sen','Paxton','r','R +3.2'],['MI Sen','El-Sayed','d','D +4.2'],['IA Sen','Turek','d','D +3.5'],['FL Gov','Donalds','r','R +1.0'],['GA Gov','Bottoms','d','D +0.9'],['NE Sen','Osborn','i','I +0.8'],['ME Sen','Jackson','d','D +4.3'],['SC Sen','Graham','r','R +1.2'],['OH Gov','Acton','d','D +2.5'],['NC Sen','Cooper','d','D +1.2'],['AK Sen','Sullivan','r','R +2.1']];
  var th=tick.map(function(t){return '<span><b>'+t[0]+'</b>'+t[1]+' <i class="'+t[2]+'">'+t[3]+'</i></span>'}).join('');$('#ticker').innerHTML=th+th;

  // tooltip
  var tip=$('#tip');function showTip(html,e){tip.innerHTML=html;tip.style.display='block';moveTip(e)}function moveTip(e){var x=e.clientX+14,y=e.clientY+14;if(x+240>innerWidth)x=e.clientX-250;if(y+120>innerHeight)y=e.clientY-120;tip.style.left=x+'px';tip.style.top=y+'px'}function hideTip(){tip.style.display='none'}
  window.addEventListener('scroll',hideTip,{passive:true});

  var C={safeD:'#1a3fb0',likelyD:'#3d7bff',leanD:'#a6c2ff',toss:'#e7b341',leanR:'#ffb3c0',likelyR:'#ff3b5c',safeR:'#b0163a',ind:'#b78cff',none:'rgba(255,255,255,.08)'};
  function rating(m,ind){if(ind)return 'ind';var a=Math.abs(m);if(a<2)return'toss';var s=m<0?'D':'R';return (a<6?'lean':a<12?'likely':'safe')+s}
  function ratingLabel(r){return {safeD:'Safe D',likelyD:'Likely D',leanD:'Lean D',toss:'Toss up',leanR:'Lean R',likelyR:'Likely R',safeR:'Safe R',ind:'Lean I',none:'No race'}[r]}
  function last(n){return n.split(' ').pop()}
  function fmtM(m,r){var a=Math.abs(m).toFixed(1);if(r&&r.ind)return 'I +'+a;return (m<0?'D +':'R +')+a}

  var STATES=null,RACES=null,office='senate';
  function isInd(r){return r&&r.cands&&r.cands[0]&&r.cands[0].party==='IND'&&r.m<0}

  function drawUS(){
    if(!STATES||!RACES)return;var svg=$('#usmap'),s='',i=0;var races=RACES[office];
    Object.keys(STATES.states).forEach(function(st){var p=STATES.states[st];var r=races[st];var rt=r?rating(r.m,isInd(r)):'none';
      s+='<path data-st="'+st+'" d="'+p.d+'" fill="'+C[rt]+'" style="animation-delay:'+(i*12)+'ms"></path>';i++});
    Object.keys(STATES.states).forEach(function(st){var p=STATES.states[st];if(['DC','RI','DE','CT','NJ','MD','MA','NH','VT','HI'].indexOf(st)>-1)return;var rr=races[st],rt2=rr?rating(rr.m,isInd(rr)):'none';var dark=(rt2==='leanD'||rt2==='leanR'||rt2==='toss');s+='<text x="'+p.c[0]+'" y="'+(p.c[1]+3)+'"'+(dark?' style="fill:#1a1030"':'')+'>'+st+'</text>'});
    svg.innerHTML=s;
    $$('path',svg).forEach(function(p){p.addEventListener('mousemove',function(e){var st=p.dataset.st,r=races[st];if(!r){showTip('<b>'+st+'</b><div class="row"><span>No '+office+' race in 2026</span></div>',e);return}
      var rt=rating(r.m,isInd(r));showTip('<b>'+r.name+'</b><div class="row"><span style="color:var(--dem2)">'+r.dem+'</span><span></span></div><div class="row"><span style="color:var(--gop2)">'+r.gop+'</span><span></span></div><div class="row" style="margin-top:6px"><span>Model</span><span>'+fmtM(r.m,{ind:isInd(r)})+'</span></div>'+(r.poll!=null?'<div class="row"><span>Polls</span><span>'+fmtM(r.poll)+'</span></div>':'')+'<div class="row"><span>Rating</span><span style="color:'+C[rt]+'">'+ratingLabel(rt)+'</span></div>',e)});
      p.addEventListener('mouseleave',hideTip);
      p.addEventListener('click',function(){var st=p.dataset.st;if(office==='senate'&&['OH','TX','MI','GA'].indexOf(st)>-1)pickState(st);if(office==='governor'&&st==='FL')pickState('FL')})});
    drawHist();drawWatch();
  }
  function drawHist(){var ch=RACES.chambers[office];var tot=ch.seatsTotal;$('#hist-title').textContent=office==='senate'?'Senate seats':'Governorships';
    $('#seat-d').textContent=ch.demSeats.toFixed(1)+' D';$('#seat-r').textContent=ch.gopSeats.toFixed(1)+' R';
    var races=RACES[office],cnt={safeD:0,likelyD:0,leanD:0,toss:0,leanR:0,likelyR:0,safeR:0,ind:0};Object.keys(races).forEach(function(k){cnt[rating(races[k].m,isInd(races[k]))]++});
    var up=Object.keys(races).length;var notD=office==='senate'?RACES.meta.senNotUpD:RACES.meta.govNotUpD,notR=office==='senate'?RACES.meta.senNotUpR:RACES.meta.govNotUpR;
    var segs=[['safeD',notD+cnt.safeD],['likelyD',cnt.likelyD],['leanD',cnt.leanD],['ind',cnt.ind],['toss',cnt.toss],['leanR',cnt.leanR],['likelyR',cnt.likelyR],['safeR',cnt.safeR+notR]];
    $('#seatbar').innerHTML=segs.map(function(x){return '<i style="background:'+C[x[0]]+'" data-w="'+(x[1]/tot*100)+'"></i>'}).join('');setTimeout(function(){$$('#seatbar i').forEach(function(i){i.style.width=i.dataset.w+'%'})},50);
    var hist=ch.hist.slice().sort(function(a,b){return a[0]-b[0]});var max=Math.max.apply(null,hist.map(function(x){return x[1]}));var W=320,H=120,pad=18,bw=(W-2*pad)/hist.length;var s='';var maj=Math.floor(tot/2)+1;
    hist.forEach(function(x,i){var hh=(x[1]/max)*(H-34);var demSeats=x[0];var col=demSeats>=maj?'#3d7bff':demSeats===maj-1&&tot%2===0?'#e7b341':'#ff3b5c';s+='<rect x="'+(pad+i*bw+1)+'" y="'+(H-22-hh)+'" width="'+(bw-2)+'" height="'+hh+'" rx="2" fill="'+col+'" opacity=".9"><title>'+demSeats+' D seats: '+(x[1]*100).toFixed(1)+'%</title></rect>';if(i%3===0)s+='<text x="'+(pad+i*bw+bw/2)+'" y="'+(H-8)+'" text-anchor="middle" style="font:500 9px JetBrains Mono,monospace;fill:#8e86a3">'+demSeats+'</text>'});
    s+='<text x="'+pad+'" y="10" style="font:600 9px Manrope,sans-serif;fill:#8e86a3;letter-spacing:.1em">DEM SEATS, SHARE OF SIMULATIONS</text>';$('#hist').innerHTML=s}
  function drawWatch(){var races=RACES[office];var list=Object.keys(races).map(function(k){return [k,races[k]]}).sort(function(a,b){return Math.abs(a[1].m)-Math.abs(b[1].m)}).slice(0,7);
    $('#watch').innerHTML=list.map(function(x){var st=x[0],r=x[1],ind=isInd(r);var cls=ind?'i':r.m<0?'d':'r';var lead=r.m<0?r.dem:r.gop;return '<div class="race" data-st="'+st+'"><span class="st">'+st+'</span><span class="who"><b>'+r.dem+'</b> vs <b>'+r.gop+'</b><small>'+(office==='senate'?'Senate':'Governor')+(r.open?', open seat':'')+'</small></span><span class="mg '+cls+'">'+fmtM(r.m,{ind:ind})+'<small>'+last(lead)+'</small></span></div>'}).join('');
    $$('#watch .race').forEach(function(el){el.addEventListener('click',function(){var st=el.dataset.st;if(['OH','TX','MI','GA'].indexOf(st)>-1&&office==='senate')pickState(st);if(st==='FL'&&office==='governor')pickState('FL')})})}
  $$('#mapseg button').forEach(function(b){b.addEventListener('click',function(){$$('#mapseg button').forEach(function(x){x.classList.toggle('on',x===b)});office=b.dataset.office;drawUS()})});

  // county map
  var CCACHE={};function marginColor(m){var a=Math.min(40,Math.abs(m))/40;function mix(c1,c2,t){return 'rgb('+c1.map(function(v,i){return Math.round(v+(c2[i]-v)*t)}).join(',')+')'}return m<0?mix([214,226,255],[16,40,140],a):mix([255,220,228],[140,10,40],a)}
  function pickState(st){$$('#statepick button').forEach(function(b){b.classList.toggle('on',b.dataset.st===st)});var el=$('#county');if(el&&window.scrollY>el.offsetTop+300)el.scrollIntoView({behavior:'smooth',block:'start'});
    if(CCACHE[st]){drawCounty(CCACHE[st]);return}fetch('data/'+st.toLowerCase()+'.json').then(function(r){return r.json()}).then(function(d){CCACHE[st]=d;drawCounty(d)}).catch(function(){})}
  function drawCounty(d){var b=d.box,W=900,H=620,sc=Math.min((W-20)/(b[2]-b[0]),(H-20)/(b[3]-b[1])),ox=(W-(b[2]-b[0])*sc)/2-b[0]*sc,oy=(H-(b[3]-b[1])*sc)/2-b[1]*sc;
    var svg=$('#cmap'),s='<g transform="translate('+ox+','+oy+') scale('+sc+')">';d.counties.forEach(function(c,i){s+='<path d="'+c.d+'" fill="'+marginColor(c.m||0)+'" data-i="'+i+'" style="stroke-width:'+(1/sc)+';animation-delay:'+(i*4)+'ms"></path>'});svg.innerHTML=s+'</g>';
    $$('path',svg).forEach(function(p){p.addEventListener('mousemove',function(e){var c=d.counties[p.dataset.i];showTip('<b>'+c.n+' County</b><div class="row"><span>Simulated margin</span><span style="color:'+(c.m<0?'var(--dem2)':'var(--gop2)')+'">'+fmtM(c.m)+'</span></div><div class="row"><span>Simulated votes</span><span>'+(c.t||0).toLocaleString()+'</span></div>',e)});p.addEventListener('mouseleave',hideTip)});
    var r=RACES[d.race.indexOf('gov')===0?'governor':'senate'][d.st];var names={OH:'Ohio Senate',TX:'Texas Senate',MI:'Michigan Senate',GA:'Georgia Senate',FL:'Florida Governor'};
    $('#c-title').textContent=names[d.st];$('#c-count').textContent=d.counties.length+' counties';var rt=rating(r.m,isInd(r));var pill=$('#c-pill');pill.textContent=ratingLabel(rt);pill.className='pill '+(rt==='toss'?'t':rt==='ind'?'i':rt.slice(-1).toLowerCase());
    var lead=r.m<0?r.dem:r.gop;var cm=$('#c-margin');cm.textContent=last(lead)+' +'+Math.abs(r.m).toFixed(1);cm.className='v '+(r.m<0?'d':'r');
    $('#c-poll').textContent=r.poll!=null?(r.poll<0?last(r.dem):last(r.gop))+' +'+Math.abs(r.poll).toFixed(1):'No public polls yet';
    $('#c-cands').innerHTML=(r.cands||[]).slice(0,3).map(function(c){var col=c.party==='D'?'var(--dem)':c.party==='R'?'var(--gop)':c.party==='IND'?'var(--ind)':'#666';return '<div class="cand"><i style="background:'+col+'"></i><span>'+c.name+'</span><span class="p">'+c.pct.toFixed(1)+'%</span></div>'}).join('');
    var top=d.counties.slice().sort(function(a,b){return (b.t||0)-(a.t||0)}).slice(0,5);$('#c-top').innerHTML=top.map(function(c){return '<div class="cand"><i style="background:'+marginColor(c.m)+'"></i><span>'+c.n+'</span><span class="p" style="color:'+(c.m<0?'var(--dem2)':'var(--gop2)')+'">'+fmtM(c.m)+'</span></div>'}).join('')}
  $$('#statepick button').forEach(function(b){b.addEventListener('click',function(){pickState(b.dataset.st)})});

  // mini maps in stories
  function mini(st,gid){fetch('data/'+st+'.json').then(function(r){return r.json()}).then(function(d){var b=d.box,W=320,H=180,sc=Math.min((W-30)/(b[2]-b[0]),(H-20)/(b[3]-b[1])),ox=(W-(b[2]-b[0])*sc)/2-b[0]*sc,oy=(H-(b[3]-b[1])*sc)/2-b[1]*sc;var s='<g transform="translate('+ox+','+oy+') scale('+sc+')">';d.counties.forEach(function(c){s+='<path d="'+c.d+'" fill="'+marginColor(c.m||0)+'" stroke="#120820" stroke-width="'+(1/sc)+'"/>'});$('#'+gid).innerHTML=s+'</g>';CCACHE[st.toUpperCase()]=d}).catch(function(){})}
  mini('oh','ohmini');mini('fl','flmini');

  // charts
  function chart(id,o){var svg=$('#'+id);if(!svg)return;var W=600,H=220,pl=38,pr=16,pt=14,pb=26,n=o.n||150,seed=o.seed;function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}var pts=[];for(var i=0;i<n;i++){var t=i/(n-1);var base=o.start+(o.end-o.start)*(t<.5?t*1.3:0.65+(t-.5)*0.7)+Math.sin(t*9)*.8;pts.push({t:t,y:base,p:base+(rnd()-.5)*o.noise})}
    function X(t){return pl+t*(W-pl-pr)}function Y(v){return pt+(o.hi-v)/(o.hi-o.lo)*(H-pt-pb)}var s='';o.ticks.forEach(function(v){s+='<line class="grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text x="'+(pl-8)+'" y="'+(Y(v)+3)+'" text-anchor="end">'+o.fmt(v)+'</text>'});
    ['Jan','Mar','May','Jul','Sep'].forEach(function(m,i){s+='<text x="'+X(i/4.4)+'" y="'+(H-8)+'">'+m+'</text>'});
    s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 4"/>';
    pts.forEach(function(p,i){s+='<circle class="dot" cx="'+X(p.t)+'" cy="'+Y(p.p)+'" r="2.4" fill="'+o.color+'" opacity=".3" style="animation-delay:'+(i*8)+'ms"/>'});
    var band='';pts.forEach(function(p,i){band+=(i?'L':'M')+X(p.t)+','+Y(p.y+1.4)});for(var j=pts.length-1;j>=0;j--)band+='L'+X(pts[j].t)+','+Y(pts[j].y-1.4);s+='<path d="'+band+'Z" fill="'+o.color+'" opacity=".14"/>';
    var line='';pts.forEach(function(p,i){line+=(i?'L':'M')+X(p.t)+','+Y(p.y)});s+='<path class="line" d="'+line+'" stroke="'+o.color+'"/>';
    var l=pts[pts.length-1];s+='<circle class="end" cx="'+X(l.t)+'" cy="'+Y(l.y)+'" r="4.5" fill="'+o.color+'" style="color:'+o.color+'"/><text x="'+(X(l.t)-8)+'" y="'+(Y(l.y)-10)+'" text-anchor="end" style="font-weight:700;fill:'+o.color+';font-size:12px">'+o.label+'</text>';svg.innerHTML=s}
  chart('ch-a',{start:-6,end:-14,lo:-22,hi:2,ticks:[0,-5,-10,-15,-20],color:'#ff3b5c',label:'-14.0',seed:7,noise:6,fmt:function(v){return v>0?'+'+v:v}});
  chart('ch-g',{start:3,end:10.6,lo:-4,hi:16,ticks:[15,10,5,0],color:'#3d7bff',label:'D +10.6',seed:3,noise:6,fmt:function(v){return v>0?'D+'+v:v===0?'0':'R+'+(-v)}});

  // countdown
  function cd(){var e=new Date('2026-11-03T19:00:00-05:00'),d=e-Date.now();if(d<0)return;var days=Math.floor(d/864e5),hrs=Math.floor(d%864e5/36e5),min=Math.floor(d%36e5/6e4);var b=$$('#countdown b');b[0].textContent=days;b[1].textContent=hrs;b[2].textContent=min}cd();setInterval(cd,30000);

  // load data
  Promise.all([fetch('data/states.json').then(function(r){return r.json()}),fetch('data/races.json').then(function(r){return r.json()})]).then(function(a){STATES=a[0];RACES=a[1];drawUS();pickState('OH')}).catch(function(e){$('#usmap').innerHTML='<text x="380" y="220" text-anchor="middle" style="fill:#8e86a3;font-size:14px">Map data could not be loaded</text>'});
})();
