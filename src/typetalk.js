'use strict';

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
                            reject(new Error('response url is required'));
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

        Typetalk.prototype.hasToken = function() {
            return !!self.accessToken && !!self.refreshToken;
        };

        Typetalk.prototype.clearToken = function() {
            self.accessToken = null;
            self.refreshToken = null;
        };

        Typetalk.prototype.validateAccessToken = function() {
            return self.getMyProfile();
        };

        Typetalk.prototype.getAccessTokenUsingClientCredentials = function() {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&client_secret=' + encodeURIComponent(clientSecret) +
                        '&grant_type=client_credentials' +
                        '&scope=' + encodeURIComponent(scope);
            return requestAccessToken(param);
        };

        Typetalk.prototype.requestAuthorization = function() {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&redirect_uri=' + encodeURIComponent(redirectUri) +
                        '&scope=' + encodeURIComponent(scope) +
                        '&response_type=code';
            location.href = Typetalk.OAUTH_BASE_URL + 'authorize?' + param;
        };

        Typetalk.prototype.getAccessTokenUsingAuthorizationCode = function(code) {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&client_secret=' + encodeURIComponent(clientSecret) +
                        '&redirect_uri=' + encodeURIComponent(redirectUri) +
                        '&grant_type=authorization_code' +
                        '&code=' + encodeURIComponent(code);
            return requestAccessToken(param);
        };

        Typetalk.prototype.refreshAccessToken = function(refreshToken) {
            var param = 'client_id=' + encodeURIComponent(clientId) +
                        '&client_secret=' + encodeURIComponent(clientSecret) +
                        '&grant_type=refresh_token' +
                        '&refresh_token=' + encodeURIComponent(refreshToken || self.refreshToken);
            return requestAccessToken(param);
        };

        Typetalk.prototype.getMyProfile = function() {
            return requestApi(Typetalk.API_BASE_URL + 'profile', 'GET', null);
        };

        Typetalk.prototype.getMyTopics = function() {
            return requestApi(Typetalk.API_BASE_URL + 'topics', 'GET', null);
        };

        Typetalk.prototype.getTopicMessages = function(topicId, options) {
            // options: {count, from, direction}
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '?' + toQueryString(options), 'GET', null);
        };

        Typetalk.prototype.postMessage = function(topicId, message, options) {
            // options: {replyTo, fileKeys[0-4], talkIds[0-4]}
            options = options || {};
            options.message = message;
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId), 'POST', toQueryString(options), {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        Typetalk.prototype.uploadAttachmentFile = function(topicId, file) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId), 'POST', {'file': file}, {'Content-Type': 'multipart/form-data'});
        };

        Typetalk.prototype.getTopicMembers = function(topicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/members/status', 'GET', null);
        };

        Typetalk.prototype.getMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId), 'GET', null);
        };

        Typetalk.prototype.removeMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId), 'DELETE', null);
        };

        Typetalk.prototype.likeMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId) + '/like', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        Typetalk.prototype.unlikeMessage = function(topicId, postId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/posts/' + encodeURIComponent(postId) + '/like', 'DELETE', null);
        };

        Typetalk.prototype.favoriteTopic = function(topicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/favorite', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        Typetalk.prototype.unfavoriteTopic = function(topicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/favorite', 'DELETE', null);
        };

        Typetalk.prototype.getNotificationList = function() {
            return requestApi(Typetalk.API_BASE_URL + 'notifications', 'GET', null);
        };

        Typetalk.prototype.getNotificationCount = function() {
            return requestApi(Typetalk.API_BASE_URL + 'notifications/status', 'GET', null);
        };

        Typetalk.prototype.readNotification = function() {
            return requestApi(Typetalk.API_BASE_URL + 'notifications/open', 'PUT', null);
        };

        Typetalk.prototype.readMessagesInTopic = function(topicId, options) {
            // options: {postId}
            options = options || {};
            options.topicId = topicId;
            return requestApi(Typetalk.API_BASE_URL + 'bookmark/save', 'POST', toQueryString(options), {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        Typetalk.prototype.getMentionList = function(options) {
            // options: {from, unread}
            options = options || {};
            return requestApi(Typetalk.API_BASE_URL + 'mentions?' + toQueryString(options), 'GET', null);
        };

        Typetalk.prototype.readMention = function(mentionId) {
            return requestApi(Typetalk.API_BASE_URL + 'mentions/' + encodeURIComponent(mentionId), 'PUT', null);
        };

        Typetalk.prototype.acceptTeamInvitation = function(teamId, inviteTeamId) {
            return requestApi(Typetalk.API_BASE_URL + 'teams/' + encodeURIComponent(teamId) + '/members/invite/' + encodeURIComponent(inviteTeamId) + '/accept', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        Typetalk.prototype.declineTeamInvitation = function(teamId, inviteTeamId) {
            return requestApi(Typetalk.API_BASE_URL + 'teams/' + encodeURIComponent(teamId) + '/members/invite/' + encodeURIComponent(inviteTeamId) + '/decline', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

        Typetalk.prototype.acceptTopicInvitation = function(topicId, inviteTopicId) {
            return requestApi(Typetalk.API_BASE_URL + 'topics/' + encodeURIComponent(topicId) + '/members/invite/' + encodeURIComponent(inviteTopicId) + '/accept', 'POST', {'Content-Type': 'application/x-www-form-urlencoded'});
        };

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
