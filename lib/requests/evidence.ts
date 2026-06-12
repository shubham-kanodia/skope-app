/**
 * The evidence jsonb written with a rights request. Pure (no DB imports) so a
 * unit test can pin the contract: the free-text detail is stored ONLY
 * encrypted (detailEnc), never under a plaintext key (see SECURITY.md).
 */
export function buildEvidence(detailEnc: string | null): { detailEnc: string | null; submittedEmail: true } {
  return { detailEnc, submittedEmail: true };
}
