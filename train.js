var natural = require('natural'),
    classifier = new natural.BayesClassifier();
var nlp = require('nlp_compromise');

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


classifier.train();

var phrase = 'The price of fb.';
// console.log( nlp.text(phrase).tags() );

//console.log(classifier.classify(phrase));

//console.log( classifier.getClassifications(phrase) );

console.log( phrase.test("^[A-Z:\\.0-9]+$") );

