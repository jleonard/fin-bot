var natural = require('natural');
var classifier = new natural.BayesClassifier();
var nlp = require('nlp_compromise');

classifier.addDocument('i am long qqqq', 'buy');
classifier.addDocument('buy the q\'s', 'buy');
classifier.addDocument('short gold', 'sell');
classifier.addDocument('sell gold', 'sell');

classifier.train();

var str = "Jeff look like apple computer.";
// console.log( nlp.text(str).tags() );

str = 'i look like a million dollars';
console.log( nlp.value(str).number );

//console.log(classifier.classify('i am very fucking short long apple'));