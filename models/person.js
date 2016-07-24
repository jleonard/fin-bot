'use strict';

var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

module.exports = function(db){
  var PersonSchema = new Schema({
    created: {type: Date, default: Date.now},
    id: {type:String, unique:true},
    name: String,
    email : String,
    phone : String
  });
  return db.model('Person',PersonSchema);
}