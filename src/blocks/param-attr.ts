import * as assert from 'assert';
import { Attribute, AttributeList, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream } from '../bitstream';
import { BLOCK_ID, PARAMATTR_CODE, PARAMATTR_GROUP_CODE } from '../constants';
import { encodeAttributeKey } from '../encoding';
import { Block } from './base';

import constants = values.constants;

const PARAMATTR_GROUP_ABBR_ID_WIDTH = 2;
const PARAMATTR_ABBR_ID_WIDTH = 2;

// TODO(indutny): use enum?
const WELL_KNOWN = 0;
const WELL_KNOWN_WITH_DATA = 1;
const STRING_ATTR = 3;
const STRING_ATTR_WITH_DATA = 4;

interface IEncodedAttribute {
  readonly key: number | string;
  readonly value: number | string | undefined;
}

type GroupId = number;

interface IParamGroup {
  readonly attrs: IEncodedAttribute[];
  readonly id: GroupId;
  readonly paramIndex: number;
}

type ParamEntry = GroupId[];

export type ParamEntryIndex = number;

const RET_ATTR_INDEX = 0;
const FN_ATTR_INDEX = 0xffffffff;

export class ParamAttrBlock extends Block {
  private groupCache: Map<string, IParamGroup> = new Map();
  private groups: IParamGroup[] = [];
  private entries: ParamEntry[] = [];
  private map: Map<values.Value, ParamEntryIndex> = new Map();

  public addDecl(decl: constants.Declaration): void {
    this.checkNotBuilt();

    const entry: ParamEntry = [];

    this.addGroup(RET_ATTR_INDEX, decl.returnAttrs, entry);
    this.addGroup(FN_ATTR_INDEX, decl.attrs, entry);

    decl.paramAttrs.forEach((attrs, index) => {
      return this.addGroup(1 + index, attrs, entry);
    });

    // No parameters to set
    if (entry.length === 0) {
      return;
    }

    this.map.set(decl, this.entries.length);
    this.entries.push(entry);
  }

  public addGlobal(global: values.Global): void {
    this.checkNotBuilt();

    const entry: ParamEntry = [];

    this.addGroup(FN_ATTR_INDEX, global.attrs, entry);

    // No parameters to set
    if (entry.length === 0) {
      return;
    }

    this.map.set(global, this.entries.length);
    this.entries.push(entry);
  }

  public get(value: values.Value): ParamEntryIndex | undefined {
    return this.map.get(value);
  }

  public build(writer: BitStream): void {
    super.build(writer);

    if (this.groups.length === 0) {
      return;
    }

    writer.enterBlock(BLOCK_ID.PARAMATTR_GROUP, PARAMATTR_GROUP_ABBR_ID_WIDTH);
    for (const group of this.groups) {
      let operands: number[] = [ group.id, group.paramIndex ];
      for (const attr of group.attrs) {
        const key = attr.key;
        const value = attr.value;

        if (typeof key === 'number') {
          if (value === undefined) {
            operands.push(WELL_KNOWN, key as number);
          } else {
            assert.strictEqual(typeof value, 'number');
            operands.push(WELL_KNOWN_WITH_DATA, key as number, value as number);
          }
        } else {
          assert.strictEqual(typeof key, 'string');
          const arrKey: number[] = Array.from(Buffer.from(key as string));

          if (value === undefined) {
            operands.push(STRING_ATTR);
            operands = operands.concat(arrKey);
            operands.push(0);
          } else {
            assert.strictEqual(typeof value, 'string');

            operands.push(STRING_ATTR_WITH_DATA);
            operands = operands.concat(arrKey);
            operands.push(0);
            operands = operands.concat(
              Array.from(Buffer.from(value as string)));
            operands.push(0);
          }
        }
      }
      writer.writeUnabbrRecord(PARAMATTR_GROUP_CODE.ENTRY, operands);
    }
    writer.endBlock(BLOCK_ID.PARAMATTR_GROUP);

    writer.enterBlock(BLOCK_ID.PARAMATTR, PARAMATTR_ABBR_ID_WIDTH);
    for (const entry of this.entries) {
      writer.writeUnabbrRecord(PARAMATTR_CODE.ENTRY, entry);
    }
    writer.endBlock(BLOCK_ID.PARAMATTR);
  }

  private addGroup(paramIndex: number, attrList: AttributeList,
                   to: number[]): void {
    const attrs: IEncodedAttribute[] = Array.from(attrList).map((attr) => {
      let key: number | string;
      let value: number | string | undefined;
      if (typeof attr === 'string') {
        key = attr;
      } else {
        key = attr.key;
        value = attr.value;
      }

      const knownKey = encodeAttributeKey(key);
      if (knownKey !== undefined) {
        key = knownKey;
        assert(value === undefined || typeof value === 'number',
          `Invalid known attribute value: "${value}"`);
      }

      return { key, value };
    });

    if (attrs.length === 0) {
      return;
    }

    // Sort by key
    attrs.sort((a, b) => {
      assert.notStrictEqual(a.key, b.key, 'Duplicate attributes');
      return a.key > b.key ? 1 : -1;
    });

    // Compute cache key
    const cacheKeyList: string[] = [];
    attrs.forEach((attr) => {
      if (attr.value === undefined) {
        cacheKeyList.push(attr.key.toString());
      } else {
        cacheKeyList.push(attr.key.toString() + ':' + attr.value);
      }
    });

    const cacheKey = cacheKeyList.join(',');
    if (this.groupCache.has(cacheKey)) {
      to.push(this.groupCache.get(cacheKey)!.id);
      return;
    }

    const group = {
      attrs,
      id: this.groups.length + 1,
      paramIndex,
    };
    this.groups.push(group);
    this.groupCache.set(cacheKey, group);
    to.push(group.id);
  }
}
