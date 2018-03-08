import { values } from 'bitcode-builder';

export interface IEnumeratorInput {
  decls: ReadonlyArray<values.Declaration>;
  fns: ReadonlyArray<values.Func>;
  globals: ReadonlyArray<values.Global>;
}

export class Enumerator {
  private map: Map<values.Value, number> = new Map();
  private index: number = 0;

  public enumerate(input: IEnumeratorInput): void {
    for (const g of input.globals) {
      this.enumerateValue(g);
      if (g.init) {
        this.enumerateConst(g.init);
      }
    }

    for (const fn of input.fns) {
      this.enumerateFunction(fn);
    }

    for (const decl of input.decls) {
      this.enumerateValue(decl);
    }
  }

  private enumerateValue(value: values.Value): void {
    if (this.map.has(value)) {
      return;
    }

    if (!value.ty.isVoid()) {
      this.index++;
    }
    this.map.set(value, this.index);
  }

  private enumerateConst(c: values.constants.Constant): void {
    this.enumerateValue(c);
  }

  private enumerateFunction(fn: values.Func): void {
    this.enumerateValue(fn);

    for (const arg of fn.args) {
      this.enumerateValue(arg);
    }

    for (const bb of fn) {
      this.enumerateBlock(bb);
    }
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
