# Specification: Marketing Sequence Folders & Tag Categorization - Design

## 1. Database Schema Additions (`packages/db/src/schema.ts`)

```typescript
export const marketingSequenceFolders = pgTable("marketing_sequence_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentFolderId: uuid("parent_folder_id").references((): AnyPgColumn => marketingSequenceFolders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketingSequenceTags = pgTable("marketing_sequence_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#cccccc"), // Hex color code
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketingSequenceTagMappings = pgTable("marketing_sequence_tag_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id").notNull().references(() => marketingSequences.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => marketingSequenceTags.id, { onDelete: "cascade" }),
});
```

We must also update the `marketingSequences` schema to add an optional `folderId` column:
```typescript
folderId: uuid("folder_id").references(() => marketingSequenceFolders.id, { onDelete: "set null" }),
```

## 2. Core Validation Functions (`packages/core/src/index.ts`)

```typescript
export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export interface FolderNode {
  id: string;
  parentFolderId: string | null;
}

export function detectFolderLoop(
  folderId: string,
  newParentId: string | null,
  allFolders: FolderNode[]
): boolean {
  if (!newParentId) return false;
  if (folderId === newParentId) return true;

  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return true; // Loop detected
    }
    visited.add(currentId);
    if (currentId === folderId) {
      return true; // Loop through ancestor/descendant detected
    }
    const parentNode = allFolders.find(f => f.id === currentId);
    currentId = parentNode ? parentNode.parentFolderId : null;
  }
  return false;
}
```

## 3. Hono API Routing (`apps/api/src/index.ts`)
- **POST `/api/sequences/folders`**: Insert new folder.
- **GET `/api/sequences/folders`**: List all folders.
- **POST `/api/sequences/tags`**: Create custom tag.
- **GET `/api/sequences/tags`**: List custom tags.
- **POST `/api/sequences/:id/tags`**: Assign tag to sequence.
- **DELETE `/api/sequences/:id/tags/:tagId`**: Detach tag.
