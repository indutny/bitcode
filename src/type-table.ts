import * as assert from 'assert';
import { types } from 'bitcode-builder';

import { Abbr, BitStream } from './bitstream';
import { BLOCK_ID, TYPE_CODE } from './constants';

const TYPE_ABBR_ID_WIDTH = 4;

export class TypeTable {
  private readonly list: types.Type[] = [];

  // typeString => index in `list`
  private readonly map: Map<string, number> = new Map();

  public add(ty: types.Type): number {
    const key = ty.typeString;
    if (this.map.has(ty.typeString)) {
      const cachedIndex = this.map.get(ty.typeString)!;
      const stored = this.list[cachedIndex]!;

      // Sanity check, types must be compatible
      assert(stored.isEqual(ty), `Incompatible types for: "${key}"`);
      return cachedIndex;
    }

    // Add sub-types first
    if (ty.isArray()) {
      this.add(ty.toArray().elemType);
    } else if (ty.isPointer()) {
      this.add(ty.toPointer().to);
    } else if (ty.isSignature()) {
      this.addSignature(ty.toSignature());
    } else if (ty.isStruct()) {
      this.addStruct(ty.toStruct());
    }

    const index = this.list.length;
    this.list.push(ty);
    this.map.set(key, index);
    return index;
  }

  public get(ty: types.Type): number {
    const key = ty.typeString;
    assert(this.map.has(key), `Type: "${key}" not found`);

    return this.map.get(key) as number;
  }

  public build(writer: BitStream): void {
    writer.enterBlock(BLOCK_ID.TYPE, TYPE_ABBR_ID_WIDTH);
    writer.writeUnabbrRecord(TYPE_CODE.NUMENTRY, [ this.list.length ]);
    for (const ty of this.list) {
      this.write(writer, ty);
    }
    writer.endBlock();
  }

  // Private API

  private addSignature(sig: types.Signature): void {
    this.add(sig.returnType);
    for (const param of sig.params) {
      this.add(param);
    }
  }

  private addStruct(struct: types.Struct): void {
    for (const field of struct.fields) {
      this.add(field.ty);
    }
  }

  private write(writer: BitStream, ty: types.Type): void {
    // Add sub-types first
    if (ty.isArray()) {
      this.writeArray(writer, ty.toArray());
    } else if (ty.isInt()) {
      this.writeInt(writer, ty.toInt());
    } else if (ty.isLabel()) {
      this.writeLabel(writer, ty.toLabel());
    } else if (ty.isPointer()) {
      this.writePointer(writer, ty.toPointer());
    } else if (ty.isSignature()) {
      this.writeSignature(writer, ty.toSignature());
    } else if (ty.isStruct()) {
      this.writeStruct(writer, ty.toStruct());
    } else if (ty.isVoid()) {
      this.writeVoid(writer, ty.toVoid());
    } else {
      throw new Error(`Unsupported type: "${ty.typeString}"`);
    }
  }

  private writeArray(writer: BitStream, ty: types.Array): void {
    // implement me
  }

  private writeInt(writer: BitStream, ty: types.Int): void {
    if (!writer.hasAbbr('int')) {
      writer.defineAbbr(new Abbr('int', [
        Abbr.literal(TYPE_CODE.INTEGER),
        Abbr.vbr(8),
      ]));
    }

    writer.writeRecord('int', [ ty.width ]);
  }

  private writeLabel(writer: BitStream, ty: types.Label): void {
    // implement me
  }

  private writePointer(writer: BitStream, ty: types.Pointer): void {
    // implement me
  }

  private writeSignature(writer: BitStream, ty: types.Signature): void {
    // implement me
  }

  private writeStruct(writer: BitStream, ty: types.Struct): void {
    // implement me
  }

  private writeVoid(writer: BitStream, ty: types.Void): void {
    // implement me
  }
}
