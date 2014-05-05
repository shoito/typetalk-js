'use strict';

/**
 * @fileoverview typetalk-js aims to provide a complete, asynchronous client library for the Typetalk API.
 *   For API details and how to use promises, see the JavaScript Promises articles.
 * @author shoito
 */

if (typeof window === 'undefined') {
    var Promise = Promise || require('bluebird');
    var XMLHttpRequest = XMLHttpRequest || require('xmlhttprequest').XMLHttpRequest;
}

(function() {
    var Typetalk = (function() {

        Typetalk.API_BASE_URL = 'https://typetalk.in/api/v1/';
        Typetalk.OAUTH_BASE_URL = 'https://typetalk.in/oauth2/';

        var self,
            clientId,
            clientSecret,
            redirectUri,
            scope = 'topic.read,topic.post,my';

        /**
         * Typetalk API client
         * @global
         * @class Typetalk
         * @param {Object} options - API parameters
         * @param {String} options.client_id - client id
         * @param {String} options.client_secret - client secret
         * @param {String} [options.scope=topic.read,topic.post,my] - scope
         * @param {String} [options.redirect_uri] - redirect uri
         * @param {String} [options.access_token] - access token
         * @param {String} [options.refresh_token] - refresh token
         * @param {Number} [options.timeout=3000] - timeout(ms)
         * @see {@link http://developers.typetalk.in/oauth.html}
         */
        function Typetalk(options) {
            ['client_id', 'client_secret'].forEach(function(field) {
                if (typeof options[field] === 'undefined') {
                    throw new Error(field + ' is required');
                }
            });

            self = this;
            self.accessToken = options.access_token;
            self.refreshToken = options.refresh_token;
            self.timeout = options.timeout || 3000;

            clientId = options.client_id;
            clientSecret = options.client_secret;
            redirectUri = options.redirect_uri;
            scope = options.scope || scope;
        }

        var toQueryString = function(obj) {
            var queryString = [];
            for(var prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    queryString.push(encodeURIComponent(prop) + '=' + encodeURIComponent(obj[prop]));
                }
            }
            return queryString.join('&');
        };

        var requestAccessToken = function(params) {
            return new Promise(function(resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        // { "error": "invalid_request", "error_description": "grant_type not found"}
                        reject(JSON.parse(xhr.responseText));
                    }
                };
                xhr.onerror = reject;

                xhr.open('POST', Typetalk.OAUTH_BASE_URL + 'access_token');
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.timeout = self.timeout;
                xhr.send(params);
            });
        };

        var requestApi = function(url, method, params, options) {
            return new Promise(function(resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else if (xhr.status === 400 || xhr.status === 401) {
                        // 400; Bad Request
                        // 400: WWW-Authenticate: Bearer error="invalid_request", error_description="Access token was not specified"
                        // 401: WWW-Authenticate: Bearer error="invalid_token", error_description="Invalid access token"
                        // 401: WWW-Authenticate: Bearer error="invalid_token", error_description="The access token expired"
                        // 401: WWW-Authenticate: Bearer error="invalid_scope"
                        var authMessage = (xhr.getResponseHeader('WWW-Authenticate') || ''),
                            errorMatch = (authMessage.match(/error="(\w+)"/) || []),
                            errorDescriptionMatch = (authMessage.match(/error_description="(\w+)"/) || []),
                            error = (errorMatch.length > 1) ? errorMatch[1] : xhr.statusText,
                            errorDescription = (errorDescriptionMatch.length > 1) ? errorDescriptionMatch[1] : '';
                        reject({'status': xhr.status, 'error': error, 'error_description': errorDescription});
                    } else {
                        reject({'status': xhr.status, 'error': xhr.statusText, 'error_description': 'An error has occurred while requesting api'});
                    }
                };
                xhr.onerror = reject;

                xhr.open(method, url);
                if (options && options['Content-Type']) {
                    xhr.setRequestHeader('Content-Type', options['Content-Type']);
                }
                xhr.setRequestHeader('Authorization', 'Bearer ' + encodeURIComponent(self.accessToken));
                xhr.timeout = self.timeout;
                xhr.send(params);
            });
        };

        /**
         * Starts an auth flow at the typetalk oauth2 URL.
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         */
        Typetalk.prototype.authorizeChromeApp = function() {
            return new Promise(function(resolve, reject) {
                if (!(chrome && chrome.identity)) {
                    reject(new Error('chrome.identity API is unsupported'));
                    return;
                }

                var authorizeUrl = Typetalk.OAUTH_BASE_URL + 'authorize?client_id=' + encodeURIComponent(clientId) +
                                '&redirect_uri=' + encodeURIComponent(redirectUri) +
                                '&scope=' + encodeURIComponent(scope) + '&response_type=code';
                chrome.identity.launchWebAuthFlow(
                    {'url': authorizeUrl, 'interactive': true},
                    function(responseUrl) {
                        if (typeof responseUrl === 'undefined') {
                            reject(new Error('Cannot get response url'));
                            return;
                        }

                        var code = responseUrl.match(/code=(.+)/)[1];
                        if (typeof code === 'undefined') {
                            reject(new Error('authorization code is required'));
                            return;
                        }

                        self.getAccessTokenUsingAuthorizationCode(code).then(function(data) {
                            resolve(data);
                        }, function(err) {
                            reject(err);
                        });
                    }
                );
            });
        };

        /**
         * Check if this instance has the access token and the refresh token
         * @memberof Typetalk
         * @method
         * @return {Boolean} - Returns true if this instance has the access token and the refresh token
         */
        Typetalk.prototype.hasToken = function() {
            return !!self.accessToken && !!self.refreshToken;
        };

        /**
         * Removes your access token from this instance
         * @memberof Typetalk
         * @method
         */
        Typetalk.prototype.clearToken = function() {
            self.accessToken = null;
            self.refreshToken = null;
        };

        /**
         * Validate your access token
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         */
        Typetalk.prototype.validateAccessToken = function() {
            return self.getMyProfile();
        };

        /**
         * Get access token using authorization code
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/oauth.html#client}
         */
        Typetalk.prototype.getAccessTokenUsingClientCredentials = function() {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&client_secret=' + encodeURIComponent(clientSecret) +
                        '&grant_type=client_credentials' +
                        '&scope=' + encodeURIComponent(scope);
            return requestAccessToken(param);
        };

        /**
         * Redirect users to request Typetalk access
         * @memberof Typetalk
         * @method
         * @see {@link http://developers.typetalk.in/oauth.html#code}
         */
        Typetalk.prototype.requestAuthorization = function() {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&redirect_uri=' + encodeURIComponent(redirectUri) +
                        '&scope=' + encodeURIComponent(scope) +
                        '&response_type=code';
            location.href = Typetalk.OAUTH_BASE_URL + 'authorize?' + param;
        };

        /**
         * Get an access token using authorization code
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/oauth.html#code}
         */
        Typetalk.prototype.getAccessTokenUsingAuthorizationCode = function(code) {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&client_secret=' + encodeURIComponent(clientSecret) +
                        '&redirect_uri=' + encodeURIComponent(redirectUri) +
                        '&grant_type=authorization_code' +
                        '&code=' + encodeURIComponent(code);
            return requestAccessToken(param);
        };

        /**
         * Get an access token using authorization code
         * @memberof Typetalk
         * @method
         * @param {?String} refreshToken - your refresh token
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/oauth.html#refresh}
         */
        Typetalk.prototype.refreshAccessToken = function(refreshToken) {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&client_secret=' + encodeURIComponent(clientSecret) +
                        '&grant_type=refresh_token' +
                        '&refresh_token=' + encodeURIComponent(refreshToken || self.refreshToken);
            return requestAccessToken(param);
        };

        /**
         * Get my profile
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-profile}
         */
        Typetalk.prototype.getMyProfile = function() {
            return requestApi(Typetalk.API_BASE_URL + 'profile', 'GET', null);
        };

        /**
         * Get my topics
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-topics}
         */
        Typetalk.prototype.getMyTopics = function() {
            return requestApi(Typetalk.API_BASE_URL + 'topics', 'GET', null);
        };

        /**
         * Get topic messages
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {?Object} options - Query parameters
         * @param {?Number} options.count - default value: 20, maximum: 100
         * @param {?Number} options.from - references Post ID
         * @param {?String} options.direction - "backward" or "forward"
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-messages}
         */
        Typetalk.prototype.getTopicMessages = function(topicId, options) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '?' + toQueryString(options), 'GET', null);
        };

        /**
         * Post message
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {String} message - your message, maximum length: 4096
         * @param {?Object} options - Form parameters
         * @param {?Number} options.replyTo - references Post ID
         * @param {?String} options.fileKeys[0-5] - attachment file key, maximum count: 5
         * @param {?Number} options.talkIds[0-5] - Talk IDs that you want to put the message in, maximum count: 5
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#post-message}
         */
        Typetalk.prototype.postMessage = function(topicId, message, options) {
            options = options || {};
            options.message = message;
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId), 'POST', toQueryString(options), {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        /**
         * Upload attachment file
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {Binaly} file - max file size: 10MB
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#upload-attachment}
         */
        Typetalk.prototype.uploadAttachmentFile = function(topicId, file) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId), 'POST', {'file': file}, {'Content-Type': 'multipart/form-data'});
        };

        /**
         * Get topic members
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-topic-members}
         */
        Typetalk.prototype.getTopicMembers = function(topicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/members/status', 'GET', null);
        };

        /**
         * Get message
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {Number} postId - Post ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-message}
         */
        Typetalk.prototype.getMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId), 'GET', null);
        };

        /**
         * Remove message
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {Number} postId - Post ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#remove-message}
         */
        Typetalk.prototype.removeMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId), 'DELETE', null);
        };

        /**
         * Like message
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {Number} postId - Post ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#like-message}
         */
        Typetalk.prototype.likeMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId) + '/like', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        /**
         * Unlike message
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {Number} postId - Post ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#unlike-message}
         */
        Typetalk.prototype.unlikeMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId) + '/like', 'DELETE', null);
        };

        /**
         * Favorite topic
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#favorite-topics}
         */
        Typetalk.prototype.favoriteTopic = function(topicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/favorite', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        /**
         * Unfavorite topic
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#unfavorite-topics}
         */
        Typetalk.prototype.unfavoriteTopic = function(topicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/favorite', 'DELETE', null);
        };

        /**
         * Get notification list
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-notifications}
         */
        Typetalk.prototype.getNotificationList = function() {
            return requestApi(Typetalk.API_BASE_URL + 'notifications', 'GET', null);
        };

        /**
         * Get notification count
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-notification-status}
         */
        Typetalk.prototype.getNotificationCount = function() {
            return requestApi(Typetalk.API_BASE_URL + 'notifications/status', 'GET', null);
        };

        /**
         * Read notification
         * @memberof Typetalk
         * @method
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#open-notification}
         */
        Typetalk.prototype.readNotification = function() {
            return requestApi(Typetalk.API_BASE_URL + 'notifications/open', 'PUT', null);
        };

        /**
         * Read messages in topic
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {?Object} options - Form parameters
         * @param {?Number} options.postId - Post ID ( if no parameter, read all posts )
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#open-notification}
         */
        Typetalk.prototype.readMessagesInTopic = function(topicId, options) {
            options = options || {};
            options.topicId = topicId;
            return requestApi(Typetalk.API_BASE_URL + 'bookmark/save', 'POST', toQueryString(options), {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        /**
         * Get mention list
         * @memberof Typetalk
         * @method
         * @param {?Object} options - Form parameters
         * @param {?Number} options.from - Mention ID
         * @param {?Boolean} options.unread - true: only unread mentions, false: all mentions
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#get-mentions}
         */
        Typetalk.prototype.getMentionList = function(options) {
            options = options || {};
            return requestApi(Typetalk.API_BASE_URL + 'mentions?' + toQueryString(options), 'GET', null);
        };

        /**
         * Read mention
         * @memberof Typetalk
         * @method
         * @param {Number} mentionId - Mention ID
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#save-read-mention}
         */
        Typetalk.prototype.readMention = function(mentionId) {
            return requestApi(Typetalk.API_BASE_URL + 'mentions/' + encodeURIComponent(mentionId), 'PUT', null);
        };

        /**
         * Accept team invitation
         * @memberof Typetalk
         * @method
         * @param {Number} teamId - Team ID
         * @param {Number} inviteTeamId - Team invitation ID (invites.teams[x].id in Get notification list)
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#accept-team-invite}
         */
        Typetalk.prototype.acceptTeamInvitation = function(teamId, inviteTeamId) {
            return requestApi(Typetalk.API_BASE_URL + 'teams/' + encodeURIComponent(teamId) + '/members/invite/' + encodeURIComponent(inviteTeamId) + '/accept', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        /**
         * Decline team invitation
         * @memberof Typetalk
         * @method
         * @param {Number} teamId - Team ID
         * @param {Number} inviteTeamId - Team invitation ID (invites.teams[x].id in Get notification list)
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#decline-team-invite}
         */
        Typetalk.prototype.declineTeamInvitation = function(teamId, inviteTeamId) {
            return requestApi(Typetalk.API_BASE_URL + 'teams/' + encodeURIComponent(teamId) + '/members/invite/' + encodeURIComponent(inviteTeamId) + '/decline', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        /**
         * Accept topic invitation
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {Number} inviteTeamId - Topic invitation ID (invites.topics[x].id in Get notification list)
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#accept-team-invite}
         */
        Typetalk.prototype.acceptTopicInvitation = function(topicId, inviteTopicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/members/invite/' + encodeURIComponent(inviteTopicId) + '/accept', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        /**
         * Decline topic invitation
         * @memberof Typetalk
         * @method
         * @param {Number} topicId - Topic ID
         * @param {Number} inviteTeamId - Topic invitation ID (invites.topics[x].id in Get notification list)
         * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
         * @see {@link http://developers.typetalk.in/api.html#decline-team-invite}
         */
        Typetalk.prototype.declineTopicInvitation = function(topicId, inviteTopicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/members/invite/' + encodeURIComponent(inviteTopicId) + '/decline', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        return Typetalk;
    })();

    if (typeof module !== 'undefined') {
        module.exports = Typetalk;
    } else {
        // <script src="https://www.promisejs.org/polyfills/promise-4.0.0.js"></script>
        this.Typetalk = Typetalk;
    }
}).call(this);
