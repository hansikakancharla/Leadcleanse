export type DataRow = Record<string, string | number | null>;

export interface DataState {
  raw: DataRow[];
  current: DataRow[];
  columns: string[];
  fileName: string;
}

export interface StandardizationPair {
  original_value: string;
  standardized_value: string;
}

export interface StandardizationResponse {
  mappings: StandardizationPair[];
}

export interface PivotConfig {
  groupByCols: string[];
  valueCol: string | null;
  aggFunc: 'count' | 'sum' | 'avg';
}

export interface PivotRow extends Record<string, string | number> {
  _count: number;
}
