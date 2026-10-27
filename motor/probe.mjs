// Sonda SOLO LECTURA de la API interna de trading de TradingView (no envía, modifica ni cancela nada).
import { cdpEvaluator, PAGE } from './colchon.mjs';
const c = await cdpEvaluator();
const out = await c.evaluate(`(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t),r={bottomWidgetBar:!!(window.TradingView&&window.TradingView.bottomWidgetBar),trading:!!t,activeBroker:!!ab,brokerId:tvBrokerId(ab)};
 if(ab){r.methods=['positions','placeOrder','modifyOrder','orderById','closePosition','editPositionBrackets'].filter(function(m){return typeof ab[m]==='function'});
 try{var p=await ab.positions();r.positions=(p||[]).map(function(x){return {symbol:x.symbol,side:x.side,qty:x.qty,avg:x.avgPrice,sl:x.stopLoss,tp:x.takeProfit}})}catch(e){r.positionsErr=e.message}
 try{var o=tvWv(t._ordersService.activeOrders())||[];r.activeOrders=o.map(function(x){return {id:x.id,symbol:x.symbol,type:x.type,status:x.status,side:x.side,stop:x.stopPrice,limit:x.limitPrice}})}catch(e){r.ordersErr=e.message}}
 var n=document.querySelector('[class*=accountName]');r.accountName=n&&n.innerText.trim();return r})()`);
console.log(JSON.stringify(out, null, 2)); c.close(); process.exit(0);
