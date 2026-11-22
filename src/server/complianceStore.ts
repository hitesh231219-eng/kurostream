import crypto from 'node:crypto';
import { z } from 'zod';

export const DmcaNoticeInputSchema = z.object({
  claimantName: z.string().trim().min(2, 'Claimant legal name is required').max(120),
  organization: z.string().trim().max(160).optional().default(''),
  email: z.string().trim().email('A valid contact email is required').max(160),
  workTitle: z.string().trim().min(2, 'Copyrighted work title is required').max(240),
  infringingUrlOrId: z
    .string()
    .trim()
    .min(2, 'Specific URL path or media ID is required')
    .max(500),
  anilistId: z.number().int().positive().optional(),
  goodFaithStatement: z
    .boolean()
    .refine((v) => v === true, {
      message: 'Good-faith belief confirmation is required under 17 U.S.C. § 512(c)(3)(A)(v)',
    }),
  accuracyUnderPerjury: z
    .boolean()
    .refine((v) => v === true, {
      message: 'Accuracy & authority statement under penalty of perjury is required',
    }),
  electronicSignature: z
    .string()
    .trim()
    .min(2, 'Electronic signature is required')
    .max(120),
});

export type DmcaNoticeInput = z.infer<typeof DmcaNoticeInputSchema>;

export interface DmcaNoticeRecord {
  caseId: string;
  claimantName: string;
  organization: string;
  email: string;
  workTitle: string;
  infringingUrlOrId: string;
  delistedMediaId: number | null;
  electronicSignature: string;
  receivedAt: number;
  status: 'received_and_actioned';
}

const MAX_RECORDS = 500;

export function extractAnilistIdFromReference(reference: string, explicitId?: number): number | null {
  if (typeof explicitId === 'number' && Number.isInteger(explicitId) && explicitId > 0) {
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

export class ComplianceStore {
  private readonly notices: DmcaNoticeRecord[] = [];
  private readonly delistedIds = new Set<number>();

  submitNotice(input: DmcaNoticeInput): DmcaNoticeRecord {
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    const caseId = `KS-DMCA-${token}`;
    const delistedMediaId = extractAnilistIdFromReference(
      input.infringingUrlOrId,
      input.anilistId
    );

    if (delistedMediaId !== null) {
      this.delistedIds.add(delistedMediaId);
    }

    const record: DmcaNoticeRecord = {
      caseId,
      claimantName: input.claimantName,
      organization: input.organization || '',
      email: input.email,
      workTitle: input.workTitle,
      infringingUrlOrId: input.infringingUrlOrId,
      delistedMediaId,
      electronicSignature: input.electronicSignature,
      receivedAt: Date.now(),
      status: 'received_and_actioned',
    };

    this.notices.push(record);
    if (this.notices.length > MAX_RECORDS) {
      this.notices.shift();
    }

    return record;
  }

  isMediaDelisted(anilistId: number): boolean {
    return this.delistedIds.has(anilistId);
  }

  getSummary(): {
    safeHarborFramework: string;
    totalNoticesReceived: number;
    delistedCount: number;
  } {
    return {
      safeHarborFramework: '17 U.S.C. § 512(d)',
      totalNoticesReceived: this.notices.length,
      delistedCount: this.delistedIds.size,
    };
  }
}
