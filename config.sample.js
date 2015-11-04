/**
 * Sample Configuration
 */
var config = {};

config.rest = {};
config.rest.host = 'https://foo.bar.xz';
config.rest.getTasks = 'getTasks';
config.auth = {}; // used with request - keep object properties user and password!
config.auth.user = 'foo';
config.auth.password = 'bar';

module.exports = config;