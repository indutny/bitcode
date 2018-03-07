import * as assert from 'assert';

import { ByteWriter } from '../lib/writers';

describe('bitcode/writers/byte-writer', () => {
  let b: ByteWriter;
  beforeEach(() => {
    b = new ByteWriter();
  });

  it('should write bytes', () => {
    const SIZE = 32000;
    for (let i = 0; i < SIZE; i++) {
      b.writeByte(i & 0xff);
    }
    const res = b.end();
    assert.strictEqual(b.offset, SIZE);

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
    const res = b.end();
    assert.strictEqual(b.offset, SIZE);

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
    const res = b.end();
    assert.strictEqual(b.offset, SIZE);

    assert.strictEqual(res.length, SIZE);
    for (let i = 0; i < SIZE; i += 5) {
      assert.strictEqual(res.readUInt32LE(i),
        i & 0xffffffff, 'Mismatch at: ' + i);
      assert.strictEqual(res[i + 4], i & 0xff, 'Mismatch at: ' + i);
    }
  });

  it('should reserve bytes', () => {
    const SIZE = 16384;

    b.writeDWord(123);
    assert.strictEqual(b.offset, 4);
    const dword = b.reserve(4);
    assert.strictEqual(b.offset, 8);
    b.writeDWord(789);
    assert.strictEqual(b.offset, 12);

    assert.strictEqual(dword.length, 4);
    dword.writeUInt32LE(456, 0);

    const res = b.end();
    assert.strictEqual(b.offset, res.length);

    assert.strictEqual(res.readUInt32LE(0), 123);
    assert.strictEqual(res.readUInt32LE(4), 456);
    assert.strictEqual(res.readUInt32LE(8), 789);
  });
});
