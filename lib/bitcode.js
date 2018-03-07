"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bitcode_builder_1 = require("bitcode-builder");
class Compiler {
    builder(sourceName) {
        return new bitcode_builder_1.Builder(sourceName);
    }
}
exports.Compiler = Compiler;
//# sourceMappingURL=bitcode.js.map