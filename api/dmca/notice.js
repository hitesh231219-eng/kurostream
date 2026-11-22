import { ComplianceStore, DmcaNoticeInputSchema } from '../_lib/complianceStore.mjs';

const sharedComplianceStore = new ComplianceStore();

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = DmcaNoticeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Incomplete DMCA takedown notice',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  const record = sharedComplianceStore.submitNotice(parsed.data);
  return res.status(201).json({
    ok: true,
    caseId: record.caseId,
    receivedAt: record.receivedAt,
    delistedMediaId: record.delistedMediaId,
    status: record.status,
    message:
      record.delistedMediaId !== null
        ? `Notice logged (${record.caseId}) and media ID ${record.delistedMediaId} added to the compliance delist registry.`
        : `Notice logged (${record.caseId}). Our designated compliance review queue has recorded your request.`,
  });
}
