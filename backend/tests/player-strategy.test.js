const test = require('node:test');
const assert = require('node:assert/strict');

const playerRoute = require('../src/routes/player');

const { pickStreamingStrategy } = playerRoute.__test__;

test('treats codec-unsafe mp4 as non-direct playback', () => {
  const strategy = pickStreamingStrategy({
    format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
    streams: [
      { codec_type: 'video', codec_name: 'hevc', pix_fmt: 'yuv420p10le', profile: 'Main 10', bits_per_raw_sample: '10' },
      { codec_type: 'audio', codec_name: 'aac' },
    ],
  }, '.mp4');

  assert.notEqual(strategy.mode, 'direct');
  assert.equal(strategy.mode, 'transcode');
});

test('keeps browser-safe mp4 as direct playback', () => {
  const strategy = pickStreamingStrategy({
    format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
    streams: [
      { codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', profile: 'High', bits_per_raw_sample: '8' },
      { codec_type: 'audio', codec_name: 'aac' },
    ],
  }, '.mp4');

  assert.equal(strategy.mode, 'direct');
});
