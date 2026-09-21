/* ===========================================================================
   YayCommerce — Order confirmation

   Copy-to-clipboard for the licence key. The button confirms in place, so
   there is no doubt about whether the copy worked.
   ======================================================================== */

(function () {
  "use strict";

  var button = document.querySelector("[data-copy-licence]");
  var key = document.querySelector("[data-licence-key]");
  if (!button || !key) return;

  var idle = button.textContent;
  var timer;

  function confirm(label) {
    button.textContent = label;
    clearTimeout(timer);
    timer = setTimeout(function () { button.textContent = idle; }, 1800);
  }

  button.addEventListener("click", function () {
    var text = key.textContent.trim();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { confirm("Copied"); },
        function () { confirm("Press ⌘C"); }
      );
      return;
    }

    // Older browsers: select the key so the keyboard shortcut works.
    var range = document.createRange();
    range.selectNodeContents(key);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    confirm("Press ⌘C");
  });
})();
