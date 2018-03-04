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
    assert.strictEqual(b.offset, SIZE);

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
    assert.strictEqual(b.offset, SIZE);

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
    assert.strictEqual(b.offset, SIZE);

    const res = b.read(SIZE);
    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i += 5) {
      assert.strictEqual(res.readUInt32LE(i),
        i & 0xffffffff, 'Mismatch at: ' + i);
      assert.strictEqual(res[i + 4], i & 0xff, 'Mismatch at: ' + i);
    }

    assert(!b.read());
  });

  it('should reserve dwords', () => {
    const SIZE = 16384;

    // Reserve two early
    const res1 = b.reserveDWord();
    const res2 = b.reserveDWord();

    // Pad
    for (let i = 8; i < SIZE; i++) {
      // This should make alignment more complicated
      b.writeByte(i & 0xff);
    }

    // Reserve two late
    const res3 = b.reserveDWord();
    const res4 = b.reserveDWord();

    // Pad again
    for (let i = 8; i < SIZE; i++) {
      // This should make alignment more complicated
      b.writeByte(i & 0xff);
    }

    assert.throws(() => b.end(), /unresolved/);
    assert.strictEqual(b.offset, SIZE * 2);

    b.resolveDWord(res1, 0xdeadc0de);
    assert.throws(() => b.end(), /unresolved/);
    assert(!b.read());
    b.resolveDWord(res2, 0xdeadc1de);
    assert.throws(() => b.end(), /unresolved/);

    let part = b.read();
    assert.strictEqual(part.length, SIZE);
    assert(!b.read());

    assert.strictEqual(part.readUInt32LE(0), 0xdeadc0de);
    assert.strictEqual(part.readUInt32LE(4), 0xdeadc1de);
    for (let i = 8; i < SIZE; i++)
      assert.strictEqual(part[i], i & 0xff, 'Mismatch at: ' + i);

    b.resolveDWord(res3, 0xabbaabba);
    assert.throws(() => b.end(), /unresolved/);
    assert(!b.read());
    b.resolveDWord(res4, 0xbaabbaab);
    b.end();

    part = b.read();
    assert.strictEqual(part.length, SIZE);
    assert(!b.read());

    assert.strictEqual(part.readUInt32LE(0), 0xabbaabba);
    assert.strictEqual(part.readUInt32LE(4), 0xbaabbaab);
    for (let i = 8; i < SIZE; i++)
      assert.strictEqual(part[i], i & 0xff, 'Mismatch at: ' + i);
  });
});
