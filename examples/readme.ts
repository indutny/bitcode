import * as fs from 'fs';
import { Module } from '../';

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
