const fs = require("node:fs");
const path = require("node:path");

const coreIndexFile = path.join(__dirname, "../packages/core/src/index.ts");
const domainDir = path.join(__dirname, "../packages/core/src/domain");

const content = fs.readFileSync(coreIndexFile, "utf8");

const ts = require("../packages/core/node_modules/typescript");

const privateNamesToExport = new Set([
  "runReportInline",
  "getFieldValue",
  "CoreSequence",
  "getPartsInTimezone",
  "parseTimeToMinutes",
  "CoreSequenceStep",
  "CoreSequenceMembership",
  "CoreConsentPreference",
  "EventRecord",
]);

const sourceFile = ts.createSourceFile(
  "index.ts",
  content,
  ts.ScriptTarget.Latest,
  true,
);

const declarations = [];

sourceFile.forEachChild((node) => {
  const isExported = node.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  );

  let shouldProcess = isExported;
  let forceExport = false;

  if (!isExported) {
    let name = "";
    if (ts.isFunctionDeclaration(node) && node.name) {
      name = node.name.text;
    } else if (ts.isInterfaceDeclaration(node)) {
      name = node.name.text;
    } else if (ts.isTypeAliasDeclaration(node)) {
      name = node.name.text;
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          name = decl.name.text;
        }
      }
    }
    if (privateNamesToExport.has(name)) {
      shouldProcess = true;
      forceExport = true;
    }
  }

  if (!shouldProcess) return;

  const getBlockText = () => {
    let text = node.getText(sourceFile);
    if (forceExport) {
      text = `export ${text}`;
    }
    return text;
  };

  if (ts.isFunctionDeclaration(node)) {
    const name = node.name ? node.name.text : "";
    if (name) {
      declarations.push({
        type: "function",
        name,
        block: getBlockText(),
      });
    }
  } else if (ts.isInterfaceDeclaration(node)) {
    const name = node.name.text;
    declarations.push({
      type: "interface",
      name,
      block: getBlockText(),
    });
  } else if (ts.isTypeAliasDeclaration(node)) {
    const name = node.name.text;
    declarations.push({
      type: "type",
      name,
      block: getBlockText(),
    });
  } else if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        const name = decl.name.text;
        declarations.push({
          type: "const",
          name,
          block: getBlockText(),
        });
      }
    }
  }
});

console.log(
  `Parsed ${declarations.length} declarations from packages/core/src/index.ts.`,
);

// Separate types/interfaces from functions/logic
const types = {};
const logic = [];

for (const decl of declarations) {
  if (decl.type === "interface" || decl.type === "type") {
    types[decl.name] = decl.block;
  } else {
    logic.push(decl);
  }
}

// 1. Write packages/core/src/types.ts
const typesFileContent = `${Object.values(types).join("\n\n")}\n`;
fs.writeFileSync(
  path.join(__dirname, "../packages/core/src/types.ts"),
  typesFileContent,
  "utf8",
);
console.log("Created packages/core/src/types.ts");

// Classification logic
function getDomain(name) {
  const n = name.toLowerCase();
  if (n.includes("lead")) return "leads";
  if (
    n.includes("kanban") ||
    n.includes("stalled") ||
    n.includes("prorated") ||
    n.includes("cpq") ||
    n.includes("discount") ||
    n.includes("stagegate") ||
    n.includes("productschedule") ||
    n.includes("opportunity")
  )
    return "opportunities";
  if (
    n.includes("campaign") ||
    n.includes("influence") ||
    n.includes("revenueshare")
  )
    return "campaigns";
  if (n.includes("commission")) return "commissions";
  if (n.includes("territory")) return "territories";
  if (
    n.includes("ticket") ||
    n.includes("macro") ||
    n.includes("milestone") ||
    n.includes("escalation")
  )
    return "service";
  if (
    n.includes("sequence") ||
    n.includes("segment") ||
    n.includes("click") ||
    n.includes("open") ||
    n.includes("reply") ||
    n.includes("readtime") ||
    n.includes("bounce") ||
    n.includes("snooze") ||
    n.includes("throttle") ||
    n.includes("unsub")
  )
    return "sequences";
  if (n.includes("search") || n.includes("fuzzy") || n.includes("trigram"))
    return "search";
  if (n.includes("csv") || n.includes("parse")) return "csv";
  if (n.includes("esignature")) return "esignature";
  if (n.includes("survey")) return "surveys";
  if (n.includes("email") || n.includes("delivery")) return "email";
  if (n.includes("currency")) return "currencies";
  if (n.includes("validation")) return "validation";
  if (n.includes("workflow")) return "workflows";
  if (n.includes("migration")) return "migrations";
  if (n.includes("account")) return "accounts";
  if (n.includes("contact")) return "contacts";
  return "shared";
}

const functionToDomain = {};
const domainBlocks = {};

for (const decl of logic) {
  const dom = getDomain(decl.name);
  functionToDomain[decl.name] = dom;
  if (!domainBlocks[dom]) domainBlocks[dom] = [];
  domainBlocks[dom].push(decl);
}

// Write domain subdirectories
const domainKeys = Object.keys(domainBlocks);
const typeNames = Object.keys(types);

for (const dom of domainKeys) {
  const decls = domainBlocks[dom];
  const blockContent = decls.map((d) => d.block).join("\n\n");

  // 1. Identify types to import
  const typeMatches = blockContent.match(/\b[A-Z]\w+\b/g) || [];
  const neededTypes = [...new Set(typeMatches)]
    .filter((t) => typeNames.includes(t))
    .sort();
  const typesImport =
    neededTypes.length > 0
      ? `import type { ${neededTypes.join(", ")} } from "../../types";`
      : "";

  // 2. Identify external imports
  const externalImports = [];
  if (blockContent.includes("uuidv7")) {
    externalImports.push('import { v7 as uuidv7 } from "uuid";');
  }

  // 3. Identify cross-domain sibling imports
  const neededSiblings = {};
  for (const [funcName, targetDomain] of Object.entries(functionToDomain)) {
    if (
      targetDomain !== dom &&
      blockContent.match(new RegExp(`\\b${funcName}\\b`))
    ) {
      if (!neededSiblings[targetDomain]) neededSiblings[targetDomain] = [];
      neededSiblings[targetDomain].push(funcName);
    }
  }

  const siblingImports = Object.entries(neededSiblings)
    .map(
      ([targetDom, funcs]) =>
        `import { ${funcs.sort().join(", ")} } from "../${targetDom}";`,
    )
    .join("\n");

  // Write file
  const fullContent = `${externalImports.join("\n")}
${typesImport}
${siblingImports}

${blockContent}
`;

  const targetSubdir = path.join(domainDir, dom);
  if (!fs.existsSync(targetSubdir)) {
    fs.mkdirSync(targetSubdir, { recursive: true });
  }
  fs.writeFileSync(path.join(targetSubdir, "index.ts"), fullContent, "utf8");
}

console.log(`Wrote ${domainKeys.length} domain modules.`);

// 4. Create root packages/core/src/index.ts barrel file
const reExports = [
  'export * from "./types";',
  ...domainKeys.map((dom) => `export * from "./domain/${dom}";`),
];
fs.writeFileSync(coreIndexFile, `${reExports.join("\n")}\n`, "utf8");
console.log("Re-wrote packages/core/src/index.ts barrel file.");
