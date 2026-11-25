export const GAME_TYPES = [
  {value: 'singles', label: 'Одиночная'},
  {value: 'doubles', label: 'Парная'},
  {value: 'mixed', label: 'Микст'},
  {value: 'any', label: 'Любая'},
] as const;

export const GENDER_OPTIONS = [
  {value: 'M', label: 'Мужчина'},
  {value: 'F', label: 'Женщина'},
] as const;

export const GAME_TYPE_LABELS: Record<string, string> = {
  singles: 'Одиночная',
  doubles: 'Парная',
  mixed: 'Микст',
  any: 'Любая',
};
