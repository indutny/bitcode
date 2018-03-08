import * as assert from 'assert';
import { types } from 'bitcode-builder';

import { BitStream } from './bitstream';

export class TypeTable {
  private readonly list: types.Type[] = [];

  // typeString => index in `list`
  private readonly map: Map<string, number> = new Map();

  constructor(private readonly writer: BitStream) {
  }

  public write(ty: types.Type): number {
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
      this.writeArray(ty.toArray());
    } else if (ty.isInt()) {
      this.writeInt(ty.toInt());
    } else if (ty.isLabel()) {
      this.writeLabel(ty.toLabel());
    } else if (ty.isPointer()) {
      this.writePointer(ty.toPointer());
    } else if (ty.isSignature()) {
      this.writeSignature(ty.toSignature());
    } else if (ty.isStruct()) {
      this.writeStruct(ty.toStruct());
    } else if (ty.isVoid()) {
      this.writeVoid(ty.toVoid());
    } else {
      throw new Error(`Unsupported type: "${key}"`);
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

  // Private

  private writeArray(ty: types.Array): void {
    // implement me
  }

  private writeInt(ty: types.Int): void {
    // implement me
  }

  private writeLabel(ty: types.Label): void {
    // implement me
  }

  private writePointer(ty: types.Pointer): void {
    // implement me
  }

  private writeSignature(ty: types.Signature): void {
    // implement me
  }

  private writeStruct(ty: types.Struct): void {
    // implement me
  }

  private writeVoid(ty: types.Void): void {
    // implement me
  }
}
