(() => {
  'use strict';
  if (globalThis.__iclickerReminderLoaded) return;
  globalThis.__iclickerReminderLoaded = true;
  const { classify, Tracker, clean } = ICDetector;
  const tracker = new Tracker();
  let scheduled, candidate, candidateAt = 0, lastStatus = '', lastStatusAt = 0;
  let stopped = false;

  function readPage() {
    const visibleCache = new WeakMap();
    function visible(element) {
      if (!element || element.nodeType !== 1) return false;
      if (visibleCache.has(element)) return visibleCache.get(element);
      const style = getComputedStyle(element);
      const own = !element.hidden && element.getAttribute('aria-hidden') !== 'true' &&
        style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
        Number(style.opacity) !== 0;
      const result = own && (!element.parentElement || visible(element.parentElement));
      visibleCache.set(element, result);
      return result;
    }
    const select = selector => [...document.querySelectorAll(selector)].filter(visible);
    const texts = [];
    const walker = document.createTreeWalker(document.querySelector('app-root') || document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (parent && !parent.closest('script,style,noscript,#onetrust-consent-sdk') && visible(parent)) {
        const value = clean(node.nodeValue);
        if (value) texts.push(value);
      }
    }
    const buttons = select('button,[role="button"],input[type="submit"],input[type="radio"],[role="radio"]');
    const enabled = buttons.filter(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
    const buttonText = e => clean(e.innerText || e.getAttribute('aria-label') || e.value);
    const letterChoices = enabled.filter(e => /^[A-E]$/i.test(buttonText(e))).length;
    const submit = enabled.some(e => /^(submit(?: (?:your )?(?:answer|response))?|提交(?:答案)?)$/i.test(buttonText(e)));
    const radioChoices = enabled.filter(e => e.matches('input[type="radio"],[role="radio"]')).length;
    const pollHeader = select('app-poll app-primary-header h1').map(e => clean(e.innerText));
    const heading = select('h1,h2,h3,[role="heading"]').map(e => clean(e.innerText))
      .filter(s => /^(?:question|poll|题目|问题)\s*#?\s*\d+/i.test(s));
    const questionNodes = select('[data-question-id],.question-text,.question-prompt,#question-text');
    const images = select('.question-image-container img, img[alt*="Question"],img[alt*="question"]');
    const identity = [
      ...(pollHeader.length ? pollHeader : heading),
      ...questionNodes.map(e => e.getAttribute('data-question-id') || clean(e.innerText))
    ].filter(Boolean).join('|');
    const imageIdentity = images.filter(e => !/hidden|locked/i.test(`${e.className} ${e.alt} ${e.getAttribute('src')}`))
      .map(e => {
        const source = e.getAttribute('src');
        if (!source) return '';
        try {
          const url = new URL(source, location.href);
          for (const key of [...url.searchParams.keys()]) {
            if (/^x-amz-|^(?:AWSAccessKeyId|Signature|Expires|Key-Pair-Id|Policy)$/i.test(key)) url.searchParams.delete(key);
          }
          url.hash = '';
          return url.href;
        } catch { return source; }
      }).filter(Boolean).join('|');
    const text = texts.join(' ');
    const reviewPage = buttons.some(e => /Return to (?:Questions|Class History)/i.test(buttonText(e))) ||
      /Correct Answer.*All Results/i.test(text);
    return classify({
      text, route: location.hash.slice(1) || location.pathname,
      joinVisible: select('#btnJoin').some(e => !e.disabled) || enabled.some(e => /^(?:join class|join session|加入课堂)$/i.test(buttonText(e))),
      loginForm: select('input[type="password"]').length > 0,
      reviewPage,
      livePoll: select('app-poll').length > 0,
      answerControls: !reviewPage && (letterChoices >= 2 || radioChoices >= 2 || submit),
      questionIdentity: identity, questionImage: imageIdentity
    });
  }

  async function send(message) {
    try { return await chrome.runtime.sendMessage(message); }
    catch (error) {
      if (/context invalidated/i.test(String(error))) {
        stopped = true;
        observer.disconnect();
        clearInterval(interval);
      }
      return { ok: false, error: String(error) };
    }
  }
  function scan() {
    if (stopped || !document.body) return;
    const next = readPage();
    const key = JSON.stringify(next);
    const now = Date.now();
    // Wait for a stable DOM snapshot, avoiding alerts from a briefly replaced view.
    if (candidate !== key) { candidate = key; candidateAt = now; schedule(350); return; }
    if (now - candidateAt < 300) { schedule(350); return; }
    if (lastStatus !== key || now - lastStatusAt > 30000) {
      lastStatus = key; lastStatusAt = now;
      void send({ type: 'STATUS', state: next.state, label: next.label, scope: next.scope });
    }
    for (const event of tracker.update(next)) {
      void send({ type: 'EVENT', ...event }).then(result => {
        if (result?.ok === false && !stopped) {
          // Retry once only while the same event is still represented on the page.
          setTimeout(() => {
            if (!stopped && candidate === key) void send({ type: 'EVENT', ...event });
          }, 1500);
        }
      });
    }
  }
  function schedule(delay = 200) {
    if (!scheduled && !stopped) scheduled = setTimeout(() => { scheduled = null; scan(); }, delay);
  }
  const observer = new MutationObserver(() => schedule());
  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'aria-disabled', 'src', 'aria-label', 'data-question-id']
  });
  const interval = setInterval(scan, 3000);
  addEventListener('hashchange', () => schedule());
  addEventListener('pageshow', () => schedule());
  addEventListener('online', () => schedule());
  document.addEventListener('visibilitychange', () => schedule());
  schedule();
})();
