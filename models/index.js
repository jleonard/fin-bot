'use strict';

var mongoose = require('mongoose');
var config = require('../config');

var Models = function(db){
  console.log('in models');
  var userModel = require('./user')(db);
  var stockModel = require('./stock')(db);
  var portfolioModel = require('./portfolio')(db);
  return{
    investment: investmentModel,
    portfolio: stockModel,
    user: userModel
  }
}

module.exports = function(){
  var db = mongoose.createConnection(config.MLAB.uri,config.MLAB.options);
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