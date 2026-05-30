// Recursive-descent parser + evaluator for workflow step conditions.
// No `eval` / `Function` — expressions are tokenized and walked by hand.
//
// Grammar:
//   condition := operand operator operand
//   operator  := "==" | "!=" | ">" | "<" | "in" | "contains" | "matches"
//   operand   := number | string | boolean | null | array | path
//   array     := "[" (operand ("," operand)*)? "]"
//   path      := IDENT ("." IDENT)*

export type ConditionOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | "in"
  | "contains"
  | "matches";

export class ConditionSyntaxError extends Error {
  constructor(message: string) {
    super(`Invalid condition: ${message}`);
    this.name = "ConditionSyntaxError";
  }
}

type Token =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "punct"; value: string }
  | { kind: "op"; value: string };

const WORD_OPS = new Set<string>(["in", "contains", "matches"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let str = "";
      while (j < input.length && input[j] !== ch) {
        if (input[j] === "\\" && j + 1 < input.length) {
          str += input[j + 1];
          j += 2;
        } else {
          str += input[j];
          j++;
        }
      }
      if (j >= input.length) {
        throw new ConditionSyntaxError("unterminated string literal");
      }
      tokens.push({ kind: "string", value: str });
      i = j + 1;
      continue;
    }
    if (ch === "[" || ch === "]" || ch === ",") {
      tokens.push({ kind: "punct", value: ch });
      i++;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (two === "==" || two === "!=") {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if (ch === ">" || ch === "<") {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ kind: "number", value: Number(input.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_.]/.test(input[j])) j++;
      tokens.push({ kind: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new ConditionSyntaxError(`unexpected character '${ch}'`);
  }
  return tokens;
}

type Operand =
  | { kind: "literal"; value: unknown }
  | { kind: "path"; path: string }
  | { kind: "array"; items: Operand[] };

interface ConditionAst {
  left: Operand;
  op: ConditionOperator;
  right: Operand;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parseCondition(): ConditionAst {
    const left = this.operand();
    const op = this.operator();
    const right = this.operand();
    this.expectEnd();
    return { left, op, right };
  }

  parseSingleOperand(): Operand {
    const op = this.operand();
    this.expectEnd();
    return op;
  }

  private expectEnd(): void {
    if (this.pos !== this.tokens.length) {
      throw new ConditionSyntaxError("unexpected trailing tokens");
    }
  }

  private operator(): ConditionOperator {
    const t = this.tokens[this.pos++];
    if (t?.kind === "op") return t.value as ConditionOperator;
    if (t?.kind === "ident" && WORD_OPS.has(t.value)) {
      return t.value as ConditionOperator;
    }
    throw new ConditionSyntaxError(
      `expected an operator, got '${t?.value ?? "end"}'`,
    );
  }

  private operand(): Operand {
    const t = this.tokens[this.pos++];
    if (!t) throw new ConditionSyntaxError("expected an operand");
    if (t.kind === "string") return { kind: "literal", value: t.value };
    if (t.kind === "number") return { kind: "literal", value: t.value };
    if (t.kind === "punct" && t.value === "[") return this.array();
    if (t.kind === "ident") {
      if (t.value === "true") return { kind: "literal", value: true };
      if (t.value === "false") return { kind: "literal", value: false };
      if (t.value === "null") return { kind: "literal", value: null };
      return { kind: "path", path: t.value };
    }
    throw new ConditionSyntaxError(`unexpected token '${t.value}'`);
  }

  private array(): Operand {
    const items: Operand[] = [];
    if (this.tokens[this.pos]?.value === "]") {
      this.pos++;
      return { kind: "array", items };
    }
    for (;;) {
      items.push(this.operand());
      const sep = this.tokens[this.pos++];
      if (sep?.value === "]") break;
      if (sep?.value !== ",") {
        throw new ConditionSyntaxError("expected ',' or ']' in array literal");
      }
    }
    return { kind: "array", items };
  }
}

export function resolvePath(
  context: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

function resolveOperand(
  op: Operand,
  context: Record<string, unknown>,
): unknown {
  if (op.kind === "literal") return op.value;
  if (op.kind === "path") return resolvePath(context, op.path);
  return op.items.map((item) => resolveOperand(item, context));
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === "number" || typeof b === "number") {
    const na = toNumber(a);
    const nb = toNumber(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return String(a) === String(b);
}

function applyOperator(op: ConditionOperator, l: unknown, r: unknown): boolean {
  switch (op) {
    case "==":
      return looseEquals(l, r);
    case "!=":
      return !looseEquals(l, r);
    case ">": {
      const nl = toNumber(l);
      const nr = toNumber(r);
      if (!Number.isNaN(nl) && !Number.isNaN(nr)) return nl > nr;
      return String(l) > String(r);
    }
    case "<": {
      const nl = toNumber(l);
      const nr = toNumber(r);
      if (!Number.isNaN(nl) && !Number.isNaN(nr)) return nl < nr;
      return String(l) < String(r);
    }
    case "in":
      return Array.isArray(r) && r.some((item) => looseEquals(item, l));
    case "contains":
      if (Array.isArray(l)) return l.some((item) => looseEquals(item, r));
      return String(l).includes(String(r));
    case "matches":
      return new RegExp(String(r)).test(String(l));
    default:
      return false;
  }
}

/** Evaluate a `field op value` condition against a context. */
export function evaluateCondition(
  expr: string,
  context: Record<string, unknown>,
): boolean {
  const ast = new Parser(tokenize(expr)).parseCondition();
  return applyOperator(
    ast.op,
    resolveOperand(ast.left, context),
    resolveOperand(ast.right, context),
  );
}

/** Resolve a single operand expression (path, literal, or array) to a value. */
export function evaluateExpression(
  expr: string,
  context: Record<string, unknown>,
): unknown {
  const operand = new Parser(tokenize(expr)).parseSingleOperand();
  return resolveOperand(operand, context);
}
