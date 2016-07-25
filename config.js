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
  'daysHigh': 'h'
};

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