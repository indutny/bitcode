import * as assert from 'assert';

import { BitWriter } from '../lib/writers';

describe('bitcode/writers/byte-writer', () => {
  let b: BitWriter;
  beforeEach(() => {
    b = new BitWriter();
  });

  it('should write bytes', () => {
    const SIZE = 32000;
    for (let i = 0; i < SIZE; i++) {
      b.writeByte(i & 0xff);
    }
    assert.strictEqual(b.bitOffset, SIZE * 8);
    const res = b.end();
    assert.strictEqual(b.bitOffset, SIZE * 8);

    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i++) {
      assert.strictEqual(res[i], i & 0xff, 'Mismatch at: ' + i);
    }
  });

  it('should write words and bytes', () => {
    const SIZE = 30000;
    for (let i = 0; i < SIZE; i += 3) {
      b.writeWord(i & 0xffff);
      // This should make alignment more complicated
      b.writeByte(i & 0xff);
    }
    assert.strictEqual(b.bitOffset, SIZE * 8);
    const res = b.end();
    assert.strictEqual(b.bitOffset, SIZE * 8);

    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i += 3) {
      assert.strictEqual(res.readUInt16LE(i), i & 0xffff, 'Mismatch at: ' + i);
      assert.strictEqual(res[i + 2], i & 0xff, 'Mismatch at: ' + i);
    }
  });

  it('should write dwords and bytes', () => {
    const SIZE = 30000;
    for (let i = 0; i < SIZE; i += 5) {
      b.writeDWord(i & 0xffffffff);
      // This should make alignment more complicated
      b.writeByte(i & 0xff);
    }
    assert.strictEqual(b.bitOffset, SIZE * 8);
    const res = b.end();
    assert.strictEqual(b.bitOffset, SIZE * 8);

    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i += 5) {
      assert.strictEqual(res.readUInt32LE(i),
        i & 0xffffffff, 'Mismatch at: ' + i);
      assert.strictEqual(res[i + 4], i & 0xff, 'Mismatch at: ' + i);
    }
  });

  it('should write mixed bits', () => {
    b.writeBits(3, 31);
    assert.strictEqual(b.bitOffset, 31);
    b.writeBits(7, 4);
    assert.strictEqual(b.bitOffset, 35);
    const res = b.end();
    assert.strictEqual(b.bitOffset, 40);

    assert.strictEqual(res.toString('hex'), '0300008003');
  });

  it('should align', () => {
    b.writeBits(3, 31);
    b.align(32);
    assert.strictEqual(b.bitOffset, 32);
    const res = b.end();
    assert.strictEqual(b.bitOffset, 32);

    assert.strictEqual(res.toString('hex'), '03000000');
  });
});
