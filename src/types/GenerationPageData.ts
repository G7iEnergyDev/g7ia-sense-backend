export type GenerationData = {
  installationId: string;
  totalGeneration: number;
  currentIrradiation: number;
  avgEfficiency: number;
  chartData: {
    label: string;
    leftValue: number;
    leftValue2: number;
    rightValue: number;
  }[];
};
