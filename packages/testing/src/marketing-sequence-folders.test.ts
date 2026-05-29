import { createSessionToken } from "@crm/auth";
import { detectFolderLoop, validateHexColor } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Folders & Tag Categorization Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  describe("Core Unit Tests", () => {
    it("should validate hex color code formats correctly", () => {
      expect(validateHexColor("#FF0000")).toBe(true);
      expect(validateHexColor("#abc123")).toBe(true);
      expect(validateHexColor("#ABCDEF")).toBe(true);
      expect(validateHexColor("red")).toBe(false);
      expect(validateHexColor("#FF000")).toBe(false);
      expect(validateHexColor("#FF00000")).toBe(false);
    });

    it("should detect recursive folder loop paths correctly", () => {
      const folders = [
        { id: "folder-1", parentFolderId: null },
        { id: "folder-2", parentFolderId: "folder-1" },
        { id: "folder-3", parentFolderId: "folder-2" },
      ];

      // Safe hierarchy
      expect(detectFolderLoop("folder-1", null, folders)).toBe(false);
      expect(detectFolderLoop("folder-2", "folder-1", folders)).toBe(false);

      // Direct loop
      expect(detectFolderLoop("folder-1", "folder-1", folders)).toBe(true);

      // Recursive loop (making folder-1 child of folder-3)
      expect(detectFolderLoop("folder-1", "folder-3", folders)).toBe(true);

      // Indirect loop (making folder-2 child of folder-3)
      expect(detectFolderLoop("folder-2", "folder-3", folders)).toBe(true);
    });
  });

  describe("REST API Integration & RLS Isolation Tests", () => {
    it("should support creating, listing, and RLS isolating folders", async () => {
      // 1. Create top-level folder as Tenant A
      const createFolderResA = await app.request("/api/sequences/folders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Q1 Campaign Folder" }),
      });

      expect(createFolderResA.status).toBe(200);
      const folderBodyA = await createFolderResA.json();
      expect(folderBodyA.success).toBe(true);
      expect(folderBodyA.folder.id).toBeDefined();
      expect(folderBodyA.folder.orgId).toBe(orgA);
      expect(folderBodyA.folder.name).toBe("Q1 Campaign Folder");
      expect(folderBodyA.folder.parentFolderId).toBeNull();

      const folderId = folderBodyA.folder.id;

      // 2. Create sub-folder under folder A
      const createSubFolderResA = await app.request("/api/sequences/folders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Sub Email Folder",
          parentFolderId: folderId,
        }),
      });

      expect(createSubFolderResA.status).toBe(200);
      const subFolderBodyA = await createSubFolderResA.json();
      expect(subFolderBodyA.success).toBe(true);
      expect(subFolderBodyA.folder.parentFolderId).toBe(folderId);

      // 3. List folders as Tenant A -> expect 2 folders
      const listResA = await app.request("/api/sequences/folders", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(listResA.status).toBe(200);
      const listBodyA = await listResA.json();
      expect(listBodyA.data.length).toBe(2);

      // 4. List folders as Tenant B -> expect 0 folders (RLS)
      const listResB = await app.request("/api/sequences/folders", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(listResB.status).toBe(200);
      const listBodyB = await listResB.json();
      expect(listBodyB.data.length).toBe(0);
    });

    it("should prevent duplicate folder names in the same level", async () => {
      // 1. Create first folder
      await app.request("/api/sequences/folders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Folder One" }),
      });

      // 2. Attempt duplicate at same top-level
      const duplicateRes = await app.request("/api/sequences/folders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Folder One" }),
      });

      expect(duplicateRes.status).toBe(400);
      const dupBody = await duplicateRes.json();
      expect(dupBody.success).toBe(false);
      expect(dupBody.error).toContain("already exists");
    });

    it("should prevent recursive folder loops on update", async () => {
      let folder1Id = "";
      let folder2Id = "";

      // 1. Create Folder 1 and Folder 2
      await withTenant(orgA, mockDb, async () => {
        const f1 = await dbStore.marketingSequenceFolders.insert({
          orgId: orgA,
          name: "Folder 1",
          parentFolderId: null,
        });
        const f2 = await dbStore.marketingSequenceFolders.insert({
          orgId: orgA,
          name: "Folder 2",
          parentFolderId: f1.id,
        });
        folder1Id = f1.id;
        folder2Id = f2.id;
      });

      // 2. Try to update Folder 1 parent as Folder 2 (creating a loop)
      const updateRes = await app.request(
        `/api/sequences/folders/${folder1Id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parentFolderId: folder2Id }),
        },
      );

      expect(updateRes.status).toBe(400);
      const updateBody = await updateRes.json();
      expect(updateBody.success).toBe(false);
      expect(updateBody.error).toContain("loop detected");
    });

    it("should support tags, RLS tag limits, and sequence mapping", async () => {
      // 1. Create tag under Tenant A
      const createTagResA = await app.request("/api/sequences/tags", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Enterprise", color: "#0000FF" }),
      });

      expect(createTagResA.status).toBe(200);
      const tagBodyA = await createTagResA.json();
      expect(tagBodyA.success).toBe(true);
      expect(tagBodyA.tag.id).toBeDefined();
      expect(tagBodyA.tag.name).toBe("Enterprise");
      expect(tagBodyA.tag.color).toBe("#0000FF");

      const tagId = tagBodyA.tag.id;

      // 2. Reject invalid colors
      const failTagRes = await app.request("/api/sequences/tags", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "FailTag", color: "blue" }),
      });
      expect(failTagRes.status).toBe(400);

      // 3. Create sequence and map tag to it
      let sequenceId = "";
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "VIP Sequence",
          description: "",
          status: "draft",
        });
        sequenceId = seq.id;
      });

      const mapTagRes = await app.request(`/api/sequences/${sequenceId}/tags`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagId }),
      });

      expect(mapTagRes.status).toBe(200);
      const mapBody = await mapTagRes.json();
      expect(mapBody.success).toBe(true);

      // 4. Retrieve single sequence and verify populated tag lists
      const getSeqRes = await app.request(`/api/sequences/${sequenceId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(getSeqRes.status).toBe(200);
      const getSeqBody = await getSeqRes.json();
      expect(getSeqBody.success).toBe(true);
      expect(getSeqBody.data.tags.length).toBe(1);
      expect(getSeqBody.data.tags[0].name).toBe("Enterprise");

      // 5. Delete tag mapping and confirm removal
      const deleteRes = await app.request(
        `/api/sequences/${sequenceId}/tags/${tagId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(deleteRes.status).toBe(200);

      const getSeqRes2 = await app.request(`/api/sequences/${sequenceId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const getSeqBody2 = await getSeqRes2.json();
      expect(getSeqBody2.data.tags.length).toBe(0);
    });

    it("should filter sequences list by folderId and tagId", async () => {
      let folderId = "";
      let tagId = "";
      let seq1Id = "";
      let seq2Id = "";

      await withTenant(orgA, mockDb, async () => {
        // Create folder, tag, sequences and link them
        const f = await dbStore.marketingSequenceFolders.insert({
          orgId: orgA,
          name: "Main Folder",
          parentFolderId: null,
        });
        const t = await dbStore.marketingSequenceTags.insert({
          orgId: orgA,
          name: "Nurture",
          color: "#FF00FF",
        });
        const s1 = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Seq 1",
          folderId: f.id,
          status: "draft",
        });
        const s2 = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Seq 2",
          status: "draft",
        });

        await dbStore.marketingSequenceTagMappings.insert({
          orgId: orgA,
          sequenceId: s2.id,
          tagId: t.id,
        });

        folderId = f.id;
        tagId = t.id;
        seq1Id = s1.id;
        seq2Id = s2.id;
      });

      // 1. Fetch sequences by folderId
      const listFolderRes = await app.request(
        `/api/sequences?folderId=${folderId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(listFolderRes.status).toBe(200);
      const listFolderBody = await listFolderRes.json();
      expect(listFolderBody.data.length).toBe(1);
      expect(listFolderBody.data[0].id).toBe(seq1Id);

      // 2. Fetch sequences by tagId
      const listTagRes = await app.request(`/api/sequences?tagId=${tagId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(listTagRes.status).toBe(200);
      const listTagBody = await listTagRes.json();
      expect(listTagBody.data.length).toBe(1);
      expect(listTagBody.data[0].id).toBe(seq2Id);
    });
  });
});
