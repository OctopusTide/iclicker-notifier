(function (root) {
  'use strict';
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const hash = value => {
    let result = 2166136261;
    for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
    return (result >>> 0).toString(36);
  };
  function classify(input) {
    const text = clean(input.text);
    const route = String(input.route || '').toLowerCase();
    const scope = (route.match(/\/(?:course|class)\/([^/?#]+)/) || [])[1] || route.split('?')[0] || 'courses';
    const history = Boolean(input.reviewPage) || /class-history|\/history|study-tools|\/assignments?|\/review|\/grades?|\/results|\/question\/|\/activity\/|\/quiz\/ended/.test(route);
    const liveRoute = /^\/class\/[^/]+(?:\/|$)/.test(route);
    const login = /\/login|\/sign-?in/.test(route) || input.loginForm;
    const classStarted = !login && Boolean((liveRoute && !history) || input.joinVisible ||
      /your instructor (?:has )?started class|class (?:is )?in progress|session (?:is )?in progress|课程已开始|老师已开始上课|课堂进行中/i.test(text));
    const ended = /(?:poll(?:ing)?|question) (?:is |has )?(?:closed|ended|stopped)|polling has ended|waiting for (?:the |your )?(?:instructor|teacher)|no (?:active |current )?question|等待.*(?:老师|教师|题目)|投票已(?:结束|关闭)|答题已结束/i.test(text);
    const activeText = /poll(?:ing)? (?:is )?(?:open|active|in progress)|answer (?:the|this) question|submit (?:your )?(?:answer|response)|请选择答案|提交答案|正在答题/i.test(text);
    const questionOpen = liveRoute && !history && !login && Boolean(input.livePoll || (!ended && (input.answerControls || activeText)));
    // Identity deliberately excludes answer selection and countdown values.
    const identity = clean(input.questionIdentity);
    const questionKey = questionOpen ? hash(identity || 'active-question') : '';
    const questionImage = questionOpen && input.questionImage ? hash(input.questionImage) : '';
    const locked = /(?:content|question|image|results?).{0,70}(?:locked|hidden|not shared)|(?:instructor|teacher).{0,70}(?:locked|hidden|disabled)|(?:锁定|隐藏).{0,20}(?:内容|题目)|(?:内容|题目).{0,20}(?:锁定|隐藏)/i.test(text);
    let state = 'waiting', label = '页面已连接，等待开课或新题';
    if (login) { state = 'login'; label = '请先登录 iClicker'; }
    else if (history) { state = 'history'; label = '当前是历史记录或复习页，请回到课程或课堂页面'; }
    else if (questionOpen) { state = 'question'; label = locked ? '检测到答题界面；题目内容被锁定' : '检测到可回答的新题'; }
    else if (classStarted) { state = 'class'; label = '课程已开始，请进入课堂以接收新题提醒'; }
    else if (locked) { state = 'locked'; label = '内容已锁定，继续等待课堂状态变化'; }
    else if (/\/?courses\/?$/.test(route)) { state = 'courses'; label = '请打开要监听的课程；可为不同课程各开一个标签页'; }
    return { scope, classStarted, questionOpen, questionKey, questionImage, state, label };
  }
  class Tracker {
    constructor() { this.previous = null; this.classCycle = 0; this.questionCycle = 0; }
    update(next) {
      const prev = this.previous;
      const sameScope = prev && prev.scope === next.scope;
      const events = [];
      if (!sameScope) { this.classCycle = 0; this.questionCycle = 0; }
      if (next.classStarted && (!sameScope || !prev.classStarted)) {
        events.push({ kind: 'class', scope: next.scope, eventKey: `class:${++this.classCycle}` });
      }
      const imageChanged = sameScope && prev.questionImage && next.questionImage && prev.questionImage !== next.questionImage;
      if (next.questionOpen && (!sameScope || !prev.questionOpen || next.questionKey !== prev.questionKey || imageChanged)) {
        // Suppress a simultaneous redundant class sound when a question is already open.
        events.length = 0;
        events.push({ kind: 'question', scope: next.scope, eventKey: `question:${next.questionKey}:${++this.questionCycle}` });
      }
      this.previous = next;
      return events;
    }
  }
  root.ICDetector = { classify, Tracker, clean, hash };
  if (typeof module !== 'undefined') module.exports = root.ICDetector;
})(globalThis);
