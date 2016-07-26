'use strict';

var mongoose = require('mongoose');
var findOrCreate = require('mongoose-findorcreate');
var Schema   = mongoose.Schema;

module.exports = function(db){
  var PersonSchema = new Schema({
    created: {type: Date, default: Date.now},
    id: {type:String, unique:true},
    givenName: String,
    familyName: String,
    email : String,
    phone : String
  });
  PersonSchema.plugin(findOrCreate);
  return db.model('User',PersonSchema);
}