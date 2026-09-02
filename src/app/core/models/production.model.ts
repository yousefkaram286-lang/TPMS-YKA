export interface Production {
  id: string;
  sessionId?: string;       // links to ProductionSession; absent on legacy records
  date: string;
  shiftId: string;              // '' when shift not captured (optional input)
  lineId: string;
  machineId?: string;       // Optional for backward compatibility with older records
  supervisor: string;
  productId: string;
  piecesPerPress: number;
  presses: number;
  produced: number;
  releasedOutput?: number;  // Optional for backward compatibility
  output?: number;          // Legacy field — kept for backward compat
  createdAt: string;
  updatedAt?: string;
}
