/*
 * Phone availability hint (no dependencies).
 *
 * Outside the call windows the "Zadzwoń" / "Telefon" links are greyed out and
 * get a tooltip saying nobody may pick up. They stay clickable (tel: still works).
 * Windows are in Europe/Warsaw time, every day: 10:00-15:00 and 20:00-22:00.
 */
(function () {
  'use strict';

  var WINDOWS = [[10 * 60, 15 * 60], [20 * 60, 22 * 60]]; // minutes since midnight
  var NOTE = 'Poza godzinami dyżuru telefonicznego (10:00–15:00 i 20:00–22:00) mogę nie odebrać. Spróbuj później lub napisz na WhatsApp.';

  function warsawMinutes() {
    try {
      var p = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var h = 0, m = 0;
      p.forEach(function (x) {
        if (x.type === 'hour') h = parseInt(x.value, 10);
        if (x.type === 'minute') m = parseInt(x.value, 10);
      });
      return h * 60 + m;
    } catch (e) { return null; }
  }

  function inWindow(min) {
    return WINDOWS.some(function (w) { return min >= w[0] && min < w[1]; });
  }

  function apply() {
    var min = warsawMinutes();
    if (min === null) return; // unknown time: leave buttons normal
    var off = !inWindow(min);
    var links = document.querySelectorAll('a[href^="tel:"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      a.classList.toggle('call-off', off);
      if (off) {
        a.setAttribute('title', NOTE);
        a.setAttribute('data-call-note', NOTE);
      } else {
        a.removeAttribute('title');
        a.removeAttribute('data-call-note');
      }
    }
  }

  apply();
  setInterval(apply, 60 * 1000);
})();
