import { Builder, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

export class Module {
  private readonly fns: values.Func[] = [];
  private readonly decls: values.Declaration[] = [];
  private readonly globals: values.Global[] = [];

  constructor(public readonly sourceName?: string) {
  }

  public addFunction(fn: values.Func): void {
    this.fns.push(fn);
  }

  public addDeclaration(decl: values.Declaration): void {
    this.decls.push(decl);
  }

  public addGlobal(g: values.Global): void {
    this.globals.push(g);
  }

  public build(): Buffer {
    return Buffer.alloc(0);
  }

  // Convenience methods

  public createBuilder() {
    return new Builder();
  }

  public add(value: values.Value): Module {
    if (value instanceof values.Func) {
      this.addFunction(value);
    } else if (value instanceof values.Declaration) {
      this.addDeclaration(value);
    } else if (value instanceof values.Global) {
      this.addGlobal(value);
    } else {
      throw new Error('Unexpected value type: ' + value.constructor.name);
    }
    return this;
  }
}
