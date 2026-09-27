# Prisma Holográfico Dobrável 3D

Aplicação React + TypeScript + Tailwind CSS com:

- `@mediapipe/hands` usando `modelComplexity: 0`;
- rastreamento exclusivo das landmarks 4 (polegar) e 8 (indicador);
- smoothing exponencial/lerp com alpha 0.75;
- ordenação das mãos por X após o espelhamento da selfie;
- prisma de duas facetas, pirâmide, pirâmide invertida e lente diamante;
- shader WebGL2 térmico iridescente com refração 1.08x;
- composição sem `getImageData`;
- gravação do canvas a 60 FPS via `captureStream(60)` + `MediaRecorder`;
- negociação automática MP4/H.264 quando suportado, com fallback para WebM.

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite. Para câmera fora de `localhost`, sirva a aplicação em HTTPS.

## Build

```bash
npm run build
npm run preview
```

## Gestos

- **1 mão:** polegar + indicador formam uma lente holográfica em diamante.
- **2 mãos:** os quatro pontos formam o prisma dobrável central.
- **Indicadores juntos no topo:** pirâmide 3D.
- **Polegares juntos na base:** pirâmide invertida.

## Desempenho

O loop visual usa `requestAnimationFrame` e mira 60 FPS. A inferência MediaPipe é desacoplada e nunca sobrepõe chamadas `send()`, evitando filas de frames. A taxa real depende da câmera, GPU, CPU e navegador do dispositivo.

A aplicação não usa `getImageData`, leitura de pixels por CPU nem desenho de skeleton/landmarks na câmera.
