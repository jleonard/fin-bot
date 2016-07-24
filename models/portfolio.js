'use strict';

var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

module.exports = function(db){
  var PortfolioSchema = new Schema({
    created: {type: Date, default: Date.now},
    id: {type:String, unique:true},
    name: String,
    positions : [{ type: Schema.Types.ObjectId, ref: 'Stock' }],
    owner: { type: Schema.Types.ObjectId, ref: 'Person' }
  });
  return db.model('Portfolio',PortfolioSchema);
}