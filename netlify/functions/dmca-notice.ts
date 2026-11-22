import { ComplianceStore, DmcaNoticeInputSchema } from '../../src/server/complianceStore';

const sharedComplianceStore = new ComplianceStore();

export async function handler(event: any) {
  if (event?.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let bodyObj: unknown;
  try {
    bodyObj = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const parsed = DmcaNoticeInputSchema.safeParse(bodyObj);
  if (!parsed.success) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: parsed.error.issues[0]?.message || 'Incomplete DMCA takedown notice',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    };
  }

  const record = sharedComplianceStore.submitNotice(parsed.data);
  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      caseId: record.caseId,
      receivedAt: record.receivedAt,
      delistedMediaId: record.delistedMediaId,
      status: record.status,
      message:
        record.delistedMediaId !== null
          ? `Notice logged (${record.caseId}) and media ID ${record.delistedMediaId} added to the compliance delist registry.`
          : `Notice logged (${record.caseId}). Our designated compliance review queue has recorded your request.`,
    }),
  };
}
