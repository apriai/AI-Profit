(async()=>{const t=window.TradingView.bottomWidgetBar._widgetControllers.get('paper_trading')._trading,ab=t.activeBroker();const wv=x=>x&&typeof x.value==='function'?x.value():x;
const ms=()=>{try{return window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries()}catch(e){return null}};
const ev=[];const T0=performance.now();const f=p=>{if(p&&/NQ/.test(p.symbol))ev.push({t:Math.round(performance.now()-T0),u:p.unrealizedPl,pl:p.pl})};let sub=false;try{ab.positionUpdate.subscribe(null,f);sub=true}catch(e){}
const out=[];for(let i=0;i<11;i++){let ps=[];try{ps=(await ab.positions())||[]}catch(e){}const p=ps.find(x=>x&&Number(x.qty)!==0);let c=null;try{c=ms().bars().last().value[4]}catch(e){}
let cpl=null;if(p&&c!=null){const pv=/(^|:)MNQ/.test(p.symbol)?2:20;cpl=Math.round((c-p.avgPrice)*(p.side===1?1:-1)*pv*Math.abs(p.qty)*100)/100}
out.push({t:Math.round(performance.now()-T0),sym:p&&p.symbol,side:p&&p.side,qty:p&&p.qty,avg:p&&p.avgPrice,u:p&&p.unrealizedPl,pl:p&&p.pl,close:c,chartPl:cpl});await new Promise(z=>setTimeout(z,1000))}
try{ab.positionUpdate.unsubscribe(null,f)}catch(e){}
let acc=null;try{acc=String(wv(ab.currentAccount()))}catch(e){}
return {broker:ab._brokerMetainfo&&ab._brokerMetainfo.id||null,acc,sub,flags:(()=>{try{const c=ab._brokerMetainfo.configFlags;return {spb:c.supportPositionBrackets}}catch(e){return null}})(),reads:out,events:ev.length,evSample:ev.slice(0,8),evLast:ev.slice(-3)}})()
