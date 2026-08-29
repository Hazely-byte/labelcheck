import type {
  PriorityFieldId,
  AdditionalFieldId,
  LegalMetrology10FieldId,
} from "./types";

export interface FieldMeta {
  id: string;
  label: string;
  ruleReference: string;
  plainEnglishDescription: string;
  applicabilityNote?: string;
}

// ----------------------------------------------------
// 1. Quick Scan Metadata (Preserved)
// ----------------------------------------------------

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

// ----------------------------------------------------
// 2. Full 10-Field Legal Metrology Metadata
// ----------------------------------------------------

export const LEGAL_METROLOGY_10_FIELDS_META: Record<
  LegalMetrology10FieldId,
  FieldMeta
> = {
  manufacturerAddress: {
    id: "manufacturerAddress",
    label: "Manufacturer / Packer / Importer Name & Address",
    ruleReference: "Rule 6(1)(a)",
    plainEnglishDescription:
      "The full name and complete physical address of the manufacturer, packer, or importer must be printed.",
  },
  countryOfOrigin: {
    id: "countryOfOrigin",
    label: "Country of Origin",
    ruleReference: "Rule 6(1)(a)",
    plainEnglishDescription:
      "Mandatory for all imported packages. Domestic Indian manufactured goods are exempt.",
    applicabilityNote:
      "Not applicable if the commodity is manufactured and packed domestically in India.",
  },
  commodityName: {
    id: "commodityName",
    label: "Generic / Common Name of Commodity",
    ruleReference: "Rule 6(1)(b)",
    plainEnglishDescription:
      "The common or generic name of the commodity contained in the package must be clearly stated.",
  },
  netQuantity: {
    id: "netQuantity",
    label: "Net Quantity (Standard SI Units)",
    ruleReference: "Rule 6(1)(c)",
    plainEnglishDescription:
      "Net content expressed in standard SI units (weight in g/kg, volume in ml/L, or count in numbers/units).",
  },
  mfgMonthYear: {
    id: "mfgMonthYear",
    label: "Month & Year of Manufacture / Packing / Import",
    ruleReference: "Rule 6(1)(d)",
    plainEnglishDescription:
      "Month and year when the product was manufactured, packed, or imported into India.",
  },
  mrp: {
    id: "mrp",
    label: "Maximum Retail Price (MRP inclusive of all taxes)",
    ruleReference: "Rule 6(1)(e)",
    plainEnglishDescription:
      "Maximum retail price inclusive of all taxes, clearly declared in Indian Rupees (₹).",
  },
  consumerCare: {
    id: "consumerCare",
    label: "Consumer Grievance / Care Details",
    ruleReference: "Rule 6(2)",
    plainEnglishDescription:
      "Designated contact person/office with postal address, telephone number, and/or email address.",
  },
  bestBeforeOrExpiry: {
    id: "bestBeforeOrExpiry",
    label: "Best Before / Use By / Expiry Date",
    ruleReference: "Conditional (Perishables / Food)",
    plainEnglishDescription:
      "Shelf life or expiry date. Mandatory for perishable, food, cosmetic, or chemical items.",
    applicabilityNote:
      "Not applicable to non-perishable hard goods, apparel, or durable hardware.",
  },
  unitSalePrice: {
    id: "unitSalePrice",
    label: "Unit Sale Price (USP)",
    ruleReference: "Rule 6(1)(s)",
    plainEnglishDescription:
      "Per-gram, per-kilogram, per-millilitre, or per-litre price when package exceeds standard unit sizes.",
    applicabilityNote:
      "Not applicable to combo, multi-piece assortments, or free sample items.",
  },
  batchNumber: {
    id: "batchNumber",
    label: "Batch / Lot / Identification Code",
    ruleReference: "Rule 6(1)(p) & General",
    plainEnglishDescription:
      "Batch or lot number facilitating supply chain traceability, authentication, and recall.",
  },
};
