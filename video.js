/* MP4 (H.264) export in the browser with WebCodecs + mp4-muxer (vendor/).
   Works in Chrome and Edge. Frames are drawn at full resolution one by one,
   so export speed depends on the machine, not on real time. */
(function (global) {
  'use strict';

  // High profile at increasing levels; the encoder picks the first it accepts.
  const CODECS = ['avc1.640033', 'avc1.640034', 'avc1.64003C', 'avc1.64003D', 'avc1.64003E'];

  function supported() {
    return typeof global.VideoEncoder === 'function' && typeof global.VideoFrame === 'function';
  }

  function bitrateFor(W, H, fps) {
    // ~0.12 bits per pixel per frame, clamped to a sane range
    return Math.round(Math.min(120e6, Math.max(8e6, W * H * fps * 0.12)));
  }

  async function pickConfig(W, H, fps) {
    const bitrate = bitrateFor(W, H, fps);
    for (const codec of CODECS) {
      const config = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
      try {
        const res = await VideoEncoder.isConfigSupported(config);
        if (res.supported) return res.config;
      } catch { /* try next */ }
    }
    return null;
  }

  /**
   * @param {object} o
   * @param {number} o.width   even
   * @param {number} o.height  even
   * @param {number} o.fps
   * @param {number} o.seconds
   * @param {(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) => void} o.draw
   * @param {(f: number) => void} [o.onProgress]
   * @param {AbortSignal} [o.signal]
   * @returns {Promise<Blob>}
   */
  async function exportMp4(o) {
    if (!supported()) throw new Error('unsupported');
    const { width: W, height: H, fps, seconds } = o;
    const config = await pickConfig(W, H, fps);
    if (!config) throw new Error('size');

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: fps },
      fastStart: 'in-memory',
    });

    let failure = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: e => { failure = e; },
    });
    encoder.configure(config);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });

    const total = Math.max(1, Math.round(seconds * fps));
    const frameUs = 1e6 / fps;
    try {
      for (let i = 0; i < total; i++) {
        if (o.signal && o.signal.aborted) throw new DOMException('aborted', 'AbortError');
        if (failure) throw failure;
        // t runs 0 → (total-1)/total, so the clip loops back to frame 0 seamlessly
        o.draw(ctx, W, H, i / total);
        const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        while (encoder.encodeQueueSize > 2) await new Promise(r => setTimeout(r, 4));
        if (o.onProgress) o.onProgress((i + 1) / total);
        if (i % 4 === 0) await new Promise(r => setTimeout(r, 0)); // keep the UI responsive
      }
      await encoder.flush();
      if (failure) throw failure;
    } finally {
      if (encoder.state !== 'closed') encoder.close();
    }
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }

  global.VideoExport = { supported, exportMp4 };
})(window);
