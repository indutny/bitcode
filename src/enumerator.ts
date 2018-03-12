import * as assert from 'assert';
import { values } from 'bitcode-builder';

import constants = values.constants;
import Constant = constants.Constant;
import Metadata = constants.Metadata;

enum EnumerationMode {
  ALL,
  CONSTANTS_ONLY,
}

interface IEnumerationState {
  mode: EnumerationMode;
  constants: Constant[];
  metadata: Metadata[];
}

export interface IEnumeratorInput {
  decls: ReadonlyArray<constants.Declaration>;
  fns: ReadonlyArray<constants.Func>;
  globals: ReadonlyArray<values.Global>;
}

export type ConstantList = ReadonlyArray<Constant>;

export class Enumerator {
  private map: Map<values.Value, number> = new Map();
  private index: number = 0;
  private lastGlobalIndex: number = 0;
  private globalConstants: Constant[] = [];
  private functionConstants: Map<constants.Func, Constant[]> = new Map();
  private functionMetadata: Map<constants.Func, Metadata[]> = new Map();
  private metadataKinds: Map<string, number> = new Map();
  private lastEmittedIndex: number = 0;

  private constList: Constant[] | undefined;
  private metadataList: Metadata[] | undefined;

  public enumerate(input: IEnumeratorInput): void {
    // 1. Enumerate globals
    for (const g of input.globals) {
      this.enumerateValue(g);
    }

    // 2. Their initialization values
    for (const g of input.globals) {
      if (g.init) {
        this.enumerateGlobalConst(g.init);
      }
    }

    // 3. Enumerate functions
    for (const fn of input.fns) {
      this.enumerateDeclaration(fn);
    }

    // 4. Enumerate declarations
    for (const decl of input.decls) {
      this.enumerateDeclaration(decl);
    }

    this.lastGlobalIndex = this.index;

    // 5. Enumerate function bodies
    for (const fn of input.fns) {
      this.enumerateFunction(fn);
    }
  }

  public get(value: values.Value): number {
    assert(this.map.has(value), 'Stumbled upon non-enumerated value');
    return this.map.get(value)!;
  }

  public *[Symbol.iterator](): Iterator<values.Value> {
    yield* this.map.keys();
  }

  public getGlobalConstants(): ConstantList {
    return this.globalConstants;
  }

  public getFunctionConstants(fn: constants.Func): ConstantList {
    assert(this.functionConstants.has(fn), `Unexpected function: "${fn.name}"`);
    return this.functionConstants.get(fn)!;
  }

  public getMetadataKinds(): ReadonlyMap<string, number> {
    return this.metadataKinds;
  }

  public getFunctionMetadata(fn: constants.Func): ReadonlyArray<Metadata> {
    assert(this.functionMetadata.has(fn), `Unexpected function: "${fn.name}"`);
    return this.functionMetadata.get(fn)!;
  }

  // Ensure that values are emitted in the same order they were enumerated
  public checkValueOrder(value: values.Value): void {
    const index = this.get(value);
    assert(index >= this.lastEmittedIndex,
      'Invalid order of values (internal error)');
    this.lastEmittedIndex = index;
  }

  public leaveFunction(): void {
    assert(this.lastEmittedIndex >= this.lastGlobalIndex,
      'Invalid order of values (internal error)');
    this.lastEmittedIndex = this.lastGlobalIndex;
  }

  // Private API

  private enumerateValue(value: values.Value,
                         mode: EnumerationMode = EnumerationMode.ALL): void {
    if (this.constList !== undefined && value.isConstant() &&
        !value.toConstant().isDeclaration()) {
      this.constList.push(value.toConstant());
    }

    if (this.map.has(value)) {
      return;
    }

    if (mode === EnumerationMode.CONSTANTS_ONLY && !value.isConstant()) {
      return;
    }

    this.map.set(value, this.index);

    if (!value.ty.isVoid()) {
      this.index++;
    }
  }

  private enumerateGlobalConst(c: Constant): void {
    if (c.isArray()) {
      for (const elem of c.toArray().elems) {
        this.enumerateGlobalConst(elem);
      }
    } else if (c.isStruct()) {
      for (const field of c.toStruct().fields) {
        this.enumerateGlobalConst(field);
      }
    }

    // TODO(indutny): global metadata
    this.globalConstants.push(c);
    this.enumerateValue(c);
  }

  private enumerateFunction(fn: constants.Func): void {
    const constList: Constant[] = [];
    const metadataList: Metadata[] = [];

    for (const arg of fn.args) {
      this.enumerateValue(arg);
    }

    this.constList = constList;
    this.metadataList = metadataList;

    // Enumerate constants and metadata first
    for (const bb of fn) {
      this.enumerateBlock(bb, EnumerationMode.CONSTANTS_ONLY);
    }

    this.constList = undefined;
    this.metadataList = undefined;

    // All instructions later
    for (const bb of fn) {
      this.enumerateBlock(bb, EnumerationMode.ALL);
    }

    this.functionConstants.set(fn, constList);
    this.functionMetadata.set(fn, metadataList);

    // Leave the function
    this.index = this.lastGlobalIndex;
  }

  private enumerateDeclaration(decl: constants.Declaration): void {
    // Nothing special, so far
    this.enumerateValue(decl);
  }

  private enumerateBlock(bb: values.BasicBlock, mode: EnumerationMode): void {
    for (const instr of bb) {
      // All operands, except constants should be already enumerated
      for (const operand of instr) {
        this.enumerateValue(operand, EnumerationMode.CONSTANTS_ONLY);
      }

      if (mode === EnumerationMode.CONSTANTS_ONLY) {
        instr.metadata.forEach((metadata, key) => {
          if (!this.metadataKinds.has(key)) {
            this.metadataKinds.set(key, this.metadataKinds.size);
          }
          this.enumerateMetadata(metadata);
        });
      }

      this.enumerateValue(instr, mode);
    }
  }

  private enumerateMetadata(metadata: Metadata): void {
    if (this.metadataList !== undefined) {
      this.metadataList.push(metadata);
    }

    // Tuple
    if (Array.isArray(metadata.value)) {
      metadata.value.forEach((subMeta) => this.enumerateMetadata(subMeta));

    // String
    } else if (typeof metadata.value === 'string') {
      // no-op

    // Constant
    } else {
      this.enumerateValue(metadata.value as Constant);
    }
  }
}
