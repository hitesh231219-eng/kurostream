// src/server/complianceStore.ts
import crypto from "node:crypto";
import { z } from "zod";
var DmcaNoticeInputSchema = z.object({
  claimantName: z.string().trim().min(2, "Claimant legal name is required").max(120),
  organization: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().email("A valid contact email is required").max(160),
  workTitle: z.string().trim().min(2, "Copyrighted work title is required").max(240),
  infringingUrlOrId: z.string().trim().min(2, "Specific URL path or media ID is required").max(500),
  anilistId: z.number().int().positive().optional(),
  goodFaithStatement: z.boolean().refine((v) => v === true, {
    message: "Good-faith belief confirmation is required under 17 U.S.C. \xA7 512(c)(3)(A)(v)"
  }),
  accuracyUnderPerjury: z.boolean().refine((v) => v === true, {
    message: "Accuracy & authority statement under penalty of perjury is required"
  }),
  electronicSignature: z.string().trim().min(2, "Electronic signature is required").max(120)
});
var MAX_RECORDS = 500;
function extractAnilistIdFromReference(reference, explicitId) {
  if (typeof explicitId === "number" && Number.isInteger(explicitId) && explicitId > 0) {
    return explicitId;
  }
  const trimmed = reference.trim();
  if (/^\d{1,9}$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return parsed > 0 ? parsed : null;
  }
  const pathMatch = trimmed.match(/(?:anime|manga|anilist)[/:=](\d{1,9})/i);
  if (pathMatch?.[1]) {
    const parsed = Number(pathMatch[1]);
    return parsed > 0 ? parsed : null;
  }
  return null;
}
var ComplianceStore = class {
  constructor() {
    this.notices = [];
    this.delistedIds = /* @__PURE__ */ new Set();
  }
  submitNotice(input) {
    const token = crypto.randomBytes(4).toString("hex").toUpperCase();
    const caseId = `KS-DMCA-${token}`;
    const delistedMediaId = extractAnilistIdFromReference(
      input.infringingUrlOrId,
      input.anilistId
    );
    if (delistedMediaId !== null) {
      this.delistedIds.add(delistedMediaId);
    }
    const record = {
      caseId,
      claimantName: input.claimantName,
      organization: input.organization || "",
      email: input.email,
      workTitle: input.workTitle,
      infringingUrlOrId: input.infringingUrlOrId,
      delistedMediaId,
      electronicSignature: input.electronicSignature,
      receivedAt: Date.now(),
      status: "received_and_actioned"
    };
    this.notices.push(record);
    if (this.notices.length > MAX_RECORDS) {
      this.notices.shift();
    }
    return record;
  }
  isMediaDelisted(anilistId) {
    return this.delistedIds.has(anilistId);
  }
  getSummary() {
    return {
      safeHarborFramework: "17 U.S.C. \xA7 512(d)",
      totalNoticesReceived: this.notices.length,
      delistedCount: this.delistedIds.size
    };
  }
};
export {
  ComplianceStore,
  DmcaNoticeInputSchema,
  extractAnilistIdFromReference
};
