import * as assert from 'assert';

import { CallingConv, Linkage, values } from 'bitcode-builder';
import { CALL_FLAG_SHIFTS } from './constants';

import instructions = values.instructions;

export function encodeLinkage(linkage: Linkage): number {
  switch (linkage) {
    case 'external': return 0;
    case 'weak': return 1;
    case 'appending': return 2;
    case 'internal': return 3;
    case 'linkonce': return 4;
    case 'dllimport': return 5;
    case 'dllexport': return 6;
    case 'extern_weak': return 7;
    case 'common': return 8;
    case 'private': return 9;
    case 'weak_odr': return 10;
    case 'linkonce_odr': return 11;
    case 'available_externally': return 12;
    default: throw new Error(`Unsupported linkage type: "${linkage}"`);
  }
}

export function encodeCConv(cconv: CallingConv): number {
  switch (cconv) {
    case 'ccc': return 0;
    case 'fastcc': return 8;
    case 'coldcc': return 9;
    case 'webkit_jscc': return 12;
    case 'anyregcc': return 13;
    case 'preserve_mostcc': return 14;
    case 'preserve_allcc': return 15;
    case 'swiftcc': return 16;
    case 'cxx_fast_tlscc': return 17;
    case 'x86_stdcallcc': return 64;
    case 'x86_fastcallcc': return 65;
    case 'arm_apcscc': return 66;
    case 'arm_aapcscc': return 67;
    case 'arm_aapcs_vfpcc': return 6;
    default: throw new Error(`Unsupported cconv: "${cconv}"`);
  }
}

// TODO(indutny): int64 support
export function encodeSigned(value: number): number {
  value |= 0;

  if (value < 0) {
    return (-value << 1) | 1;
  } else {
    return value << 1;
  }
}

export function encodeCastType(cast: instructions.CastType): number {
  switch (cast) {
    case 'trunc': return 0;
    case 'zext': return 1;
    case 'sext': return 2;
    case 'fptoui': return 3;
    case 'fptosi': return 4;
    case 'uitofp': return 5;
    case 'sitofp': return 6;
    case 'fptrunc': return 7;
    case 'fpext': return 8;
    case 'ptrtoint': return 9;
    case 'inttoptr': return 10;
    case 'bitcast': return 11;
    case 'addrspacecast': return 12;
    default: throw new Error(`Unsupported cast type: "${cast}"`);
  }
}

export function encodeBinopType(binop: instructions.BinopType): number {
  switch (binop) {
    case 'add': return 0;
    case 'sub': return 1;
    case 'mul': return 2;
    case 'udiv': return 3;
    case 'sdiv': return 4;
    case 'urem': return 5;
    case 'srem': return 6;
    case 'shl': return 7;
    case 'lshr': return 8;
    case 'ashr': return 9;
    case 'and': return 10;
    case 'or': return 11;
    case 'xor': return 12;
    default: throw new Error(`Unsupported binop type: "${binop}"`);
  }
}

export function encodeICmpPredicate(predicate: instructions.ICmpPredicate)
  : number {
  switch (predicate) {
    case 'eq': return 32;
    case 'ne': return 33;
    case 'ugt': return 34;
    case 'ult': return 36;
    case 'ule': return 37;
    case 'sgt': return 38;
    case 'sge': return 39;
    case 'slt': return 40;
    case 'sle': return 41;
    default: throw new Error(`Unsupported icmp predicate: "${predicate}"`);
  }
}

export function encodeCallFlags(call: instructions.Call): number {
  let flags = 0;

  flags |= encodeCConv(call.cconv) << CALL_FLAG_SHIFTS.CCONV;
  if (call.callType === 'tail') {
    flags |= 1 << CALL_FLAG_SHIFTS.TAIL;
  } else if (call.callType === 'musttail') {
    flags |= 1 << CALL_FLAG_SHIFTS.MUSTTAIL;
  } else if (call.callType === 'notail') {
    flags |= 1 << CALL_FLAG_SHIFTS.NOTAIL;
  } else {
    assert.strictEqual(call.callType, 'normal',
      `Unexpected call type: "${call.callType}"`);
  }

  flags |= 1 << CALL_FLAG_SHIFTS.EXPLICIT_TYPE;

  return flags;
}
