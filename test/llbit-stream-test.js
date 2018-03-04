'use strict';
/* globals describe it beforeEach */

const assert = require('assert');

const LLBitStream = require('../lib/bitcode/').LLBitStream;

describe('bitcode/LLBitStream', () => {
  let b;

  beforeEach(() => b = new LLBitStream());

  describe('32-bit vbr', () => {
    it('should write short 6-bit vbr', () => {
      b.writeVBR(0x3, 6);
      assert.strictEqual(b.bitOffset, 6);
      b.end();
      assert.strictEqual(b.bitOffset, 8);

      const res = b.read(b.offset);
      assert(!b.read());
      assert.strictEqual(res.toString('hex'), '03');
    });

    it('should write long 6-bit vbr', () => {
      b.writeVBR(0xabba, 6);
      assert.strictEqual(b.bitOffset, 24);
      b.end();
      assert.strictEqual(b.bitOffset, 24);

      const res = b.read(b.offset);
      assert(!b.read());
      assert.strictEqual(res.toString('hex'), '7aaf06');
    });
  });

  describe('64-bit vbr', () => {
    it('should write short 6-bit vbr', () => {
      b.writeVBR64(0, 0x3, 6);
      assert.strictEqual(b.bitOffset, 6);
      b.end();
      assert.strictEqual(b.bitOffset, 8);

      const res = b.read(b.offset);
      assert(!b.read());
      assert.strictEqual(res.toString('hex'), '03');
    });

    it('should write long 6-bit vbr', () => {
      b.writeVBR64(0xabbaabba, 0xc0dec0de, 6);
      assert.strictEqual(b.bitOffset, 78);
      b.end();
      assert.strictEqual(b.bitOffset, 80);

      const res = b.read(b.offset);
      assert(!b.read());
      assert.strictEqual(res.toString('hex'), 'be09f72db8de6bedde0a');
    });
  });
});
