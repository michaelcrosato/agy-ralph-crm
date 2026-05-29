# Specification: E-Signature Integration & Document Signing API - Design

## 1. Relational Database Schema (`packages/db`)

### 1.1 Table Definition: `esignature_requests`
We will define the new table `esignatureRequests` in `packages/db/src/schema.ts`:

```typescript
export const esignatureRequests = pgTable("esignature_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  documentName: text("document_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  status: text("status").notNull().default("sent"), // "sent" | "viewed" | "signed" | "declined"
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  contractId: uuid("contract_id").references(() => contracts.id, {
    onDelete: "set null",
  }),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
```

### 1.2 Database Store Extension (`packages/db/src/index.ts`)
We will expose the `esignatureRequests` interface under `dbStore`:

```typescript
export interface DBEsignatureRequest {
  id: string;
  orgId: string;
  documentName: string;
  signerEmail: string;
  status: "sent" | "viewed" | "signed" | "declined";
  opportunityId: string | null;
  contractId: string | null;
  sentAt: Date;
  completedAt: Date | null;
}

// Inside mock database store interface:
esignatureRequests: {
  findMany: () => Promise<DBEsignatureRequest[]>;
  findOne: (id: string) => Promise<DBEsignatureRequest | null>;
  insert: (req: Omit<DBEsignatureRequest, "id" | "sentAt" | "completedAt"> & { sentAt?: Date; completedAt?: Date | null }) => Promise<DBEsignatureRequest>;
  update: (id: string, updates: Partial<Omit<DBEsignatureRequest, "id" | "orgId">>) => Promise<DBEsignatureRequest | null>;
}
```

## 2. Pure Core Domain Logic (`packages/core`)

### 2.1 E-Signature Transition Manager
Implement pure validation in `packages/core/src/index.ts`:

```typescript
export interface ESignatureTransitionInput {
  currentStatus: "sent" | "viewed" | "signed" | "declined";
  action: "view" | "sign" | "decline";
}

export interface ESignatureTransitionResult {
  nextStatus: "sent" | "viewed" | "signed" | "declined";
  isCompleted: boolean;
}

export function processESignatureTransition(input: ESignatureTransitionInput): ESignatureTransitionResult {
  const { currentStatus, action } = input;

  if (currentStatus === "signed" || currentStatus === "declined") {
    throw new Error(`Cannot transition from completed state: ${currentStatus}`);
  }

  if (action === "decline") {
    return { nextStatus: "declined", isCompleted: true };
  }

  if (currentStatus === "sent" && action === "view") {
    return { nextStatus: "viewed", isCompleted: false };
  }

  if (currentStatus === "viewed" && action === "sign") {
    return { nextStatus: "signed", isCompleted: true };
  }

  throw new Error(`Invalid action '${action}' for status '${currentStatus}'`);
}
```

## 3. REST API Routing (`apps/api`)

### 3.1 Endpoints to register in Hono `apps/api/src/index.ts`
- `POST /api/sales/esignature/requests`: Creates new E-Signature request. Validates fields and presence of either `opportunityId` or `contractId`.
- `GET /api/sales/esignature/requests`: Lists E-Signature requests for the tenant.
- `POST /api/sales/esignature/simulate`: Performs state transitions and audits them using `processESignatureTransition`.
