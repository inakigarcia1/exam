import type { Database } from "../types.js";
import { subjects } from "../schema/pg.js";
import { createAsyncTenantCrudRepo } from "./baseRepo.js";

/** Tenant-scoped CRUD for the subject table. */
export function createSubjectRepo(db: Database) {
  return createAsyncTenantCrudRepo(db, subjects);
}
