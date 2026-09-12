export const VALUE_TYPES = [
  'OneD',
  'TwoD',
  'TwoD_SPATIAL',
  'ThreeD',
  'ThreeD_SPATIAL',
  'COLOR',
  'TEXT_DOCUMENT',
  'SHAPE',
  'MARKER',
  'LAYER_INDEX',
  'MASK_INDEX',
  'CUSTOM_VALUE',
] as const;
export interface AEProperty {
  name: string;
  matchName: string;
  valueType: string;
  canSetExpression: boolean;
  hasExpression: boolean;
  expressionEnabled: boolean;
  expressionText: string;
  layerName: string;
  compName: string;
  numKeys: number;
  token: string;
}
export type HostFailure = { ok: false; reason: string; message?: string; count?: number };
export type SelectedPropertyResult = { ok: true; property: AEProperty } | HostFailure;
export interface ExpressionParameter {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'select' | 'text';
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}
export interface ExpressionCompatibility {
  valueTypes?: string[];
  matchNames?: string[];
  minKeys?: number;
}
export interface ExpressItExpression {
  id: string;
  version: number;
  source: 'core' | 'user';
  name: string;
  description: string;
  category: string;
  tags: string[];
  template: string;
  compatibility: ExpressionCompatibility;
  parameters: ExpressionParameter[];
  createdAt?: string;
  updatedAt?: string;
}
export interface LibraryFile {
  schemaVersion: 1;
  expressions: ExpressItExpression[];
}
export interface ExpressionPack extends LibraryFile {
  format: 'expressit-pack';
  name: string;
  exportedAt: string;
}
export interface Settings {
  schemaVersion: 1;
  favorites: string[];
  compatibleOnly: boolean;
}
