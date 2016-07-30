exports.YAHOO = {
  'ask' : 'a',
  'bid' : 'b',
  'previousClose' : 'p',
  'open' : 'o',
  '52WeekHigh': 'k',
  '52WeekLow' : 'j',
  'changeFrom52WeekLow': 'j5',
  'changeFrom52WeekHigh': 'k4',
  'percentChangeFrom52WeekLow': 'j6',
  'percebtChangeFrom52WeekHigh': 'k5',
  '52WeekRange': 'w',
  'volume' :'v',
  'averageDailyVolume': 'a2',
  'name' : 'n',
  'symbol': 's',
  'stockExchange': 'x',
  'daysLow': 'g',
  'daysHigh': 'h',
  'dividendYield': 'y',
  'dividendPerShare':'d',
  'dividendPayDate':'r1',
  'exDividendDate':'q'
};

/*
var FIELDS = _.flatten([
  // Pricing
  ['a', 'b', 'b2', 'b3', 'p', 'o'],
  // Dividends
  ['y', 'd', 'r1', 'q'],
  // Date
  ['c1', 'c', 'c6', 'k2', 'p2', 'd1', 'd2', 't1'],
  // Averages
  ['c8', 'c3', 'g', 'h', 'k1', 'l', 'l1', 't8', 'm5', 'm6', 'm7', 'm8', 'm3', 'm4'],
  // Misc
  ['w1', 'w4', 'p1', 'm', 'm2', 'g1', 'g3', 'g4', 'g5', 'g6'],
  // 52 Week Pricing
  ['k', 'j', 'j5', 'k4', 'j6', 'k5', 'w'],
  // System Info
  ['i', 'j1', 'j3', 'f6', 'n', 'n4', 's1', 'x', 'j2'],
  // Volume
  ['v', 'a5', 'b6', 'k3', 'a2'],
  // Ratio
  ['e', 'e7', 'e8', 'e9', 'b4', 'j4', 'p5', 'p6', 'r', 'r2', 'r5', 'r6', 'r7', 's7'],
  // Misc
  ['t7', 't6', 'i5', 'l2', 'l3', 'v1', 'v7', 's6', 'e1']
]);
*/

exports.ACTIONS = {

  'NOTIFICATION-CREATE' : 'notification-create',
  'NOTIFICATION-READ'   : 'notification-read',
  'NOTIFICATION-UPDATE' : 'notification-update',
  'NOTIFICATION-DELETE' : 'notification-delete',
  
  'NOTIFICATION-CREATE' : 'notification-create-init',
  'NOTIFICATION-READ'   : 'notification-read-init',
  'NOTIFICATION-UPDATE' : 'notification-update-init',
  'NOTIFICATION-DELETE' : 'notification-delete-init'
}

exports.GOOGLE = {
  clientId : '130267583926-9chkoqnv1npjs9l618hqrfmj17pt3oal.apps.googleusercontent.com',
  secret: 'gZF0VWvgXwsbHBKp-X5Aj8_E'
}

exports.MLAB = {
  uri : 'mongodb://fett:fuck666@ds029735.mlab.com:29735/heroku_5ktllzt8',
  options: { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }, 
                replset: { socketOptions: { keepAlive: 1, connectTimeoutMS : 30000 } } }
}