import {
  Program,
  FunctionDeclaration,
  Node,
  Expression,
  Statement,
} from "estree";
import { parse } from "acorn";
import { sandboxed } from "./sandbox";

class ValidationError extends Error {
  public options: ValidationOptions;

  constructor(message: string, options: ValidationOptions) {
    super(message);
    this.name = "ValidationError";
    this.options = options;
  }
}

function isNodeExpression(node: Node): node is Expression {
  return [
    "ThisExpression",
    "ArrayExpression",
    "ObjectExpression",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "YieldExpression",
    "Literal",
    "UnaryExpression",
    "UpdateExpression",
    "BinaryExpression",
    "AssignmentExpression",
    "LogicalExpression",
    "MemberExpression",
    "ConditionalExpression",
    "CallExpression",
    "NewExpression",
    "SequenceExpression",
    "TemplateLiteral",
    "TaggedTemplateExpression",
    "ClassExpression",
    "MetaProperty",
    "Identifier",
    "AwaitExpression",
    "ImportExpression",
    "ChainExpression",
  ].includes(node.type);
}

function checkExpressionSafe(
  node: Expression,
  declaredVars: Set<string>,
  options: ValidationOptions
) {
  if (node.type === "Literal") {
    // All literals are safe
    return;
  } else if (
    node.type === "BinaryExpression" ||
    node.type === "LogicalExpression"
  ) {
    checkExpressionSafe(node.left, declaredVars, options);
    checkExpressionSafe(node.right, declaredVars, options);
    return;
  } else if (node.type === "UnaryExpression") {
    checkExpressionSafe(node.argument, declaredVars, options);
    return;
  } else if (node.type === "Identifier") {
    if (!declaredVars.has(node.name)) {
      throw new ValidationError(
        `Cannot use undeclared identifier: "${node.name}"`,
        options
      );
    }
    return;
  } else if (node.type === "AssignmentExpression") {
    if (node.left.type !== "Identifier") {
      throw new ValidationError(
        `Cannot assign to non-identifier: "${node.left.type}"`,
        options
      );
    }
    const id = node.left;
    if (!declaredVars.has(id.name)) {
      throw new ValidationError(
        `Cannot assign to unassigned name: "${id.name}"`,
        options
      );
    }
    checkExpressionSafe(node.right, declaredVars, options);
    return;
  } else if (node.type === "ArrayExpression") {
    for (const elem of node.elements) {
      if (elem == null || !isNodeExpression(elem)) {
        throw new ValidationError(
          "Cannot construct array from non-expressions",
          options
        );
      }
      checkExpressionSafe(elem, declaredVars, options);
    }
    return;
  }
  throw new ValidationError(`Forbidden expression type: ${node.type}`, options);
}

function checkStatementSafe(
  stmt: Statement,
  declaredVars: Set<string>,
  options: ValidationOptions
): void {
  if (stmt.type === "EmptyStatement") {
    return;
  } else if (stmt.type === "IfStatement") {
    checkExpressionSafe(stmt.test, declaredVars, options);
    checkStatementSafe(stmt.consequent, declaredVars, options);
    if (stmt.alternate != null) {
      checkStatementSafe(stmt.alternate, declaredVars, options);
    }
    return;
  } else if (stmt.type === "BlockStatement") {
    const blockVars: Set<string> = new Set();
    for (const name of declaredVars) {
      blockVars.add(name);
    }
    for (const subStmt of stmt.body) {
      checkStatementSafe(subStmt, blockVars, options);
    }
    return;
  } else if (stmt.type === "VariableDeclaration") {
    const kind = stmt.kind;
    if (kind !== "let" && kind !== "const") {
      // Declarations using `var` are dangerous, since they can overwrite parent scope.
      throw new ValidationError(
        `Cannot declare variables with '${kind}'`,
        options
      );
    }
    for (const decl of stmt.declarations) {
      const id = decl.id;
      if (id.type !== "Identifier") {
        throw new ValidationError("Cannot declare non-identifiers", options);
      }
      if (decl.init != null) {
        checkExpressionSafe(decl.init, declaredVars, options);
      }
      declaredVars.add(id.name);
    }
    return;
  } else if (stmt.type === "ReturnStatement") {
    if (stmt.argument != null) {
      checkExpressionSafe(stmt.argument, declaredVars, options);
    }
    return;
  } else if (stmt.type === "ExpressionStatement") {
    checkExpressionSafe(stmt.expression, declaredVars, options);
    return;
  }
  throw new ValidationError(`Forbidden statement type: ${stmt.type}`, options);
}

class SafeCode {
  private compiled: Function;

  constructor(unsafeFunctionBody: string, options: ValidationOptions) {
    const unsafeNode = parse(`function a() { ${unsafeFunctionBody} }`, {
      ecmaVersion: 2015,
    });

    if (unsafeNode.type !== "Program") {
      // Should never happen unless there is a change or bug in `acorn`.
      throw new ValidationError(
        "Expected 'Program' node from 'acorn.parse'",
        options
      );
    }
    // SAFETY: We checked the node type above
    const unsafeProgram = unsafeNode as unknown as Program;

    if (
      unsafeProgram.body.length !== 1 ||
      unsafeProgram.body[0].type !== "FunctionDeclaration"
    ) {
      // Should never happen unless there is a change or bug in `acorn`.
      throw new ValidationError(
        "Expected 'FunctionDeclaration' node'",
        options
      );
    }
    // SAFETY: We checked the node type above
    const unsafeFuncDecl = unsafeProgram
      .body[0] as unknown as FunctionDeclaration;
    checkStatementSafe(unsafeFuncDecl.body, new Set(), options);

    // The parsing step should have already rejected any accesses to global
    // variables from within the given function. Sandboxing is just a
    // defense-in-depth measure.
    this.compiled = sandboxed(unsafeFunctionBody);
  }

  run(args) {
    return this.compiled(...args);
  }
}

interface ValidationOptions {
  allowLoops?: boolean;
}

export class Sevaluator {
  private code: SafeCode;

  constructor(code: string, options?: ValidationOptions) {
    options = options || {};
    this.code = new SafeCode(code, options);
  }

  run(args) {
    return this.code.run(args);
  }
}
