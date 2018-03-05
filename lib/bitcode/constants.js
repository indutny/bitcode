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
  MODULE_CODE_VERSION: 1,
  GLOBALVAR: 7,

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
  STRTAB_BLOB: 1
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
