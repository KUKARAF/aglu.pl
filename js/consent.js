/*
 * Minimal consent layer (no dependencies).
 *
 * Stored in localStorage under "aglu-consent":
 *   {"v":"granted"|"denied","t":<unix ms of the choice>}
 * The choice expires after 180 days and the notice is shown again.
 *
 * API:
 *   window.aglConsent.get()   -> "granted" | "denied" | null (not decided / expired)
 *   window.aglConsent.set(v)  -> store choice, fire event
 *   window.aglConsent.open()  -> show the notice again (footer "Ustawienia cookies")
 *   window.addEventListener('consent-change', e => e.detail.state)
 *
 * Google embeds (calendar, map) stay as placeholders until consent is granted,
 * or until the visitor clicks the per-embed "Załaduj ..." button.
 * The same consent also allows recording the Google Ads click id (gclid) with
 * contact-button clicks, see "ad measurement" below.
 */
(function () {
  'use strict';

  var KEY = 'aglu-consent';
  var TTL = 180 * 24 * 60 * 60 * 1000;
  var POLICY = '/polityka-prywatnosci/';

  function read() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY));
      if (o && (o.v === 'granted' || o.v === 'denied') && Date.now() - o.t < TTL) return o.v;
    } catch (e) {}
    return null;
  }

  var state = read();

  function emit() {
    window.dispatchEvent(new CustomEvent('consent-change', { detail: { state: state } }));
  }

  /* ---------- embeds ---------- */

  function embedParts(name) {
    var ph = document.querySelector('[data-embed-ph="' + name + '"]');
    var fr = document.querySelector('iframe[data-embed="' + name + '"]');
    return ph && fr ? { ph: ph, fr: fr, box: ph.parentNode } : null;
  }

  function loadEmbed(name) {
    var p = embedParts(name);
    if (!p || p.fr.getAttribute('src')) return;
    p.fr.setAttribute('src', p.fr.getAttribute('data-src'));
    p.fr.hidden = false;
    p.ph.hidden = true;
    p.box.classList.add('embed-on');
  }

  function unloadEmbed(name) {
    var p = embedParts(name);
    if (!p || !p.fr.getAttribute('src')) return;
    p.fr.removeAttribute('src');
    p.fr.hidden = true;
    p.ph.hidden = false;
    p.box.classList.remove('embed-on');
  }

  var EMBEDS = ['calendar', 'map'];

  function syncEmbeds() {
    EMBEDS.forEach(state === 'granted' ? loadEmbed : unloadEmbed);
  }

  /* ---------- ad measurement (gclid) ----------
   * No Google tag and no Google cookies. Google Ads auto-tagging appends
   * ?gclid=<id> to the landing URL. Umami is told to drop the query string
   * (data-exclude-search on its script tag), so the id is NOT recorded by
   * default. Only after consent is granted do we put it on the contact
   * buttons as Umami event data (data-umami-event-gclid), so a click on
   * call / calendar / WhatsApp is stored together with the ad click id.
   * It is exported from Umami and uploaded to Google Ads as offline
   * conversions (see ads-conversions.sql on the server).
   * Nothing is written to the visitor's device. Conversion measurement only:
   * no remarketing, no ad personalization (sensitive health topic).
   */
  function adClickId() {
    var m = /[?&]gclid=([A-Za-z0-9_-]{20,200})(?:&|#|$)/.exec(window.location.search);
    return m ? m[1] : null;
  }

  function syncMarketing() {
    var id = state === 'granted' ? adClickId() : null;
    var els = document.querySelectorAll('[data-umami-event]');
    for (var i = 0; i < els.length; i++) {
      if (id) els[i].setAttribute('data-umami-event-gclid', id);
      else els[i].removeAttribute('data-umami-event-gclid');
    }
  }

  /* ---------- notice ---------- */

  var bar = null;

  function build() {
    bar = document.createElement('section');
    bar.className = 'consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Zgoda na cookies');
    bar.hidden = true;
    bar.innerHTML =
      '<p>Kalendarz i mapa Google mogą zapisywać cookies, a do mierzenia skuteczności reklam Google Ads zapisuję identyfikator kliknięcia z reklamy. <a href="' + POLICY + '">Polityka prywatności</a></p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-btn" data-c="granted">Akceptuję</button>' +
      '<button type="button" class="consent-btn" data-c="denied">Odrzucam</button>' +
      '</div>';
    bar.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-c]');
      if (b) api.set(b.getAttribute('data-c'));
    });
    document.body.appendChild(bar);
  }

  function show(v) {
    if (!bar) build();
    bar.hidden = !v;
    document.documentElement.classList.toggle('consent-open', !!v);
  }

  var api = {
    get: function () { return state; },
    set: function (v) {
      if (v !== 'granted' && v !== 'denied') return;
      state = v;
      try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
      show(false);
      syncEmbeds();
      syncMarketing();
      emit();
    },
    open: function () { show(true); }
  };
  window.aglConsent = api;

  /* ---------- init ---------- */

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-consent-open')) {
      api.open();
      var first = bar.querySelector('button');
      if (first) first.focus({ preventScroll: true }); // explicit user action only
    } else if (t.classList.contains('embed-load')) {
      var ph = t.closest('[data-embed-ph]');
      if (ph) loadEmbed(ph.getAttribute('data-embed-ph'));
    }
  });

  syncEmbeds();
  syncMarketing();
  if (state === null) show(true);
})();
