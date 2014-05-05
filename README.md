JavaScript library for Typetalk
======================

[typetalk-js](https://github.com/shoito/typetalk-js) aims to provide a complete, asynchronous client library for the [Typetalk API](http://developers.typetalk.in/api.html).

For API details and how to use promises, see the [JavaScript Promises](http://www.html5rocks.com/en/tutorials/es6/promises/).

typetalk-js is an **unofficial** library.

## Typetalk
Typetalk - http://www.typetalk.in

> Typetalk: Team discussions and collaboration through instant messaging.

> Typetalk brings fun and ease to team discussions through instant messaging on desktop and mobile devices.

## Requirements

Support Promises

[Can I use Promises?](http://caniuse.com/promises)

### Browser

Use a polyfill script tag:

    <script src="https://www.promisejs.org/polyfills/promise-4.0.0.js"></script>

The global variable Promise becomes available after the above script tag.

## Installation

### Node.js

    npm install typetalk-js --save

### Browser

    bower install typetalk-js --save

or clone the repository or just copy the files `typetalk.js` or `typetalk.min.js` to your server.

and then include it in your pages with `<script src="typetalk.min.js"></script>`

## Getting started

See also 

- [Typetalk for Developers](http://developers.typetalk.in/index.html)
- [typetalk-js API documentation](http://shoito.github.io/typetalk-js/Typetalk.html)

### Setup (Client Credentials as Grant Type)

    var Typetalk = require('typetalk');

    var typetalk = new Typetalk({
        'client_id': 'YOUR_CLIENT_ID__CLIENT_CREDENTIALS', 
        'client_secret': 'YOUR_CLIENT_SECRET__CLIENT_CREDENTIALS',
        'scope': 'topic.read,topic.post,my'
    });

### Setup (Authorization Code as Grant Type)

    var typetalk = new Typetalk({
        'client_id': 'YOUR_CLIENT_ID__AUTHORIZATION_CODE',
        'client_secret': 'YOUR_CLIENT_SECRET__AUTHORIZATION_CODE',
        'redirect_uri': 'https://YOUR_APP_DOMAIN/provider_cb',
        'scope': 'topic.read,topic.post,my'
    });

### Get access token using client credentials

    typetalk.getAccessTokenUsingClientCredentials().then(function(data) {
        typetalk.accessToken = data.access_token;
        typetalk.refreshToken = data.refresh_token;
    }, function(err) {
        console.error(err);
    });

### Get my profile

    typetalk.getMyProfile().then(function(profile) {
        console.log(profile);
    });

### Get my topics

    typetalk.getMyTopics().then(function(topics) {
        console.log(topics);
    });

### Post message

    typetalk.postMessage(1657, {'message': '@shoito Hellow World!'}).then(function(message) {
        console.log(message);
    });

## Sample App using typetalk-js library

- [Typetalk Notifications](https://github.com/shoito/typetalk-notifications)

## See also

- [Typetalk](http://www.typetalk.in)
- [Typetalk for Developers](http://developers.typetalk.in/)
- [JavaScript Promises: There and Back Again](http://www.html5rocks.com/en/tutorials/es6/promises/)
- [Promise](https://www.promisejs.org/)

## License
MIT License - http://opensource.org/licenses/MIT
