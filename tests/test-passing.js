var test = require('tape-catch');

test('Passing test', function (t) {
  t.pass('Test has passed');
  t.end();
});

test('Passing test', function (t) {
  t.plan(1);
  t.pass('Test has passed');
});

test('Assertions with tape.', function (t) {
  const expected = 'something to test';
  const actual = 'sonething to test';

  t.equal(actual, expected,
    'Given two mismatched values, .equal() should produce a nice bug report');

  t.end();
});

test('Passing test 2', function (t) {
  t.plan(1);
  t.pass('Test has passed');
});
