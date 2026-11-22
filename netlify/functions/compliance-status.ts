import { ComplianceStore } from '../../src/server/complianceStore';

const sharedComplianceStore = new ComplianceStore();

export async function handler(event: any) {
  const rawId = event?.queryStringParameters?.anilistId;
  const parsedId =
    typeof rawId === 'string' && /^\d{1,9}$/.test(rawId.trim()) ? Number(rawId.trim()) : null;
  const summary = sharedComplianceStore.getSummary();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...summary,
      ...(parsedId !== null
        ? { anilistId: parsedId, delisted: sharedComplianceStore.isMediaDelisted(parsedId) }
        : {}),
    }),
  };
}
