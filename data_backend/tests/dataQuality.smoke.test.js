// Smoke-test for the universal data quality fixes against a realistic
// sales dataset (the one screenshotted by the user). Verifies:
//   • Date column tagged as date_iso (not phone)
//   • Numeric columns without symbols are NOT tagged currency
//   • Discount_Pct named hint produces percentage tag
//   • Customer_Rating (1-5 scale) is NOT tagged currency
//   • Fuzzy duplicates do not group rows that differ on numeric values

import { describe, it, expect } from 'vitest';
import { inferSemanticTypes, findFuzzyDuplicates } from '../services/dataQuality.js';

const HEADERS = ['Date', 'Region', 'Product', 'Units_Sold', 'Revenue', 'Discount_Pct', 'Customer_Rating'];

const ROWS = [
  { Date: '2024-01-05', Region: 'North', Product: 'Widget A', Units_Sold: 150, Revenue: 4500, Discount_Pct: 5,  Customer_Rating: 4.5 },
  { Date: '2024-01-19', Region: 'East',  Product: 'Gadget X', Units_Sold: 200, Revenue: 8000, Discount_Pct: 0,  Customer_Rating: 4.8 },
  { Date: '2024-01-26', Region: 'West',  Product: 'Widget A', Units_Sold: 175, Revenue: 5250, Discount_Pct: 10, Customer_Rating: 4.2 },
  { Date: '2024-02-02', Region: 'North', Product: 'Gadget Y', Units_Sold: 50,  Revenue: 3500, Discount_Pct: 15, Customer_Rating: 3.8 },
  { Date: '2024-02-09', Region: 'South', Product: 'Widget A', Units_Sold: 130, Revenue: 3900, Discount_Pct: 5,  Customer_Rating: 4.4 },
  { Date: '2024-03-01', Region: 'North', Product: 'Gadget Y', Units_Sold: 60,  Revenue: 4200, Discount_Pct: 15, Customer_Rating: 3.9 },
  { Date: '2024-03-22', Region: 'West',  Product: 'Widget B', Units_Sold: 110, Revenue: 3300, Discount_Pct: 10, Customer_Rating: 3.5 },
  { Date: '2024-04-01', Region: 'North', Product: 'Widget A', Units_Sold: 165, Revenue: 4950, Discount_Pct: 5,  Customer_Rating: 4.6 },
  { Date: '2024-04-15', Region: 'East',  Product: 'Gadget X', Units_Sold: 195, Revenue: 7800, Discount_Pct: 0,  Customer_Rating: 4.7 },
  { Date: '2024-05-08', Region: 'South', Product: 'Widget A', Units_Sold: 120, Revenue: 3600, Discount_Pct: 5,  Customer_Rating: 4.3 },
  { Date: '2024-05-15', Region: 'West',  Product: 'Widget B', Units_Sold: 95,  Revenue: 2850, Discount_Pct: 10, Customer_Rating: 3.6 },
  { Date: '2024-06-03', Region: 'North', Product: 'Widget A', Units_Sold: 180, Revenue: 5400, Discount_Pct: 5,  Customer_Rating: 4.5 },
];

describe('inferSemanticTypes — universal correctness', () => {
  const types = inferSemanticTypes(HEADERS, ROWS);

  it('classifies the Date column as date, not phone', () => {
    expect(types.Date.baseType).toBe('date');
    expect(types.Date.semanticType).not.toBe('phone');
    // Either date_iso or null is acceptable; phone is the bug we are guarding
    expect(['date_iso', null]).toContain(types.Date.semanticType);
  });

  it('does not tag plain integer counts (Units_Sold) as currency', () => {
    expect(types.Units_Sold.baseType).toBe('numeric');
    expect(types.Units_Sold.semanticType).not.toBe('currency');
    expect(types.Units_Sold.semanticType).not.toBe('phone');
  });

  it('does not tag a 1-5 rating column as currency', () => {
    expect(types.Customer_Rating.baseType).toBe('numeric');
    expect(types.Customer_Rating.semanticType).not.toBe('currency');
    expect(types.Customer_Rating.semanticType).not.toBe('phone');
  });

  it('tags Discount_Pct as percentage via name hint', () => {
    expect(types.Discount_Pct.baseType).toBe('numeric');
    expect(types.Discount_Pct.semanticType).toBe('percentage');
  });

  it('tags Revenue as currency via name hint', () => {
    expect(types.Revenue.baseType).toBe('numeric');
    expect(types.Revenue.semanticType).toBe('currency');
  });

  it('classifies Region and Product as categorical with no semantic type', () => {
    expect(types.Region.baseType).toBe('categorical');
    expect(types.Product.baseType).toBe('categorical');
    expect(types.Region.semanticType).toBeNull();
    expect(types.Product.semanticType).toBeNull();
  });

  it('handles values containing actual currency symbols', () => {
    const rows = [
      { id: 1, price: '$1,234.56' },
      { id: 2, price: '$99.99' },
      { id: 3, price: '$50.00' },
      { id: 4, price: '$2,500.00' },
      { id: 5, price: '$10.50' },
      { id: 6, price: '$99.00' },
      { id: 7, price: '$199.00' },
      { id: 8, price: '$1.00' },
      { id: 9, price: '$0.50' },
      { id: 10, price: '$45.00' },
    ];
    const t = inferSemanticTypes(['id', 'price'], rows);
    expect(t.price.semanticType).toBe('currency');
  });

  it('handles email addresses', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: i, email: `user${i}@example.com` }));
    const t = inferSemanticTypes(['id', 'email'], rows);
    expect(t.email.semanticType).toBe('email');
  });

  it('handles real phone numbers when name hints', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ name: `Person ${i}`, phone: `(555) 123-${1000 + i}` }));
    const t = inferSemanticTypes(['name', 'phone'], rows);
    expect(t.phone.semanticType).toBe('phone');
  });
});

describe('findFuzzyDuplicates — does not group rows that differ on numerics', () => {
  it('does not match Widget A and Widget B as duplicates', () => {
    const rows = [
      { Date: '2024-01-26', Region: 'West', Product: 'Widget A', Units_Sold: 175, Revenue: 5250 },
      { Date: '2024-03-22', Region: 'West', Product: 'Widget B', Units_Sold: 110, Revenue: 3300 },
    ];
    const headers = ['Date', 'Region', 'Product', 'Units_Sold', 'Revenue'];
    const result = findFuzzyDuplicates(rows, headers, 0.10);
    // These rows differ on Date, Product, Units_Sold, Revenue — should NOT be grouped
    expect(result.duplicateGroups).toHaveLength(0);
    expect(result.totalDuplicates).toBe(0);
  });

  it('does match true near-duplicate rows', () => {
    const rows = [
      { Date: '2024-01-15', Region: 'North', Product: 'Widget A', Units_Sold: 150, Revenue: 4500 },
      { Date: '2024-01-15', Region: 'North', Product: 'Widget A', Units_Sold: 150, Revenue: 4500 }, // exact dup
      { Date: '2024-01-15', Region: 'North', Product: 'Widget A', Units_Sold: 152, Revenue: 4500 }, // near dup
      { Date: '2024-02-05', Region: 'South', Product: 'Widget B', Units_Sold: 80,  Revenue: 2000 },
    ];
    const headers = ['Date', 'Region', 'Product', 'Units_Sold', 'Revenue'];
    const result = findFuzzyDuplicates(rows, headers, 0.10);
    expect(result.duplicateGroups.length).toBeGreaterThanOrEqual(1);
    const firstGroup = result.duplicateGroups[0];
    expect(firstGroup.rowCount).toBeGreaterThanOrEqual(2);
    // sampleRows length must match rowCount (no off-by-one display bug)
    expect(firstGroup.sampleRows.length).toBe(firstGroup.rowCount);
  });

  it('returns rowCount field equal to indices length', () => {
    const rows = [
      { Date: '2024-01-15', Region: 'North', Value: 100 },
      { Date: '2024-01-15', Region: 'North', Value: 100 },
      { Date: '2024-01-15', Region: 'North', Value: 100 },
      { Date: '2024-12-31', Region: 'South', Value: 999 },
    ];
    const result = findFuzzyDuplicates(rows, ['Date', 'Region', 'Value'], 0.10);
    if (result.duplicateGroups.length > 0) {
      for (const g of result.duplicateGroups) {
        expect(g.rowCount).toBe(g.indices.length);
        expect(g.sampleRows.length).toBe(g.rowCount);
      }
    }
  });
});
