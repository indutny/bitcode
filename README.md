# bitcode
[![Build Status](https://secure.travis-ci.org/indutny/bitcode.svg)](http://travis-ci.org/indutny/bitcode)
[![NPM version](https://badge.fury.io/js/bitcode.svg)](https://badge.fury.io/js/bitcode)

Generate LLVM bitcode with JS API and no C++ bindings.

## What is bitcode?

[LLVM bitcode][1] is a binary representation of [LLVM IR][2] (where `IR` stands
for Intermediate Representation, and [LLVM][3] is a compiler infrastructure that
is used for building C/C++/swift/rust/etc projects with [clang][4]).

## Who needs this project?

LLVM is perfect for building languages, and for tools that generate machine
code. Instead of manual support of multiple architectures (e.g. x86_64, arm,
arm64), an architecture-independent Intermediate Representation might be
generated out of the source program. LLVM takes this representation and
transforms it to highly-optimized machine code.

Usually this is achieved through C/C++ API of LLVM. This project, however, does
the same thing using only JavaScript and Node.js Buffer API.

## Limitations

There're tons of unsupported instructions and data types in this module.
In fact, it has barely enough instructions to be useful in [llparse][5]. Should
you have any need in more types/instructions for your project - please do not
hesitate to file a bug, or (better) send a Pull Request for the feature.

## Usage

See [`bitcode-builder`][0] for Builder API.

```typescript
import * as fs from 'fs';
import { Module } from 'bitcode';

const bitcode = new Module('source-name');

// Create an instance of `bitcode-builder`
const b = bitcode.createBuilder();

// Define a function
const sig = b.signature(b.i(32), [ b.i(32), b.i(32) ]);
const fn = sig.defineFunction('fn_name', [ 'param0', 'param1' ]);

const param0 = fn.getArgument('param0');
const param1 = fn.getArgument('param1');
const sum = fn.body.binop('add', param0, param1);

fn.body.ret(sum);

// Add function to the module
bitcode.add(fn);

// Build module
fs.writeFileSync('out.bc', bitcode.build());
```

Running `opt -S out.bc` (`opt` is a part of LLVM suite) will print:

```bitcode
; ModuleID = 'out.bc'
source_filename = "source-name"

define i32 @fn_name(i32 %param0, i32 %param1) {
  %1 = add i32 %param0, %param1
  ret i32 %1
}
```

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2018.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: https://github.com/indutny/bitcode-builder
[1]: https://llvm.org/docs/BitCodeFormat.html
[2]: https://llvm.org/docs/LangRef.html
[3]: http://llvm.org/
[4]: https://clang.llvm.org/
[5]: http://github.com/indutny/llparse
