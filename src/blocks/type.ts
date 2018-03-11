import * as assert from 'assert';
import { types } from 'bitcode-builder';

import { Abbr, BitStream } from '../bitstream';
import { BLOCK_ID, TYPE_CODE, VBR } from '../constants';
import { Block } from './base';

const TYPE_ABBR_ID_WIDTH = 4;

export class TypeBlock extends Block {
  // typeString => index
  private readonly indexMap: Map<string, number> = new Map();

  // typeString => Type in `list`
  private readonly typeMap: Map<string, types.Type> = new Map();

  public add(ty: types.Type): void {
    this.checkNotBuilt();

    const key = ty.typeString;
    if (this.typeMap.has(key)) {
      const stored = this.typeMap.get(ty.typeString)!;

      // Sanity check, types must be compatible
      assert(stored.isEqual(ty), `Incompatible types for: "${key}"`);
      return;
    }

    // Add sub-types
    if (ty.isArray()) {
      this.add(ty.toArray().elemType);
    } else if (ty.isPointer()) {
      this.add(ty.toPointer().to);
    } else if (ty.isSignature()) {
      this.addSignature(ty.toSignature());
    } else if (ty.isStruct()) {
      // Break loops created by named structs
      this.typeMap.set(key, ty);

      const struct = ty.toStruct();
      this.addStruct(struct);

      // Ensure correct ordering
      this.typeMap.delete(key);
    }

    this.typeMap.set(key, ty);
  }

  public get(ty: types.Type): number {
    this.checkBuilt();

    const key = ty.typeString;
    assert(this.indexMap.has(key), `Type: "${key}" not found`);

    return this.indexMap.get(key) as number;
  }

  public build(writer: BitStream): void {
    super.build(writer);

    const list = this.enumerate();

    writer.enterBlock(BLOCK_ID.TYPE, TYPE_ABBR_ID_WIDTH);
    writer.writeUnabbrRecord(TYPE_CODE.NUMENTRY, [ list.length ]);
    for (const ty of list) {
      console.log('write', ty.typeString);
      this.write(writer, ty);
    }
    writer.endBlock(BLOCK_ID.TYPE);
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

  private enumerate(): types.Type[] {
    const list = Array.from(this.typeMap.values());
    list.forEach((ty, index) => this.indexMap.set(ty.typeString, index));
    return list;
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
    if (!writer.hasAbbr('array')) {
      writer.defineAbbr(new Abbr('array', [
        Abbr.literal(TYPE_CODE.ARRAY),
        Abbr.vbr(VBR.ARRAY_LENGTH),
        Abbr.vbr(VBR.TYPE_INDEX),
      ]));
    }

    writer.writeRecord('array', [ ty.length, this.get(ty.elemType) ]);
  }

  private writeInt(writer: BitStream, ty: types.Int): void {
    if (!writer.hasAbbr('int')) {
      writer.defineAbbr(new Abbr('int', [
        Abbr.literal(TYPE_CODE.INTEGER),
        Abbr.vbr(VBR.INT_WIDTH),
      ]));
    }

    writer.writeRecord('int', [ ty.width ]);
  }

  private writeLabel(writer: BitStream, ty: types.Label): void {
    writer.writeUnabbrRecord(TYPE_CODE.LABEL, []);
  }

  private writePointer(writer: BitStream, ty: types.Pointer): void {
    if (!writer.hasAbbr('ptr')) {
      writer.defineAbbr(new Abbr('ptr', [
        Abbr.literal(TYPE_CODE.POINTER),
        Abbr.vbr(VBR.TYPE_INDEX),
      ]));
    }

    writer.writeRecord('ptr', [ this.get(ty.to) ]);
  }

  // TODO(indutny): vararg support
  private writeSignature(writer: BitStream, ty: types.Signature): void {
    writer.writeUnabbrRecord(TYPE_CODE.FUNCTION, [
      0,  // vararg
      this.get(ty.returnType),
    ].concat(ty.params.map((p) => this.get(p))));
  }

  // TODO(indutny): support packed structs
  private writeStruct(writer: BitStream, ty: types.Struct): void {
    let code = TYPE_CODE.STRUCT_ANON;
    if (ty.name !== undefined) {
      if (!writer.hasAbbr('struct_name')) {
        writer.defineAbbr(new Abbr('struct_name', [
          Abbr.literal(TYPE_CODE.STRUCT_NAME),
          Abbr.array(Abbr.char6()),
        ]));
      }

      writer.writeRecord('struct_name', [ ty.name ]);
      code = TYPE_CODE.STRUCT_NAMED;
    }

    // TODO(indutny): packed structs support
    const isPacked = 0;
    writer.writeUnabbrRecord(code,
      [ isPacked ].concat(ty.fields.map((f) => this.get(f.ty))));
  }

  private writeVoid(writer: BitStream, ty: types.Void): void {
    writer.writeUnabbrRecord(TYPE_CODE.VOID, []);
  }
}
