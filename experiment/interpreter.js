var natural = require('natural');
var nlp     = require('nlp_compromise');
var config  = require('./config');

var classifier = new natural.BayesClassifier();

//ACTIONS.NOTIFICATION-CREATE
var actions_phrases = ['notify me when','notify me if','i want to know if','i want to know when','tell me if','tell me when','alert me when'];
var condition_phrases = ['is above','is below', 'is at', 'gets to','hits','trades at','sells for','sells above','sells below'];

var len = actions_phrases.length;
for(var ii = 0; ii < len; ii++){
  var action = actions_phrases[ii];
  var gth = condition_phrases.length;
  for(var jj = 0; jj < gth; jj++){
    var condition = condition_phrases[jj];
    classifier.addDocument(action + 'apple' + condition + ' 1.23',config.ACTIONS['NOTIFICATION-CREATE']);
  }
}

//ACTIONS.NOTIFICATION-DELETE
classifier.addDocument('cancel my notification',config.ACTIONS['NOTIFICATION-DELETE']);
classifier.addDocument('delete my notification',config.ACTIONS['NOTIFICATION-DELETE']);
classifier.addDocument('cancel my alert',config.ACTIONS['NOTIFICATION-DELETE']);
classifier.addDocument('delete my alert',config.ACTIONS['NOTIFICATION-DELETE']);
classifier.addDocument('don\'t notify me when',config.ACTIONS['NOTIFICATION-DELETE']);
classifier.addDocument('don\'t alert me when',config.ACTIONS['NOTIFICATION-DELETE']);

classifier.train();

var tests = ['tell me if apple is 4.56','cancel my msft alert'];
var len = tests.length;
for(var ii = 0; ii < len; ii++){
  var cur = tests[ii];
  console.log(classifier.classify(cur));
}

/*
classifier.addDocument('notify me when apple is above 1.23',ACTIONS['NOTIFICATION-CREATE']);
classifier.addDocument('I want to know when me when apple is above 1.23',ACTIONS['NOTIFICATION-CREATE']);


classifier.addDocument('notify me when something happens.', 'notification');
classifier.addDocument('i want to know when aapl is above.', 'notification');
classifier.addDocument('call me when aapl is above.', 'notification');

classifier.addDocument('add appl to my watchlist.', 'watchlist');
classifier.addDocument('add msft to my list.', 'watchlist');

classifier.addDocument('remove aapl from my list.', 'watchlist-delete');
classifier.addDocument('delete aapl from my watchlist.', 'watchlist-delete');

classifier.addDocument('what is apple doing?', 'quote');
classifier.addDocument('get me a quote for aapl', 'quote');
classifier.addDocument('what is the price of appl?', 'quote');
*/





//var phrase = 'The price of fb.';
// console.log( nlp.text(phrase).tags() );

//console.log(classifier.classify(phrase));

//console.log( classifier.getClassifications(phrase) );

//console.log( phrase.test("^[A-Z:\\.0-9]+$") );

