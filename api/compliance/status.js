import { ComplianceStore } from '../_lib/complianceStore.mjs';

const sharedComplianceStore = new ComplianceStore();

export default function handler(req, res) {
  const rawId = req.query?.anilistId;
  const parsedId =
    typeof rawId === 'string' && /^\d{1,9}$/.test(rawId.trim()) ? Number(rawId.trim()) : null;
  const summary = sharedComplianceStore.getSummary();
  return res.status(200).json({
    ...summary,
    ...(parsedId !== null
      ? { anilistId: parsedId, delisted: sharedComplianceStore.isMediaDelisted(parsedId) }
      : {}),
  });
}
