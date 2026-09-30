/**
 * Machinery a farmer can tick on the subscription form. The one list, imported by the Cloud Functions and both apps.
 * Keep this file free of imports: it is compiled by two separate TypeScript projects. Codes are stored on
 * `farmerSubscriptions/{id}.machinery`, so never rename one — only add.
 */
export const farmerMachinery = [
  { code: 'powerTiller', label: 'Power tiller' },
  { code: 'dripSystem', label: 'Drip system' },
  { code: 'weeder', label: 'Weeder' },
  { code: 'rotovator', label: 'Rotovator' },
  { code: 'baler', label: 'Baler' },
  { code: 'sprayers', label: 'Sprayers' },
  { code: 'other', label: 'Other' },
] as const;

export type FarmerMachineryCode = (typeof farmerMachinery)[number]['code'];

export const isFarmerMachineryCode = (value: unknown): value is FarmerMachineryCode =>
  farmerMachinery.some((item) => item.code === value);

/** English label for a stored code (the admin app and the farmer SMS are English); unknown codes show as-is. */
export const farmerMachineryLabel = (code: string) => farmerMachinery.find((item) => item.code === code)?.label ?? code;
