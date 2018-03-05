'use strict';

exports.MAGIC = 0xdec04342;

exports.ABBR = {
  END_BLOCK: 0,
  ENTER_SUBBLOCK: 1,
  DEFINE_ABBREV: 2,
  UNABBREV_RECORD: 3
};

exports.BLOCK = {
  INFO: 0,

  // Bitcode specific
  MODULE: 8,
  PARAMATTR: 9,
  PARAMATTR_GROUP: 10,
  CONSTANTS: 11,
  FUNCTION: 12,
  VALUE_SYMTAB: 14,
  METADATA: 15,
  METADATA_ATTACHMENT: 16,
  TYPE: 17,
  STRTAB: 23
};

exports.RECORD = {
  // Module
  VERSION: 1,
  GLOBALVAR: 7,
  FUNCTION: 8,

  // Type
  TYPE_CODE_NUMENTRY: 1,
  TYPE_CODE_VOID: 2,
  TYPE_CODE_HALF: 10,
  TYPE_CODE_FLOAT: 3,
  TYPE_CODE_DOUBLE: 4,
  TYPE_CODE_LABEL: 5,
  TYPE_CODE_OPAQUE: 6,
  TYPE_CODE_INTEGER: 7,
  TYPE_CODE_POINTER: 8,
  TYPE_CODE_ARRAY: 11,
  TYPE_CODE_VECTOR: 12,
  TYPE_CODE_METADATA: 16,
  TYPE_CODE_STRUCT_ANON: 18,
  TYPE_CODE_STRUCT_NAME: 19,
  TYPE_CODE_STRUCT_NAMED: 20,
  TYPE_CODE_FUNCTION: 21,

  // Strtab
  STRTAB_BLOB: 1,

  // ParamAttr
  PARAMATTR_ENTRY: 2,

  // ParamAttrGroup
  PARAMATTR_GROUP_ENTRY: 3
};

exports.LINKAGE = {
  external: 0,
  weak: 1,
  appending: 2,
  internal: 3,
  linkonce: 4,
  dllimport: 5,
  dllexport: 6,
  extern_weak: 7,
  common: 8,
  private: 9,
  weak_odr: 10,
  linkonce_odr: 11,
  available_externally: 12
};

exports.CCONV = {
  ccc: 0,
  fastcc: 8,
  coldcc: 9,
  webkit_jscc: 12,
  anyregcc: 13,
  preserve_mostcc: 14,
  preserve_allcc: 15,
  swiftcc: 16,
  cxx_fast_tlscc: 17,
  x86_stdcallcc: 64,
  x86_fastcallcc: 65,
  arm_apcscc: 66,
  arm_aapcscc: 67,
  arm_aapcs_vfpcc: 68
};

exports.ATTRIBUTES = {
  align: 1,
  alwaysinline: 2,
  byval: 3,
  inlinehint: 4,
  inreg: 5,
  minsize: 6,
  naked: 7,
  nest: 8,
  noalias: 9,
  nobuiltin: 10,
  nocapture: 11,
  noduplicates: 12,
  noimplicitfloat: 13,
  noinline: 14,
  nonlazybind: 15,
  noredzone: 16,
  noreturn: 17,
  nounwind: 18,
  optsize: 19,
  readnone: 20,
  readonly: 21,
  returned: 22,
  returns_twice: 23,
  signext: 24,
  alignstack: 25,
  ssp: 26,
  sspreq: 27,
  sspstrong: 28,
  sret: 29,
  sanitize_address: 30,
  sanitize_thread: 31,
  sanitize_memory: 32,
  uwtable: 33,
  zeroext: 34,
  builtin: 35,
  cold: 36,
  optnone: 37,
  inalloca: 38,
  nonnull: 39,
  jumptable: 40,
  dereferenceable: 41,
  dereferenceable_or_null: 42,
  convergent: 43,
  safestack: 44,
  argmemonly: 45,
  swiftself: 46,
  swifterror: 47,
  norecurse: 48,
  inaccessiblememonly: 49,
  inaccessiblememonly_or_argmemonly: 50,
  allocsize: 51,
  writeonly: 52,
  speculatable: 53,
  strictfp: 54,
  sanitize_hwaddress: 55
};
