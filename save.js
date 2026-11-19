/* Save a generated file.
   - Normal hosting (GitHub Pages, local file): a plain <a download> link.
   - Inside a claude.ai artifact page, where plain downloads are blocked:
     the platform's `downloads` capability, which asks the viewer to confirm. */
(function (global) {
  'use strict';

  let nsPromise = null;
  function downloadsNs() {
    if (!nsPromise) {
      const c = global.claude;
      nsPromise = c && typeof c.use === 'function'
        ? c.use('downloads').catch(() => null)
        : Promise.resolve(null);
    }
    return nsPromise;
  }
  downloadsNs(); // start resolving early so the click doesn't wait

  function anchorSave(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  /** @returns {Promise<'saved'|'declined'|'failed'>} */
  async function saveFile(blob, name) {
    const ns = await downloadsNs();
    if (!ns) { anchorSave(blob, name); return 'saved'; }
    try {
      await ns.save({ filename: name, data: blob });
      return 'saved';
    } catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (e && (e.code === 'unavailable' || e.code === 'not_granted' || e.code === 'capability_disabled')) {
        anchorSave(blob, name);
        return 'saved';
      }
      return 'failed';
    }
  }

  global.saveFile = saveFile;
})(window);
