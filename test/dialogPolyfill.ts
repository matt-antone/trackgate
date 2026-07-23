// jsdom does not implement HTMLDialogElement.showModal()/close(), which the
// default ConsentDialog relies on. Polyfill minimally so tests can render it.
// Imported (for side effects) by any test file that renders <CipaProvider>
// with the default dialog.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
}
