'use strict';

const bitcode = require('./');
const constants = bitcode.constants;

const BLOCK = constants.BLOCK;
const RECORD = constants.RECORD;

const TYPE_ABBR_WIDTH = 6;

class TypeTable {
  constructor() {
    this.cache = new Map();
    this.list = [];
  }

  cachedType(key, value) {
    if (this.cache.has(key))
      return this.cache.get(key);

    const res = this.list.length;
    this.cache.set(key, res);
    this.list.push(value);
    return res;
  }

  getInt(width) {
    return this.cachedType('i' + width, { type: 'int', width });
  }

  // TODO(indutny): address space
  getPointerTo(type) {
    return this.cachedType('p' + type, { type: 'ptr', to: type });
  }

  serializeTo(stream) {
    stream.enterBlock(BLOCK.TYPE, TYPE_ABBR_WIDTH);

    stream.writeUnabbrevRecord(RECORD.TYPE_CODE_NUMENTRY, [ this.list.length ]);

    // TODO(indutny): abbreviate
    this.list.forEach((entry) => {
      if (entry.type === 'int') {
        stream.writeUnabbrevRecord(RECORD.TYPE_CODE_INTEGER, [ entry.width ]);
      } else if (entry.type === 'ptr') {
        stream.writeUnabbrevRecord(RECORD.TYPE_CODE_POINTER, [ entry.to ]);
      } else {
        throw new Error('Unsupported type: ' + entry.type);
      }
    });

    stream.endBlock();
  }
}
module.exports = TypeTable;
