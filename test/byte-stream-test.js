'use strict';
/* globals describe it beforeEach */

const assert = require('assert');

const ByteStream = require('../lib/bitcode/').ByteStream;

describe('bitcode/ByteStream', () => {
  let b;

  beforeEach(() => b = new ByteStream());

  it('should write bytes', () => {
    const SIZE = 32000;
    for (let i = 0; i < SIZE; i++)
      b.writeByte(i & 0xff);
    b.end();

    const res = b.read(SIZE);
    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i++)
      assert.strictEqual(res[i], i & 0xff, 'Mismatch at: ' + i);

    assert(!b.read());
  });

  it('should write words and bytes', () => {
    const SIZE = 30000;
    for (let i = 0; i < SIZE; i += 3) {
      b.writeWord(i & 0xffff);
      // This should make alignment more complicated
      b.writeByte(i & 0xff);
    }
    b.end();

    const res = b.read(SIZE);
    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i += 3) {
      assert.strictEqual(res.readUInt16LE(i), i & 0xffff, 'Mismatch at: ' + i);
      assert.strictEqual(res[i + 2], i & 0xff, 'Mismatch at: ' + i);
    }

    assert(!b.read());
  });

  it('should write dwords and bytes', () => {
    const SIZE = 30000;
    for (let i = 0; i < SIZE; i += 5) {
      b.writeDWord(i & 0xffffffff);
      // This should make alignment more complicated
      b.writeByte(i & 0xff);
    }
    b.end();

    const res = b.read(SIZE);
    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i += 5) {
      assert.strictEqual(res.readUInt32LE(i),
        i & 0xffffffff, 'Mismatch at: ' + i);
      assert.strictEqual(res[i + 4], i & 0xff, 'Mismatch at: ' + i);
    }

    assert(!b.read());
  });
});
