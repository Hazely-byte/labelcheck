import type { PriorityFieldId, AdditionalFieldId } from "./types";

export interface FieldMeta {
  id: string;
  label: string;
  ruleReference: string;
  plainEnglishDescription: string;
}

export const PRIORITY_FIELDS_META: Record<PriorityFieldId, FieldMeta> = {
  mrp: {
    id: "mrp",
    label: "Maximum Retail Price (MRP)",
    ruleReference: "Rule 6(1)(e)",
    plainEnglishDescription:
      "MRP inclusive of all taxes must be declared in Indian Rupees (₹).",
  },
  mfgMonthYear: {
    id: "mfgMonthYear",
    label: "Month & Year of Manufacture / Packing",
    ruleReference: "Rule 6(1)(d)",
    plainEnglishDescription:
      "Month and year when the commodity was manufactured, packed, or imported must be stated.",
  },
  bestBeforeOrExpiry: {
    id: "bestBeforeOrExpiry",
    label: "Best Before / Expiry Date",
    ruleReference: "Conditional",
    plainEnglishDescription:
      "Best before, use by, or expiry date where applicable (food/perishables).",
  },
};

export const ADDITIONAL_FIELDS_META: Record<AdditionalFieldId, FieldMeta> = {
  netQuantity: {
    id: "netQuantity",
    label: "Net Quantity",
    ruleReference: "Rule 6(1)(c)",
    plainEnglishDescription: "Net quantity in standard SI units (g, kg, ml, l, units).",
  },
  batchNumber: {
    id: "batchNumber",
    label: "Batch / Lot Number",
    ruleReference: "General",
    plainEnglishDescription: "Batch or lot number for traceability and recall.",
  },
  commodityName: {
    id: "commodityName",
    label: "Commodity Name",
    ruleReference: "Rule 6(1)(b)",
    plainEnglishDescription: "Generic or common name of the commodity.",
  },
  manufacturerAddress: {
    id: "manufacturerAddress",
    label: "Manufacturer / Packer Details",
    ruleReference: "Rule 6(1)(a)",
    plainEnglishDescription: "Name and full address of manufacturer/packer/importer.",
  },
  consumerCare: {
    id: "consumerCare",
    label: "Consumer Care Details",
    ruleReference: "Rule 6(2)",
    plainEnglishDescription: "Contact phone, email, and/or address for consumer grievances.",
  },
  countryOfOrigin: {
    id: "countryOfOrigin",
    label: "Country of Origin",
    ruleReference: "Rule 6(1)(a)",
    plainEnglishDescription: "Country of origin (if imported).",
  },
  unitSalePrice: {
    id: "unitSalePrice",
    label: "Unit Sale Price",
    ruleReference: "Conditional",
    plainEnglishDescription: "Per-gram/ml unit sale price (where applicable).",
  },
};
