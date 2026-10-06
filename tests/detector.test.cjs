const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, Tracker } = require('../extension/detector.js');
const { normalize } = require('../extension/settings.js');
const course = { route: '/course/example/overview', text: '' };
const poll = { route: '/class/example/poll', livePoll: true, questionIdentity: 'Question 1' };

test('opening or starting a course alerts exactly once per transition', () => {
  const tracker = new Tracker();
  assert.deepEqual(tracker.update(classify(course)), []);
  const open = classify({ ...course, joinVisible: true });
  assert.equal(tracker.update(open)[0].kind, 'class');
  assert.deepEqual(tracker.update(open), []);
});
test('initial active question alerts, changing answer or countdown does not', () => {
  const tracker = new Tracker();
  assert.equal(tracker.update(classify(poll))[0].kind, 'question');
  assert.deepEqual(tracker.update(classify({ ...poll, text: 'Time 00:12 Your answer A' })), []);
  assert.deepEqual(tracker.update(classify({ ...poll, text: 'Time 00:11 Your answer B' })), []);
});
test('next question alerts even if poll controls remain mounted', () => {
  const tracker = new Tracker();
  tracker.update(classify(poll));
  assert.equal(tracker.update(classify({ ...poll, questionIdentity: 'Question 2' }))[0].kind, 'question');
});
test('late question image does not double alert, same-name new image does', () => {
  const tracker = new Tracker();
  tracker.update(classify(poll));
  assert.deepEqual(tracker.update(classify({ ...poll, questionImage: 'image1' })), []);
  assert.equal(tracker.update(classify({ ...poll, questionImage: 'image2' }))[0].kind, 'question');
});
test('same-question resume after results alerts again', () => {
  const tracker = new Tracker();
  tracker.update(classify(poll));
  tracker.update(classify({ route: '/class/example/question/q1', text: 'Your Answer A' }));
  assert.equal(tracker.update(classify(poll))[0].kind, 'question');
});
test('review routes never produce question alerts despite answer-like text', () => {
  for (const route of ['/question/q1', '/activity/a1', '/class/example/question/q1', '/class/example/quiz/ended', '/course/example/class-history', '/course/example/assignments']) {
    const state = classify({ ...poll, route, text: 'Submit your answer' });
    assert.equal(state.questionOpen, false, route);
    assert.equal(state.state, 'history', route);
  }
});
test('a list or waiting screen does not count as a question', () => {
  assert.equal(classify({ route: '/courses', text: 'Questions and answers' }).questionOpen, false);
  assert.equal(classify({ ...poll, livePoll: false, text: 'Waiting for your instructor' }).questionOpen, false);
});
test('locked image can still alert when poll is open, without recovering content', () => {
  assert.equal(classify({ ...poll, text: 'Question image hidden by instructor' }).questionOpen, true);
});
test('course overview and live class share deduplication scope', () => {
  assert.equal(classify(course).scope, classify(poll).scope);
});
test('settings reject malformed values and preserve channel choices', () => {
  const s = normalize({ enabled: false, desktop: false, sound: true, tone: 'remote-url', volume: 5 });
  assert.equal(s.enabled, false); assert.equal(s.desktop, false); assert.equal(s.sound, true);
  assert.equal(s.tone, 'chime'); assert.equal(s.volume, 1);
  assert.equal(normalize({ volume: NaN }).volume, 0.65);
});
