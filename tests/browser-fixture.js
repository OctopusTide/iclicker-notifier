'use strict';
window.testMessages = [];
window.chrome = { runtime: { sendMessage: async message => {
  window.testMessages.push(message);
  return { ok: true };
} } };
location.hash = '/course/demo/overview';
document.querySelector('app-root').innerHTML = '<h1>示例课程</h1><div class="course-join-container" aria-hidden="true" style="height:0;overflow:hidden"><div id="join-inner-container" role="alert">Your instructor started class.<button id="btnJoin" disabled>Join</button></div></div>';
