'use strict';

const assert = require('assert');
const stream = require('stream');
const Buffer = require('buffer').Buffer;

const CHUNK_SIZE = 16 * 1024;

const kChunks = Symbol('chunks');
const kSize = Symbol('size');
const kCurrent = Symbol('current');
const kOffset = Symbol('offset');
const kLeft = Symbol('left');
const kMaybeChunk = Symbol('maybeChunk');

class ByteStream extends stream.Readable {
  constructor() {
    super();

    // All allocated chunks
    this[kChunks] = [];

    // Total size of all pushed chunks in bytes
    this[kSize] = 0;

    // Current chunk
    this[kCurrent] = null;

    // Local offset in `this.current`
    this[kOffset] = 0;

    // Bytes left in `this.current`
    this[kLeft] = 0;
  }

  _read() {
    // no-op
  }

  get offset() {
    return this[kSize] + this[kOffset];
  }

  writeByte(val) {
    assert(0 <= val && val <= 0xff, 'Invalid byte value');

    this[kMaybeChunk]();

    // We have at least one byte here
    this[kLeft]--;
    this[kCurrent][this[kOffset]++] = val;

    return this;
  }

  writeWord(val) {
    assert(0 <= val && val <= 0xffff, 'Invalid word value');

    this[kMaybeChunk]();

    if (this[kLeft] >= 2) {
      this[kLeft] -= 2;
      this[kCurrent].writeUInt16LE(val, this[kOffset]);
      this[kOffset] += 2;
      return this;
    }

    // Just one byte
    this.writeByte(val & 0xff);
    this.writeByte(val >>> 8);
  }

  writeDWord(val) {
    assert(0 <= val && val <= 0xffffffff, 'Invalid word value');

    this[kMaybeChunk]();

    if (this[kLeft] >= 4) {
      this[kLeft] -= 4;
      this[kCurrent].writeUInt32LE(val, this[kOffset]);
      this[kOffset] += 4;
      return this;
    }

    // Less than four bytes
    this.writeWord(val & 0xffff);
    this.writeWord(val >>> 16);
  }

  end() {
    if (this[kLeft] === 0)
      return;

    const leftOver = this[kCurrent].slice(0, this[kOffset]);
    this[kCurrent] = null;

    this.push(leftOver);
  }

  // Private

  [kMaybeChunk]() {
    if (this[kLeft] !== 0)
      return;

    if (this[kCurrent] !== null) {
      this.push(this[kCurrent]);
      this[kSize] += this[kCurrent].length;
    }

    this[kCurrent] = Buffer.alloc(CHUNK_SIZE);
    this[kChunks].push(this[kCurrent]);
    this[kOffset] = 0;
    this[kLeft] = CHUNK_SIZE;
  }
}
module.exports = ByteStream;
