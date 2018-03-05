'use strict';

const Buffer = require('buffer').Buffer;

const bitcode = require('./');
const constants = bitcode.constants;

const BLOCK = constants.BLOCK;
const RECORD = constants.RECORD;

const STRTAB_ABBR_WIDTH = 3;

class Strtab {
  constructor() {
    this.strings = [];
    this.size = 0;

    this.cache = new Map();
  }

  add(string) {
    string = Buffer.from(string);
    const cacheKey = string.toString('hex');
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey);

    const res = { offset: this.size, size: string.length };
    this.strings.push(string);
    this.size += string.length;
    this.cache.set(cacheKey, res);
    return res;
  }

  serializeTo(stream) {
    stream.enterBlock(BLOCK.STRTAB, STRTAB_ABBR_WIDTH);

    // TODO(indutny): char6?
    const abbr = stream.defineAbbr([
      { type: 'literal', value: RECORD.STRTAB_BLOB },
      { type: 'blob' }
    ]);

    const blob = Buffer.concat(this.strings, this.size);
    stream.writeRecord(abbr, [ blob ]);

    stream.endBlock();
  }
}
module.exports = Strtab;
