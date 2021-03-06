/* */ 
"use strict";

var _interopRequireWildcard = require("babel-runtime/helpers/interop-require-wildcard")["default"];

exports.__esModule = true;

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

var visitor = {
  Function: function Function(path) {
    var params /*: Array*/ = path.get("params");

    for (var i = 0; i < params.length; i++) {
      var param = params[i];
      if (param.isArrayPattern() || param.isObjectPattern()) {
        var uid = path.scope.generateUidIdentifier("ref");

        var declar = t.variableDeclaration("let", [t.variableDeclarator(param.node, uid)]);
        declar._blockHoist = params.length - i;

        path.ensureBlock();
        path.get("body").unshiftContainer("body", declar);

        param.replaceWith(uid);
      }
    }
  }
};
exports.visitor = visitor;