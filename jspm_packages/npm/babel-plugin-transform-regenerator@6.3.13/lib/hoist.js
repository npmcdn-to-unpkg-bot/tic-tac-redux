/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */

"use strict";

var _Object$keys = require("babel-runtime/core-js/object/keys")["default"];

var _interopRequireWildcard = require("babel-runtime/helpers/interop-require-wildcard")["default"];

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

var hasOwn = Object.prototype.hasOwnProperty;

// The hoist function takes a FunctionExpression or FunctionDeclaration
// and replaces any Declaration nodes in its body with assignments, then
// returns a VariableDeclaration containing just the names of the removed
// declarations.
exports.hoist = function (funPath) {
  t.assertFunction(funPath.node);

  var vars = {};

  function varDeclToExpr(vdec, includeIdentifiers) {
    t.assertVariableDeclaration(vdec);
    // TODO assert.equal(vdec.kind, "var");
    var exprs = [];

    vdec.declarations.forEach(function (dec) {
      vars[dec.id.name] = dec.id;

      if (dec.init) {
        exprs.push(t.assignmentExpression("=", dec.id, dec.init));
      } else if (includeIdentifiers) {
        exprs.push(dec.id);
      }
    });

    if (exprs.length === 0) return null;

    if (exprs.length === 1) return exprs[0];

    return t.sequenceExpression(exprs);
  }

  funPath.get("body").traverse({
    VariableDeclaration: {
      exit: function exit(path) {
        var expr = varDeclToExpr(path.node, false);
        if (expr === null) {
          path.remove();
        } else {
          // We don't need to traverse this expression any further because
          // there can't be any new declarations inside an expression.
          path.replaceWith(t.expressionStatement(expr));
        }

        // Since the original node has been either removed or replaced,
        // avoid traversing it any further.
        path.skip();
      }
    },

    ForStatement: function ForStatement(path) {
      var init = path.node.init;
      if (t.isVariableDeclaration(init)) {
        path.get("init").replaceWith(varDeclToExpr(init, false));
      }
    },

    ForXStatement: function ForXStatement(path) {
      var left = path.get("left");
      if (left.isVariableDeclaration()) {
        left.replaceWith(varDeclToExpr(left.node, true));
      }
    },

    FunctionDeclaration: function FunctionDeclaration(path) {
      var node = path.node;
      vars[node.id.name] = node.id;

      var assignment = t.expressionStatement(t.assignmentExpression("=", node.id, t.functionExpression(node.id, node.params, node.body, node.generator, node.expression)));

      if (path.parentPath.isBlockStatement()) {
        // Insert the assignment form before the first statement in the
        // enclosing block.
        path.parentPath.unshiftContainer("body", assignment);

        // Remove the function declaration now that we've inserted the
        // equivalent assignment form at the beginning of the block.
        path.remove();
      } else {
        // If the parent node is not a block statement, then we can just
        // replace the declaration with the equivalent assignment form
        // without worrying about hoisting it.
        path.replaceWith(assignment);
      }

      // Don't hoist variables out of inner functions.
      path.skip();
    },

    FunctionExpression: function FunctionExpression(path) {
      // Don't descend into nested function expressions.
      path.skip();
    }
  });

  var paramNames = {};
  funPath.get("params").forEach(function (paramPath) {
    var param = paramPath.node;
    if (t.isIdentifier(param)) {
      paramNames[param.name] = param;
    } else {
      // Variables declared by destructuring parameter patterns will be
      // harmlessly re-declared.
    }
  });

  var declarations = [];

  _Object$keys(vars).forEach(function (name) {
    if (!hasOwn.call(paramNames, name)) {
      declarations.push(t.variableDeclarator(vars[name], null));
    }
  });

  if (declarations.length === 0) {
    return null; // Be sure to handle this case!
  }

  return t.variableDeclaration("var", declarations);
};