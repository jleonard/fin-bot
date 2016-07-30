var parse = require('csv-parse');
var fs = require('fs');

var nyse_csv = fs.readFileSync('../data/nyse.csv');
var nasdaq_csv = fs.readFileSync('../data/nasdaq.csv');
var amex_csv = fs.readFileSync('../data/amex.csv');

var stocks = [];

makeJson('amex',amex_csv);
makeJson('nyse',nyse_csv);
makeJson('nasdaq',nasdaq_csv);

function makeJson(exchange,csv){
  parse(csv, {}, function(err, output){
    var len = output.length;
    for(var ii = 0; ii < len; ii++){
      var cur = output[ii];
      var stock = {};
      stock.symbol = cur[0];
      stock.name = cur[1];
      stock.exchange = exchange;
      stocks.push(stock);
    }
  });
}

exports.stocks = stocks;

