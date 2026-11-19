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

  /* ---------- marketing tags (future) ----------
   * Load ONLY after consent is granted. Do not add remarketing / ad
   * personalization: Google Ads restricts it for sensitive (health) topics.
   * Conversion measurement only.
   *
   * 1) Consent Mode v2 defaults must be set BEFORE the gtag.js script loads
   *    (do it at the top of this file, or in an inline script in <head>):
   *
   *      window.dataLayer = window.dataLayer || [];
   *      function gtag(){ dataLayer.push(arguments); }
   *      gtag('consent', 'default', {
   *        ad_storage: 'denied', ad_user_data: 'denied',
   *        ad_personalization: 'denied', analytics_storage: 'denied'
   *      });
   *
   * 2) On accept, update and load the tag once:
   *
   *      gtag('consent', 'update', {
   *        ad_storage: 'granted', ad_user_data: 'granted',
   *        ad_personalization: 'denied',   // keep OFF (sensitive category)
   *        analytics_storage: 'denied'     // Umami is cookieless, no need
   *      });
   *      var s = document.createElement('script');
   *      s.async = true;
   *      s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX';
   *      document.head.appendChild(s);
   *      gtag('js', new Date());
   *      gtag('config', 'AW-XXXXXXXXXX', { allow_ad_personalization_signals: false });
   *
   * 3) On withdrawal (state === 'denied'), call gtag('consent','update', {all four: 'denied'}).
   *    Conversion event: gtag('event','conversion',{send_to:'AW-XXXXXXXXXX/LABEL'})
   *    fired e.g. on clicks of the calendar / phone / WhatsApp links.
   */
  var marketingLoaded = false;
  function syncMarketing() {
    if (state === 'granted' && !marketingLoaded) {
      marketingLoaded = true;
      // TODO: Google Ads tag goes here (see comment above).
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
      '<p>Kalendarz i mapa Google mogą zapisywać cookies. <a href="' + POLICY + '">Polityka prywatności</a></p>' +
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
