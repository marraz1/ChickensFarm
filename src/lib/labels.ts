import type {
  BirdType,
  Sex,
  LossReasonType,
  ExpenseCategory,
  EggQuality,
} from "@/generated/prisma/client";

export const birdTypeLabels: Record<BirdType, string> = {
  HEN: "Višta",
  GOOSE: "Žąsis",
  DUCK: "Antis",
  TURKEY: "Kalakutas",
  OTHER: "Kita",
};

export const sexLabels: Record<Sex, string> = {
  MALE: "Patinas",
  FEMALE: "Patelė",
  UNKNOWN: "Nenustatyta",
};

export const lossReasonLabels: Record<LossReasonType, string> = {
  DISEASE: "Liga",
  PREDATOR: "Plėšrūnas",
  OTHER: "Kita",
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  FEED: "Pašarai",
  VITAMINS: "Vitaminai",
  MEDICINE: "Vaistai",
  PRODUCTIVITY: "Produktyvumo priemonės",
  OTHER: "Kita",
};

export const eggQualityLabels: Record<EggQuality, string> = {
  HEALTHY: "Sveiki",
  BROKEN: "Sudaužyti",
};
