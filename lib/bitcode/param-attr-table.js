'use strict';

const assert = require('assert');

const bitcode = require('./');
const constants = bitcode.constants;

const BLOCK = constants.BLOCK;
const RECORD = constants.RECORD;
const ATTRIBUTES = constants.ATTRIBUTES;

const KIND_INT = 0;
const KIND_INT_VAL = 1;
const KIND_STRING = 3;
const KIND_STRING_VAL = 4;

const POSTFIX_PARAMINDEX = 0xffffffff;

const PARAMATTR_ABBR_WIDTH = 2;
const PARAMATTR_GROUP_ABBR_WIDTH = 2;

class ParamAttrTable {
  constructor() {
    this.cache = new Map();
    this.groups = [];
    this.params = [];
  }

  singleAttr(attr) {
    if (typeof attr === 'string')
      attr = { key: attr, value: null };

    const key = attr.key;
    const value = attr.value;
    const isKnown = ATTRIBUTES.hasOwnProperty(key);

    let res;
    if (isKnown) {
      res = [ value === null ? KIND_INT : KIND_INT_VAL ];
      res.push(ATTRIBUTES[key]);

      if (key === 'align' || key === 'alignstack' ||
          key === 'dereferenceable' || key === 'dereferenceable_or_null') {
        assert.strictEqual(typeof attr.value, 'number', 'Invalid attr value');
        res.push(attr.value);
      } else if (key === 'allocsize') {
        throw new Error('Implement me');
      } else {
        assert.strictEqual(value, null, 'Expected attr without value');
      }
    } else {
      res = [ value === null ? KIND_STRING : KIND_STRING_VAL ];
      res = res.concat(Array.from(Buffer.from(key)));
      res.push(0);

      if (value !== null) {
        res = res.concat(Array.from(Buffer.from(value)));
        res.push(0);
      }
    }

    return res;
  }

  groupAttrs(attrs, index) {
    let encoded = [];
    if (!Array.isArray(attrs))
      attrs = [ attrs ];

    attrs.forEach(attr => encoded = encoded.concat(this.singleAttr(attr)));

    const cacheKey = 'g:' + index + ':' + encoded.join(':');
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey);

    const res = this.groups.length + 1;
    this.groups.push({ index: res, encoded, paramIndex: index });
    this.cache.set(cacheKey, res);
    return res;
  }

  fn(ret, params, postfix) {
    const groups = [];
    if (ret !== null)
      groups.push(this.groupAttrs(ret, 0));
    params.forEach((param, index) => {
      if (param !== null)
        groups.push(this.groupAttrs(param, index + 1));
    });
    if (postfix !== null)
      groups.push(this.groupAttrs(postfix, POSTFIX_PARAMINDEX));

    const cacheKey = 'p:' + groups.join(':');
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey);

    this.params.push(groups);
    const res = this.params.length;
    this.cache.set(cacheKey, res);
    return res;
  }

  serializeTo(stream) {
    stream.enterBlock(BLOCK.PARAMATTR_GROUP, PARAMATTR_GROUP_ABBR_WIDTH);

    // TODO(indutny): abbreviate
    this.groups.forEach((group) => {
      stream.writeUnabbrevRecord(RECORD.PARAMATTR_GROUP_ENTRY, [
        group.index,
        group.paramIndex
      ].concat(group.encoded));
    });

    stream.endBlock();

    stream.enterBlock(BLOCK.PARAMATTR, PARAMATTR_ABBR_WIDTH);

    // TODO(indutny): abbreviate
    this.params.forEach((groups) => {
      stream.writeUnabbrevRecord(RECORD.PARAMATTR_ENTRY, groups);
    });

    stream.endBlock();
  }
}
module.exports = ParamAttrTable;
