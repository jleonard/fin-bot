'use strict';

var mongoose = require('mongoose');
var config = require('../config');

var Models = function(db){
  var portfolioModel = require('./portfolio')(db);
  var stockModel = require('./stock')(db);
  var personModel = require('./person')(db);
  return{
    investment: investmentModel,
    portfolio: stockModel,
    person: personModel
  }
}

module.exports = function(){
  var db = mongoose.createConnection(config.MONGOLAB_URI,config.MONGOOSE_OPTIONS);
  db.on('error',function(err){
    console.log('Mongoose error');
  });
  db.once('open',function(){
    console.log('DB connection established');
    db.db.collectionNames(function(error,names){
      if(error){
        // TODO log
      }else{
        console.log(names);
      }
    });
  });
  return new Models(db);
}