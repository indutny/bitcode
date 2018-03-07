import * as assert from 'assert';

import { IWriter } from './abbr';
import { Operand } from './operand';

const CHAR6_WIDTH = 6;

export class Char6 extends Operand {
  constructor() {
    super();
  }

  public encode(writer: IWriter, value?: any): void {
    assert(typeof value === 'string', 'Char6 encoding expected String value');

    const str: string = value as string;
    assert.strictEqual(str.length, 1,
      'Char6 encoding expected single character');

    let code = str.charCodeAt(0);

    // 'a' - 'z'
    if (0x61 <= code && code <= 0x7a) {
      code = code - 0x61;

    // 'A' - 'Z'
    } else if (0x41 <= code && code <= 0x5a) {
      code = code - 0x41 + 26;
    // '0' - '9'
    } else if (0x30 <= code && code <= 0x39) {
      code = code - 0x30 + 52;
    // '.'
    } else if (code === 0x2e) {
      code = 62;
    // '_'
    } else if (code === 0x5f) {
      code = 63;
    } else {
      throw new Error(`Invalid char6: "${str}"`);
    }

    writer.writeBits(code, CHAR6_WIDTH);
  }
}
