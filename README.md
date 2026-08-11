# LottoERY

Global website for **LottoERY** — ONE WORLD. MANY LOTTERIES.

LottoERY is a lottery technology and app ecosystem providing regional lottery apps, results, analysis, predictions, and tools. LottoERY does not operate or conduct lotteries.

## Stack

- React + TypeScript (Vite)
- Three.js + React Three Fiber + Drei
- Tailwind CSS v4
- Framer Motion

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Architecture

Lottery and app data live in `src/data/` so new regions and products can be added without rewriting presentation components. The interactive globe is isolated in `src/components/Globe/`.
