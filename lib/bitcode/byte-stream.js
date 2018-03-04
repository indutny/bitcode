'use strict';

const assert = require('assert');
const stream = require('stream');
const Buffer = require('buffer').Buffer;

const CHUNK_SIZE = 16 * 1024;

const kSize = Symbol('size');
const kPending = Symbol('pending');
const kCurrent = Symbol('current');
const kOffset = Symbol('offset');
const kEnsureChunk = Symbol('ensureChunk');
const kEmitChunks = Symbol('emitChunks');
const kChunk = Symbol('chunk');

class DWordReservation {
  constructor(chunk, off) {
    this[kChunk] = chunk;
    this[kOffset] = off;
  }
}

class Chunk {
  constructor() {
    this.buffer = Buffer.alloc(CHUNK_SIZE);

    this.offset = 0;
    this.left = this.buffer.length;

    // Pointer to the next chunk in chain
    this.next = null;

    // Reservations in the chunk
    this.reservations = [];
  }
}

class ByteStream extends stream.Readable {
  constructor() {
    super();

    // Total size of all pushed chunks in bytes
    this[kSize] = 0;

    // Current chunk
    this[kCurrent] = null;

    // First pending chunk
    this[kPending] = null;
  }

  _read() {
    // no-op
  }

  get offset() {
    if (this[kCurrent] === null)
      return this[kSize];

    return this[kSize] + this[kCurrent].offset;
  }

  writeByte(val) {
    assert(0 <= val && val <= 0xff, 'Invalid byte value');

    const chunk = this[kEnsureChunk]();

    // We have at least one byte here
    chunk.buffer[chunk.offset++] = val;
    chunk.left--;

    return this;
  }

  writeWord(val) {
    assert(0 <= val && val <= 0xffff, 'Invalid word value');

    const chunk = this[kEnsureChunk]();

    if (chunk.left >= 2) {
      chunk.buffer.writeUInt16LE(val, chunk.offset);
      chunk.left -= 2;
      chunk.offset += 2;
      return this;
    }

    // Just one byte available
    this.writeByte(val & 0xff);
    this.writeByte(val >>> 8);
  }

  writeDWord(val) {
    assert(0 <= val && val <= 0xffffffff, 'Invalid word value');

    const chunk = this[kEnsureChunk]();

    if (chunk.left >= 4) {
      chunk.buffer.writeUInt32LE(val, chunk.offset);
      chunk.left -= 4;
      chunk.offset += 4;
      return this;
    }

    // Less than four bytes available
    this.writeWord(val & 0xffff);
    this.writeWord(val >>> 16);
  }

  reserveDWord() {
    const chunk = this[kEnsureChunk]();
    assert.strictEqual(chunk.offset % 4, 0,
      'Stream must be aligned before reservation');

    assert(chunk.left >= 4);

    const res = new DWordReservation(chunk, chunk.offset);
    chunk.left -= 4;
    chunk.offset += 4;
    chunk.reservations.push(res);

    if (this[kPending] === null)
      this[kPending] = chunk;

    return res;
  }

  resolveDWord(res, val) {
    const chunk = res[kChunk];
    const offset = res[kOffset];

    const index = chunk.reservations.indexOf(res);
    assert.notStrictEqual(index, -1, 'Can\'t resolve same reservation twice');

    chunk.reservations.splice(index, 1);
    chunk.buffer.writeUInt32LE(val, offset);

    this[kEmitChunks]();
  }

  end() {
    const chunk = this[kCurrent];
    assert.strictEqual(chunk, this[kPending],
      'Can\'t end stream with unresolved reservations');
    assert.strictEqual(chunk.reservations.length, 0,
      'Can\'t end stream with unresolved reservations');
    if (chunk.offset === 0) {
      this.push(null);
      return;
    }

    const leftover = chunk.buffer.slice(0, chunk.offset);
    this[kCurrent] = null;
    this[kSize] += leftover.length;

    this.push(leftover);
    this.push(null);
  }

  // Private

  [kEnsureChunk]() {
    const chunk = this[kCurrent];
    if (chunk && chunk.left !== 0)
      return chunk;

    // Add size of the previous chunk
    if (chunk)
      this[kSize] += CHUNK_SIZE;

    const next = new Chunk();
    this[kCurrent] = next;

    if (chunk) {
      chunk.next = next;
      this[kEmitChunks]();
    } else {
      assert.strictEqual(this[kPending], null);
      this[kPending] = next;
    }

    return next;
  }

  [kEmitChunks]() {
    while (this[kPending] !== this[kCurrent]) {
      const pending = this[kPending];

      // There're unresolved reservations in the chunk
      if (pending.reservations.length !== 0)
        break;

      // Whole chunk is completed - push it out
      this[kPending] = pending.next;
      this.push(pending.buffer);
    }
  }
}
module.exports = ByteStream;
