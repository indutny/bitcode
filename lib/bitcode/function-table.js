'use strict';

const assert = require('assert');

const bitcode = require('./');
const constants = bitcode.constants;

const RECORD = constants.RECORD;
const LINKAGE = constants.LINKAGE;
const CCONV = constants.CCONV;

class FunctionTable {
  constructor(strtab) {
    this.strtab = strtab;

    this.fns = [];
  }

  declare(name, type, info) {
    const entry = Object.assign({
      cconv: 'ccc',
      isDeclaration: false,
      linkage: 'internal',
      attributes: null,
      align: false,
      unnamed: false
    }, info, {
      type,
      name: this.strtab.add(name)
    });

    this.fns.push(entry);
  }

  serializeTo(stream) {
    this.fns.forEach((entry) => {
      assert(LINKAGE.hasOwnProperty(entry.linkage),
        'Unknown linkage: ' + entry.linkage);
      const linkage = LINKAGE[entry.linkage];

      assert(CCONV.hasOwnProperty(entry.cconv),
        'Unknown calling convention: ' + entry.cconv);
      const cconv = CCONV[entry.cconv];

      // TODO(indutny): use `defineAbbr`
      stream.writeUnabbrevRecord(RECORD.FUNCTION, [
        entry.name.offset,
        entry.name.size,

        entry.type,
        cconv,
        entry.isDeclaration ? 1 : 0,
        linkage,
        entry.attributes === null ? 0 : entry.attributes,
        entry.align === false ? 0 : (entry.align + 1),

        // TODO(indutny): support this
        0,  // section
        0,  // visibility
        0,  // has gc
        0,  // threadlocal

        entry.unnamed === false ? 0 : entry.unnamed === 'local' ? 2 : 1,

        // TODO(indutny): support this
        0,  // prologue data
        0,  // dllstorageclass
        0,  // comdat
        0,  // prefix data
        0  // personality
      ]);
    });
  }
}
module.exports = FunctionTable;
