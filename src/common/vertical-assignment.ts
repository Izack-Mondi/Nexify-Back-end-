export enum Vertical {
  BUSINESS = 'BUSINESS',
  AGRICULTURE = 'AGRICULTURE',
  OPPORTUNITY = 'OPPORTUNITY',
}

export const AGRICULTURE_CATEGORIES = [
  'crops',
  'livestock',
  'dairy',
  'produce',
  'poultry',
  'fish',
  'farm inputs',
  'seeds',
  'fertilizers',
  'pesticides',
  'farm machinery',
  'agricultural equipment',
  'vegetables',
  'fruits',
  'grains',
  'cereals',
  'agriculture',
  'farming',
] as const;

export const AGRICULTURE_SERVICE_CATEGORIES = [
  'veterinary',
  'vet',
  'irrigation',
  'farm consultation',
  'agricultural consulting',
  'crop consulting',
  'livestock consulting',
  'pest control',
  'agricultural engineering',
  'farm management',
] as const;

export function assignVertical(type: string, productCategory?: string, serviceCategory?: string): Vertical {
  // OPPORTUNITY posts always go to OPPORTUNITY vertical
  if (type === 'OPPORTUNITY') {
    return Vertical.OPPORTUNITY;
  }

  // Check service category for agriculture services
  if (serviceCategory) {
    const normalizedCategory = serviceCategory.toLowerCase();
    const isAgriculture = AGRICULTURE_SERVICE_CATEGORIES.some(
      (cat) => normalizedCategory.includes(cat.toLowerCase())
    );
    
    if (isAgriculture) {
      return Vertical.AGRICULTURE;
    }
  }

  // MARKETPLACE or GENERAL posts with a product
  if (productCategory) {
    const normalizedCategory = productCategory.toLowerCase();
    const isAgriculture = AGRICULTURE_CATEGORIES.some(
      (cat) => normalizedCategory.includes(cat.toLowerCase())
    );
    
    return isAgriculture ? Vertical.AGRICULTURE : Vertical.BUSINESS;
  }

  // Default to BUSINESS for MARKETPLACE/GENERAL without products
  return Vertical.BUSINESS;
}
