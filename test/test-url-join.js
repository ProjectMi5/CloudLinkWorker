var assert = require('assert');

describe('Validate url-join package', function (t) {
  var urljoin = require('url-join');

  it('join rest.host and rest.getTasks', function () {
    var config = require('./../config.js');

    var result = 'https://mi5.itq.de/getTasks';
    var url = urljoin(config.rest.host, config.rest.getTasks);

    assert.equal(url, result);
  });
});