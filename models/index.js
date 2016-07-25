'use strict';

var mongoose = require('mongoose');
var config = require('../config');

var Models = function(db){
  console.log('in models');
  var userModel = require('./user')(db);
  var stockModel = require('./stock')(db);
  var portfolioModel = require('./portfolio')(db);
  return{
    stock: stockModel,
    portfolio: portfolioModel,
    user: userModel
  }
}

module.exports = function(){
  var db = mongoose.createConnection(config.MLAB.uri,config.MLAB.options);
  db.on('error',function(err){
    console.log('Mongoose error ',err);
  });
  db.once('open',function(){
    console.log('DB connection established');
    db.db.listCollections({name: "shouldCorrectlyRetrievelistCollections"}).toArray(function(_err, items) {
      if(_err){}
      console.log(items);
    });
  });
  return new Models(db);
}