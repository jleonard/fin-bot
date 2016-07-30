var express = require('express');
var router = express.Router();

var yahoo = require('yahoo-finance');
var config = require('../config');

var fields = [
  config.YAHOO.ask,
  config.YAHOO.bid,
  config.YAHOO.open,
  config.YAHOO.previousClose,
  config.YAHOO['52WeekRange'],
  config.YAHOO.volume,
  config.YAHOO.daysLow,
  config.YAHOO.daysHigh
];


router.get('/', function(req, res, next) {
  console.log('quote says user is ',req.user);
  res.render('quote', { title: 'Express', icon:req.user.icon });
});

router.get('/:id', function(req, res, next){

  yahoo.snapshot({
    symbol: req.params.id,
    fields: fields  // ex: ['s', 'n', 'd1', 'l1', 'y', 'r'] 
  }, function (err, snapshot) {
    if(err){
      next(err);
    }else{
      res.json(snapshot);
    }
  });

});

module.exports = router;
