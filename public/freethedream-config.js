// Switches FreeTheDream to Kronk's shared backend when it runs inside Kronk.
(function () {
  var token = null;
  try { var m = window.parent && window.parent !== window && window.parent.document.querySelector('meta[name="csrf-token"]'); token = m && m.getAttribute('content'); } catch (e) {}
  if (token) window.FTD_CONFIG = { backend: 'kronk', api: '/api/v1/freethedream', csrfToken: token };
})();
