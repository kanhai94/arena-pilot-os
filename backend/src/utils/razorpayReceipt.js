const randomSuffix = () => Math.random().toString(36).slice(2, 6);

export const buildRazorpayReceipt = (prefix, tenantId = '') => {
  const tenantSuffix = String(tenantId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6);
  const stamp = Date.now().toString(36);
  const receipt = `${prefix}_${tenantSuffix}_${stamp}_${randomSuffix()}`.replace(/_+/g, '_');

  return receipt.slice(0, 40);
};
