// Setup
// npm install typetalk-js --save
var Promise = require('bluebird'),
    Typetalk = require('typetalk-js');

var typetalk = new Typetalk({
    'client_id': 'YOUR_CLIENT_ID__CLIENT_CREDENTIALS', 
    'client_secret': 'YOUR_CLIENT_SECRET__CLIENT_CREDENTIALS',
    'scope': 'my'
});

typetalk.getAccessTokenUsingClientCredentials().then(function(data) {
    typetalk.accessToken = data.access_token;
    typetalk.refreshToken = data.refresh_token;
}).then(function() {
    typetalk.getMyProfile().then(function(profile) {
        console.log(JSON.stringify(profile));
    }, function(err) {
        console.error(err);
    });
}).then(function() {
    Promise.all([
        typetalk.getMyTopics(),
        typetalk.getNotificationList(),
        typetalk.getNotificationCount(), 
        typetalk.getMentionList()
    ]).then(function(results) {
        console.log(JSON.stringify(results));
    }).catch(function(err) {
        console.error(err);
    });
}).catch(function(err) {
    console.error(err);
});
