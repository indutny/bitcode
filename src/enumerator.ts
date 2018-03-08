import * as assert from 'assert';
import { values } from 'bitcode-builder';

export interface IEnumeratorInput {
  decls: ReadonlyArray<values.constants.Declaration>;
  fns: ReadonlyArray<values.constants.Func>;
  globals: ReadonlyArray<values.Global>;
}

export class Enumerator {
  private map: Map<values.Value, number> = new Map();
  private index: number = 0;

  public enumerate(input: IEnumeratorInput): void {
    for (const g of input.globals) {
      if (g.init) {
        this.enumerateConst(g.init);
      }
      this.enumerateValue(g);
    }

    for (const fn of input.fns) {
      this.enumerateFunction(fn);
    }

    for (const decl of input.decls) {
      this.enumerateDeclaration(decl);
    }
  }

  public get(value: values.Value): number {
    assert(this.map.has(value), 'Stumbled upon non-enumerated value');
    return this.map.get(value)!;
  }

  // Private API

  private enumerateValue(value: values.Value): void {
    if (this.map.has(value)) {
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
    this.enumerateValue(fn);

    for (const arg of fn.args) {
      this.enumerateValue(arg);
    }

    for (const bb of fn) {
      this.enumerateBlock(bb);
    }
  }

  private enumerateDeclaration(fn: values.constants.Declaration): void {
    // Nothing special, so far
    this.enumerateValue(fn);
  }

  private enumerateBlock(bb: values.BasicBlock): void {
    for (const instr of bb) {
      for (const operand of instr) {
        this.enumerateValue(operand);
      }

      this.enumerateValue(instr);
    }
  }
}
