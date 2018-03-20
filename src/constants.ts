// TODO(indutny): should be enum?
export const BLOCK_ID = {
  CONSTANTS: 11,
  FUNCTION: 12,
  METADATA: 15,
  METADATA_ATTACHMENT: 16,
  METADATA_KIND: 22,
  MODULE: 8,
  PARAMATTR: 9,
  PARAMATTR_GROUP: 10,
  STRTAB: 23,
  TYPE: 17,
  VALUE_SYMTAB: 14,
};

// TODO(indutny): should be enum?
export const MODULE_CODE = {
  FUNCTION: 8,
  GLOBALVAR: 7,
  SOURCE_FILENAME: 16,
  VERSION: 1,
};

// TODO(indutny): should be enum?
export const TYPE_CODE = {
  ARRAY: 11,
  DOUBLE: 4,
  FLOAT: 3,
  FP128: 14,
  FUNCTION: 21,
  HALF: 10,
  INTEGER: 7,
  LABEL: 5,
  METADATA: 16,
  NUMENTRY: 1,
  OPAQUE: 6,
  POINTER: 8,
  PPC_FP128: 15,
  STRUCT_ANON: 18,
  STRUCT_NAME: 19,
  STRUCT_NAMED: 20,
  VECTOR: 12,
  VOID: 2,
  X86_FP80: 13,
  X86_MMX: 17,
};

export const STRTAB_CODE = {
  BLOB: 1,
};

export const CONSTANTS_CODE = {
  AGGREGATE: 7,
  BLOCKADDRESS: 21,
  CSTRING: 9,
  DATA: 22,
  FLOAT: 6,
  INTEGER: 4,
  NULL: 2,
  SETTYPE: 1,
  STRING: 8,
  UNDEF: 3,
  WIDE_INTEGER: 5,
};

// TODO(indutny): should be enum?
export const FUNCTION_CODE = {
  DEBUG_LOC: 35,
  DEBUG_LOC_AGAIN: 33,
  DECLAREBLOCKS: 1,
  INST_ALLOCA: 19,
  INST_ATOMICRMW: 38,
  INST_BINOP: 2,
  INST_BR: 11,
  INST_CALL: 34,
  INST_CAST: 3,
  INST_CATCHPAD: 50,
  INST_CATCHRET: 49,
  INST_CLEANSWITCH: 52,
  INST_CLEANUPPAD: 51,
  INST_CLEANUPRET: 48,
  INST_CMP: 9,
  INST_CMP2: 28,
  INST_CMPXCHG: 46,
  INST_EXTRACTELT: 6,
  INST_EXTRACTVAL: 26,
  INST_FENCE: 36,
  INST_GEP: 43,
  INST_INSERTELT: 7,
  INST_INSERTVAL: 27,
  INST_INVOKE: 13,
  INST_LANDINGPAD: 47,
  INST_LOAD: 20,
  INST_LOADATOMIC: 41,
  INST_PHI: 16,
  INST_RESUME: 39,
  INST_RET: 10,
  INST_SELECT: 29,
  INST_SHUFFLEVEC: 8,
  INST_STORE: 44,
  INST_STOREATOMIC: 45,
  INST_SWITCH: 12,
  INST_UNREACHABLE: 15,
  INST_VAARG: 23,
  INST_VSELECT: 5,
  OPERAND_BUNDLE: 55,
};

export const VALUE_SYMTAB_CODE = {
  BBENTRY: 2,
  COMBINED_ENTRY: 5,
  ENTRY: 1,
  FNENTRY: 3,
};

export const PARAMATTR_CODE = {
  ENTRY: 2,
};

export const PARAMATTR_GROUP_CODE = {
  ENTRY: 3,
};

export const METADATA_CODE = {
  DISTINCT_NODE: 5,
  NODE: 3,
  STRINGS: 35,
  VALUE: 2,
};

export const METADATA_ATTACHMENT_CODE = {
  ATTACHMENT: 11,
};

export const METADATA_KIND_CODE = {
  KIND: 6,
};

export const FIXED = {
  BINOP_TYPE: 4,
  BOOL: 1,
  CAST_TYPE: 4,
  CHAR: 8,
  LINKAGE: 4,
  PREDICATE: 6,
  VISIBILITY: 2,
};

export const VBR = {
  ALIGNMENT: 3,
  ARRAY_LENGTH: 8,
  ATTR_INDEX: 6,
  BLOCK_COUNT: 6,
  BLOCK_INDEX: 8,
  CCONV: 5,
  INTEGER: 8,
  INT_WIDTH: 8,
  METADATA_INDEX: 6,
  METADATA_KIND_INDEX: 6,
  METADATA_STRING_COUNT: 6,
  METADATA_STRING_OFF: 6,
  STRTAB_LENGTH: 6,
  STRTAB_OFFSET: 8,
  TYPE_INDEX: 6,
  VALUE_INDEX: 8,
};

export const VISIBILITY = {
  DEFAULT: 0,
  HIDDEN: 1,
  PROTECTED: 2,
};

export const UNNAMED_ADDR = {
  LOCAL_UNNAMED_ADDR: 2,
  NO: 0,
  UNNAMED_ADDR: 1,
};

export const CALL_FLAG_SHIFTS = {
  CCONV: 1,
  EXPLICIT_TYPE: 15,
  MUSTTAIL: 14,
  NOTAIL: 16,
  TAIL: 0,
};

export const KNOWN_ATTRIBUTES: { [key: string]: number } = {
  align: 1,
  alignstack: 25,
  allocsize: 51,
  alwaysinline: 2,
  argmemonly: 45,
  builtin: 35,
  byval: 3,
  cold: 36,
  convergent: 43,
  dereferenceable: 41,
  dereferenceable_or_null: 42,
  inaccessiblememonly: 49,
  inaccessiblememonly_or_argmemonly: 50,
  inalloca: 38,
  inlinehint: 4,
  inreg: 5,
  jumptable: 40,
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
  nonnull: 39,
  norecurse: 48,
  noredzone: 16,
  noreturn: 17,
  nounwind: 18,
  optnone: 37,
  optsize: 19,
  readnone: 20,
  readonly: 21,
  returned: 22,
  returns_twice: 23,
  safestack: 44,
  sanitize_address: 30,
  sanitize_hwaddress: 55,
  sanitize_memory: 32,
  sanitize_thread: 31,
  signext: 24,
  speculatable: 53,
  sret: 29,
  ssp: 26,
  sspreq: 27,
  sspstrong: 28,
  strictfp: 54,
  swifterror: 47,
  swiftself: 46,
  uwtable: 33,
  writeonly: 52,
  zeroext: 34,
};
