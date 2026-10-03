import { assignVertical, Vertical } from './vertical-assignment';

describe('assignVertical', () => {
  it('should return OPPORTUNITY for OPPORTUNITY type regardless of product category', () => {
    expect(assignVertical('OPPORTUNITY', 'crops')).toBe(Vertical.OPPORTUNITY);
    expect(assignVertical('OPPORTUNITY', 'electronics')).toBe(Vertical.OPPORTUNITY);
    expect(assignVertical('OPPORTUNITY')).toBe(Vertical.OPPORTUNITY);
  });

  it('should return AGRICULTURE for agriculture categories', () => {
    const agricultureCategories = [
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
    ];

    agricultureCategories.forEach((category) => {
      expect(assignVertical('MARKETPLACE', category)).toBe(Vertical.AGRICULTURE);
      expect(assignVertical('GENERAL', category)).toBe(Vertical.AGRICULTURE);
    });
  });

  it('should return BUSINESS for non-agriculture categories', () => {
    const businessCategories = ['electronics', 'clothing', 'furniture', 'services', 'machinery'];

    businessCategories.forEach((category) => {
      expect(assignVertical('MARKETPLACE', category)).toBe(Vertical.BUSINESS);
      expect(assignVertical('GENERAL', category)).toBe(Vertical.BUSINESS);
    });
  });

  it('should return BUSINESS for MARKETPLACE/GENERAL without product', () => {
    expect(assignVertical('MARKETPLACE')).toBe(Vertical.BUSINESS);
    expect(assignVertical('GENERAL')).toBe(Vertical.BUSINESS);
  });

  it('should be case-insensitive for category matching', () => {
    expect(assignVertical('MARKETPLACE', 'CROPS')).toBe(Vertical.AGRICULTURE);
    expect(assignVertical('MARKETPLACE', 'CrOpS')).toBe(Vertical.AGRICULTURE);
    expect(assignVertical('MARKETPLACE', 'ELECTRONICS')).toBe(Vertical.BUSINESS);
  });

  it('should match partial category names', () => {
    expect(assignVertical('MARKETPLACE', 'organic crops')).toBe(Vertical.AGRICULTURE);
    expect(assignVertical('MARKETPLACE', 'dairy farming')).toBe(Vertical.AGRICULTURE);
    expect(assignVertical('MARKETPLACE', 'farm machinery rental')).toBe(Vertical.AGRICULTURE);
  });

  it('should route agriculture service categories to AGRICULTURE', () => {
    expect(assignVertical('SERVICE', undefined, 'veterinary services')).toBe(Vertical.AGRICULTURE);
    expect(assignVertical('SERVICE', undefined, 'irrigation')).toBe(Vertical.AGRICULTURE);
    expect(assignVertical('SERVICE', undefined, 'photography')).toBe(Vertical.BUSINESS);
  });
});
