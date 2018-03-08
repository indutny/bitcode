import * as assert from 'assert';
import { values } from 'bitcode-builder';

export interface IEnumeratorInput {
  decls: ReadonlyArray<values.constants.Declaration>;
  fns: ReadonlyArray<values.constants.Func>;
  globals: ReadonlyArray<values.Global>;
}

enum EnumerateMode {
  ALL,
  CONSTANTS_ONLY,
}

export class Enumerator {
  private map: Map<values.Value, number> = new Map();
  private index: number = 1;
  private globalConstants: values.constants.Constant[] = [];

  public enumerate(input: IEnumeratorInput): void {
    // 1. Enumerate globals
    for (const g of input.globals) {
      this.enumerateValue(g);
    }

    // 2. Their initialization values
    for (const g of input.globals) {
      if (g.init) {
        this.enumerateConst(g.init);
        this.globalConstants.push(g.init);
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

  public getGlobalConstants(): ReadonlyArray<values.constants.Constant> {
    return this.globalConstants;
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

  private enumerateConst(c: values.constants.Constant): void {
    if (c.isFunction()) {
      this.enumerateFunction(c.toFunction());
    } else if (c.isDeclaration()) {
      this.enumerateDeclaration(c.toDeclaration());
    }
    this.enumerateValue(c);
  }

  private enumerateFunction(fn: values.constants.Func): void {
    // Enumerate function constants first
    for (const bb of fn) {
      this.enumerateBlock(bb, EnumerateMode.CONSTANTS_ONLY);
    }

    for (const arg of fn.args) {
      this.enumerateValue(arg);
    }

    for (const bb of fn) {
      this.enumerateBlock(bb, EnumerateMode.ALL);
    }
  }

  private enumerateDeclaration(fn: values.constants.Declaration): void {
    // Nothing special, so far
    this.enumerateValue(fn);
  }

  private enumerateBlock(bb: values.BasicBlock,
                         mode: EnumerateMode): void {
    for (const instr of bb) {
      // All operands, except constants should be already enumerated
      for (const operand of instr) {
        this.enumerateValue(operand, EnumerateMode.CONSTANTS_ONLY);
      }

      this.enumerateValue(instr, mode);
    }
  }
}
