# LabelCheck 🏷️

Instant compliance flagging for Indian retail product labels under the **Legal Metrology (Packaged Commodities) Rules, 2011**.

Upload a photo of any retail product label to check priority declarations and extract visible label information in under 2 seconds.

---

## Features

- **Tier 1 — Priority Declarations**: Evaluates and flags mandatory requirements:
  - **MRP** (Rule 6(1)(e)) — Maximum Retail Price inclusive of all taxes in ₹
  - **Date of Manufacture/Packing** (Rule 6(1)(d)) — Month and year
  - **Best Before / Expiry Date** — Shelf life where applicable
- **Rule 9 Deferral Detection**: Automatically detects and flags placeholders like *"See on side"*, *"See back"*, or blank entries as **Not Detected** per statutory display requirements.
- **Tier 2 — Additional Declarations**: Opportunistically extracts visible secondary declarations (*Net Quantity, Batch Number, Commodity Name, Manufacturer Details, Consumer Care, Country of Origin, Unit Sale Price*).
- **Client-Side Optimization**: Automatically resizes and compresses label photos before analysis for fast upload and low latency.
- **Private & Stateless**: No database or persistence. State lives purely in memory for the current session.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **AI SDK**: Google Gen AI SDK (`@google/genai`) using Flash-Lite vision models
- **Image Processing**: `browser-image-compression`

---

## Getting Started

### 1. Prerequisites

- Node.js 18+ installed
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 2. Environment Setup

Create a `.env.local` file in the project root:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

*(Note: `.env.local` is listed in `.gitignore` and is never committed to version control.)*

### 3. Installation & Run

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. Click **Login as Inspector** on the entry screen.
2. Drag and drop or select a clear photo of an Indian retail product label.
3. Click **Analyze Label**.
4. Review the compliance status cards, extracted text, confidence scores, and explanatory notes.

---

## Disclaimer

*LabelCheck is an informational compliance-flagging prototype only — not a legal compliance certification. For official statutory verification, consult a Legal Metrology officer.*
