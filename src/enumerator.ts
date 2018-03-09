import * as assert from 'assert';
import { values } from 'bitcode-builder';

import constants = values.constants;

export interface IEnumeratorInput {
  decls: ReadonlyArray<constants.Declaration>;
  fns: ReadonlyArray<constants.Func>;
  globals: ReadonlyArray<values.Global>;
}

enum EnumerateMode {
  ALL,
  CONSTANTS_ONLY,
}

type RWConstantList = constants.Constant[];
export type ConstantList = ReadonlyArray<constants.Constant>;

export class Enumerator {
  private map: Map<values.Value, number> = new Map();
  private index: number = 0;
  private globalConstants: RWConstantList = [];
  private functionConstants: Map<constants.Func, RWConstantList> =
    new Map();
  private lastEmittedIndex: number = 0;

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

  // Ensure that values are emitted in the same order they were enumerated
  public checkValueOrder(value: values.Value): void {
    const index = this.get(value);
    assert(index >= this.lastEmittedIndex,
      'Invalid order of values (internal error)');
    this.lastEmittedIndex = index;
  }

  // Private API

  private enumerateValue(value: values.Value,
                         mode: EnumerateMode = EnumerateMode.ALL): void {
    if (this.map.has(value)) {
      return;
    }

    if (mode === EnumerateMode.CONSTANTS_ONLY && !value.isConstant()) {
      return;
    }

    this.map.set(value, this.index);

    if (!value.ty.isVoid()) {
      this.index++;
    }
  }

  private enumerateGlobalConst(c: constants.Constant) {
    if (c.isArray()) {
      for (const elem of c.toArray().elems) {
        this.enumerateGlobalConst(elem);
      }
    } else if (c.isStruct()) {
      for (const field of c.toStruct().fields) {
        this.enumerateGlobalConst(field);
      }
    }

    this.globalConstants.push(c);
    this.enumerateValue(c);
  }

  private enumerateFunction(fn: constants.Func): void {
    const constList: RWConstantList = [];

    for (const arg of fn.args) {
      this.enumerateValue(arg);
    }

    for (const bb of fn) {
      this.enumerateBlock(bb, EnumerateMode.CONSTANTS_ONLY, constList);
    }

    for (const bb of fn) {
      this.enumerateBlock(bb, EnumerateMode.ALL, constList);
    }

    this.functionConstants.set(fn, constList);
  }

  private enumerateDeclaration(fn: constants.Declaration): void {
    // Nothing special, so far
    this.enumerateValue(fn);
  }

  private enumerateBlock(bb: values.BasicBlock,
                         mode: EnumerateMode,
                         constList: RWConstantList): void {
    for (const instr of bb) {
      // All operands, except constants should be already enumerated
      for (const operand of instr) {
        if (mode === EnumerateMode.CONSTANTS_ONLY && operand.isConstant()) {
          constList.push(operand.toConstant());
        }
        this.enumerateValue(operand, EnumerateMode.CONSTANTS_ONLY);
      }

      this.enumerateValue(instr, mode);
    }
  }
}
