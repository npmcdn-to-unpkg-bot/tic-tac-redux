/* */ 
"use strict";
var _getIterator = require('babel-runtime/core-js/get-iterator')["default"];
var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')["default"];
var _tokenizerTypes = require('../tokenizer/types');
var _index = require('./index');
var _index2 = _interopRequireDefault(_index);
var _utilIdentifier = require('../util/identifier');
var pp = _index2["default"].prototype;
pp.toAssignable = function(node, isBinding) {
  if (node) {
    switch (node.type) {
      case "Identifier":
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
        break;
      case "ObjectExpression":
        node.type = "ObjectPattern";
        for (var _iterator = (node.properties),
            _isArray = Array.isArray(_iterator),
            _i = 0,
            _iterator = _isArray ? _iterator : _getIterator(_iterator); ; ) {
          var _ref;
          if (_isArray) {
            if (_i >= _iterator.length)
              break;
            _ref = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done)
              break;
            _ref = _i.value;
          }
          var prop = _ref;
          if (prop.type === "ObjectMethod") {
            if (prop.kind === "get" || prop.kind === "set") {
              this.raise(prop.key.start, "Object pattern can't contain getter or setter");
            } else {
              this.raise(prop.key.start, "Object pattern can't contain methods");
            }
          } else {
            this.toAssignable(prop, isBinding);
          }
        }
        break;
      case "ObjectProperty":
        this.toAssignable(node.value, isBinding);
        break;
      case "SpreadProperty":
        node.type = "RestProperty";
        break;
      case "ArrayExpression":
        node.type = "ArrayPattern";
        this.toAssignableList(node.elements, isBinding);
        break;
      case "AssignmentExpression":
        if (node.operator === "=") {
          node.type = "AssignmentPattern";
          delete node.operator;
        } else {
          this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
        }
        break;
      case "MemberExpression":
        if (!isBinding)
          break;
      default:
        this.raise(node.start, "Assigning to rvalue");
    }
  }
  return node;
};
pp.toAssignableList = function(exprList, isBinding) {
  var end = exprList.length;
  if (end) {
    var last = exprList[end - 1];
    if (last && last.type === "RestElement") {
      --end;
    } else if (last && last.type === "SpreadElement") {
      last.type = "RestElement";
      var arg = last.argument;
      this.toAssignable(arg, isBinding);
      if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern") {
        this.unexpected(arg.start);
      }
      --end;
    }
  }
  for (var i = 0; i < end; i++) {
    var elt = exprList[i];
    if (elt)
      this.toAssignable(elt, isBinding);
  }
  return exprList;
};
pp.toReferencedList = function(exprList) {
  return exprList;
};
pp.parseSpread = function(refShorthandDefaultPos) {
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeAssign(refShorthandDefaultPos);
  return this.finishNode(node, "SpreadElement");
};
pp.parseRest = function() {
  var node = this.startNode();
  this.next();
  node.argument = this.parseBindingIdentifier();
  return this.finishNode(node, "RestElement");
};
pp.shouldAllowYieldIdentifier = function() {
  return this.match(_tokenizerTypes.types._yield) && !this.state.strict && !this.state.inGenerator;
};
pp.parseBindingIdentifier = function() {
  return this.parseIdentifier(this.shouldAllowYieldIdentifier());
};
pp.parseBindingAtom = function() {
  switch (this.state.type) {
    case _tokenizerTypes.types._yield:
      if (this.state.strict || this.state.inGenerator)
        this.unexpected();
    case _tokenizerTypes.types.name:
      return this.parseIdentifier(true);
    case _tokenizerTypes.types.bracketL:
      var node = this.startNode();
      this.next();
      node.elements = this.parseBindingList(_tokenizerTypes.types.bracketR, true, true);
      return this.finishNode(node, "ArrayPattern");
    case _tokenizerTypes.types.braceL:
      return this.parseObj(true);
    default:
      this.unexpected();
  }
};
pp.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
  var elts = [];
  var first = true;
  while (!this.eat(close)) {
    if (first) {
      first = false;
    } else {
      this.expect(_tokenizerTypes.types.comma);
    }
    if (allowEmpty && this.match(_tokenizerTypes.types.comma)) {
      elts.push(null);
    } else if (allowTrailingComma && this.eat(close)) {
      break;
    } else if (this.match(_tokenizerTypes.types.ellipsis)) {
      elts.push(this.parseAssignableListItemTypes(this.parseRest()));
      this.expect(close);
      break;
    } else {
      var left = this.parseMaybeDefault();
      this.parseAssignableListItemTypes(left);
      elts.push(this.parseMaybeDefault(null, null, left));
    }
  }
  return elts;
};
pp.parseAssignableListItemTypes = function(param) {
  return param;
};
pp.parseMaybeDefault = function(startPos, startLoc, left) {
  startLoc = startLoc || this.state.startLoc;
  startPos = startPos || this.state.start;
  left = left || this.parseBindingAtom();
  if (!this.eat(_tokenizerTypes.types.eq))
    return left;
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern");
};
pp.checkLVal = function(expr, isBinding, checkClashes) {
  switch (expr.type) {
    case "Identifier":
      if (this.state.strict && (_utilIdentifier.reservedWords.strictBind(expr.name) || _utilIdentifier.reservedWords.strict(expr.name))) {
        this.raise(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
      }
      if (checkClashes) {
        var key = "_" + expr.name;
        if (checkClashes[key]) {
          this.raise(expr.start, "Argument name clash in strict mode");
        } else {
          checkClashes[key] = true;
        }
      }
      break;
    case "MemberExpression":
      if (isBinding)
        this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " member expression");
      break;
    case "ObjectPattern":
      for (var _iterator2 = (expr.properties),
          _isArray2 = Array.isArray(_iterator2),
          _i2 = 0,
          _iterator2 = _isArray2 ? _iterator2 : _getIterator(_iterator2); ; ) {
        var _ref2;
        if (_isArray2) {
          if (_i2 >= _iterator2.length)
            break;
          _ref2 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done)
            break;
          _ref2 = _i2.value;
        }
        var prop = _ref2;
        if (prop.type === "ObjectProperty")
          prop = prop.value;
        this.checkLVal(prop, isBinding, checkClashes);
      }
      break;
    case "ArrayPattern":
      for (var _iterator3 = (expr.elements),
          _isArray3 = Array.isArray(_iterator3),
          _i3 = 0,
          _iterator3 = _isArray3 ? _iterator3 : _getIterator(_iterator3); ; ) {
        var _ref3;
        if (_isArray3) {
          if (_i3 >= _iterator3.length)
            break;
          _ref3 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done)
            break;
          _ref3 = _i3.value;
        }
        var elem = _ref3;
        if (elem)
          this.checkLVal(elem, isBinding, checkClashes);
      }
      break;
    case "AssignmentPattern":
      this.checkLVal(expr.left, isBinding, checkClashes);
      break;
    case "RestProperty":
    case "RestElement":
      this.checkLVal(expr.argument, isBinding, checkClashes);
      break;
    default:
      this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " rvalue");
  }
};
