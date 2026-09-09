export const PERIODS = [
  { key: "morning", label: "Sáng", startHour: 8, endHour: 12 },
  { key: "afternoon", label: "Chiều", startHour: 12, endHour: 18 },
  { key: "evening", label: "Tối", startHour: 18, endHour: 22 },
] as const;

export type Period = (typeof PERIODS)[number];
