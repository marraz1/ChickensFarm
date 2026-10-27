import type {
  BirdType,
  Sex,
  BirdCategory,
  LossReasonType,
  ExpenseCategory,
  EggQuality,
  BirdTransactionType,
  FarmArea,
} from "@/generated/prisma/client";

export const birdCategoryLabels: Record<BirdCategory, string> = {
  CHICK: "Viščiukai",
  PULLET: "Jauniklės vištos",
  COCKEREL: "Jaunikliai gaidukai",
  LAYER: "Dedeklės",
  ROOSTER: "Gaidukai",
  OTHER: "Kita",
};

// Display order for flock breakdowns (dashboard + Paukščių grupės apžvalga).
export const birdTypeOrder: BirdType[] = ["HEN", "GOOSE", "DUCK", "TURKEY", "OTHER"];
export const birdCategoryOrder: BirdCategory[] = [
  "LAYER",
  "ROOSTER",
  "PULLET",
  "COCKEREL",
  "CHICK",
  "OTHER",
];

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

export const birdTransactionTypeLabels: Record<BirdTransactionType, string> = {
  PURCHASE: "Pirkimas",
  SALE: "Pardavimas",
};

// The other party's role depends on the direction: we sell to a buyer and buy
// from a seller.
export const birdTransactionCounterpartyLabels: Record<BirdTransactionType, string> = {
  PURCHASE: "Pardavėjas",
  SALE: "Pirkėjas",
};

export const farmAreaLabels: Record<FarmArea, string> = {
  EGGS: "Kiaušiniai ir prekyba",
  HENS: "Perekšlės",
  INC: "Perinimas",
  MEAT: "Mėsiniai paukščiai",
  SHARED: "Bendra",
};

// Display order for area breakdowns, matching the V2 navigation; "Bendra"
// comes last, after the areas it is shared between.
export const farmAreaOrder: FarmArea[] = ["EGGS", "HENS", "INC", "MEAT", "SHARED"];
