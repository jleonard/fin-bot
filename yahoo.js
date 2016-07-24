var yahoo = require('yahoo-finance');
var config = require('./config');

var fields = [config.YAHOO.ask,config.YAHOO.bid];

yahoo.snapshot({
  symbol: 'aapl',
  fields: fields  // ex: ['s', 'n', 'd1', 'l1', 'y', 'r'] 
}, function (err, snapshot) {

  console.log(snapshot);
});