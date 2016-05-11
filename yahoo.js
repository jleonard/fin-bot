var yahoo = require('yahoo-finance');
var config = require('./config');

/*
var fields = ['a', 'b', 'b2', 'b3', 'p', 'o','k', 'j', 'j5', 'k4', 'j6', 'k5', 'w','v', 'a5', 'b6', 'k3', 'a2'];
fields = ['c8', 'c3', 'g', 'h', 'k1', 'l', 'l1', 't8', 'm5', 'm6', 'm7', 'm8', 'm3', 'm4'];
fields = ['c1', 'c', 'c6', 'k2', 'p2', 'd1', 'd2', 't1'];
*/

var fields = [config.YAHOO.ask,config.YAHOO.bid];

yahoo.snapshot({
  symbol: 'aapl',
  fields: fields  // ex: ['s', 'n', 'd1', 'l1', 'y', 'r'] 
}, function (err, snapshot) {
  /*
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    lastTradeDate: '11/15/2013',
    lastTradePriceOnly: '524.88',
    dividendYield: '2.23',
    peRatio: '13.29'
  }
  */
  console.log(snapshot);
});