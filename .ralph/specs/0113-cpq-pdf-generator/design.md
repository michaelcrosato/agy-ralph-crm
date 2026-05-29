# Specification: CPQ PDF Generator - Design

## 1. Relational Database Elements
This feature uses the existing `documentTemplates`, `mergedDocuments`, and `opportunityProducts` schemas without modification, preserving the zero-leak tenant RLS boundaries.

## 2. Core CPQ Pricing Functions (`packages/core/src/index.ts`)

We will add a new utility section for CPQ discount calculations.

```typescript
export interface DiscountTier {
  minQuantity: number;
  discountPercentage: number; // e.g. 10 representing 10%
}

export interface CPQProductConfig {
  unitPrice: string;
  quantity: number;
  discountTiers?: DiscountTier[];
  customDiscountPercentage?: number;
}

export interface CPQPriceCalculation {
  subtotal: string;
  discountAmount: string;
  totalPrice: string;
}

export function calculateCPQPrice(config: CPQProductConfig): CPQPriceCalculation {
  const price = Number.parseFloat(config.unitPrice) || 0;
  const qty = config.quantity;
  const subtotalVal = price * qty;

  let discountPct = 0;
  if (config.discountTiers && config.discountTiers.length > 0) {
    const sortedTiers = [...config.discountTiers].sort((a, b) => b.minQuantity - a.minQuantity);
    const matchedTier = sortedTiers.find(tier => qty >= tier.minQuantity);
    if (matchedTier) {
      discountPct = matchedTier.discountPercentage;
    }
  } else {
    // Default tiering rules if not provided
    if (qty >= 100) discountPct = 20;
    else if (qty >= 50) discountPct = 15;
    else if (qty >= 10) discountPct = 10;
  }

  if (config.customDiscountPercentage !== undefined) {
    discountPct = Math.max(discountPct, config.customDiscountPercentage);
  }

  const discountVal = subtotalVal * (discountPct / 100);
  const totalVal = subtotalVal - discountVal;

  return {
    subtotal: subtotalVal.toFixed(2),
    discountAmount: discountVal.toFixed(2),
    totalPrice: totalVal.toFixed(2),
  };
}
```

## 3. Hono API Routes (`apps/api/src/index.ts`)

- **POST `/api/opportunities/:oppId/quote`**:
  - Fetch opportunity, account, and line items.
  - Apply volume discount and optional `customDiscountPercentage` to each line item.
  - Build an HTML representation of the line items.
  - Compile the quote using `@crm/documents`' `compileTemplate`.
  - Save the merged quote into `mergedDocuments` under tenant isolation.
  - Update the opportunity `amount` with the new discounted total.
  - Return the compiled HTML quote and calculation breakdown.

- **GET `/api/opportunities/:oppId/quote`**:
  - Retrieve the latest merged quote document or dynamically compile one based on current line items.
