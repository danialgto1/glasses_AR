# 3D Glasses Try-On

A real-time 3D glasses virtual try-on application that uses face detection and augmented reality to preview glasses on your face.

## Features

- 🎯 **Real-time Face Detection**: Uses MediaPipe's FaceLandmarker for accurate face landmark detection
- 🥽 **Virtual 3D Glasses**: Try on different styles of glasses in real-time
- 📹 **Webcam Integration**: Direct webcam access for instant previewing
- 🎨 **3D Rendering**: Powered by Three.js for high-quality 3D graphics
- ⚡ **Fast & Responsive**: Built with Vite for optimal development and build performance
- 🎭 **Multiple Styles**: Support for different glasses configurations and styles

## Tech Stack

- **Frontend Framework**: React 19
- **3D Graphics**: Three.js with React Three Fiber
- **Face Detection**: MediaPipe Tasks Vision
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Package Manager**: pnpm

## Installation

### Prerequisites

- Node.js (v16 or higher)
- pnpm (or npm/yarn)
- Webcam access

### Setup

1. Clone the repository

```bash
git clone <repository-url>
cd glasses_tryon
```

2. Install dependencies

```bash
pnpm install
```

3. Start the development server

```bash
pnpm dev
```

The application will be available at `http://localhost:5173` (or as specified by Vite)

## Usage

1. **Allow Camera Access**: Grant webcam permissions when prompted
2. **Select Glasses Style**: Choose from available glasses options using the UI controls
3. **Try On**: The selected glasses will be rendered in real-time on your face
4. **Adjust**: The application automatically tracks your face and adjusts glasses position

## Project Structure

```
glasses_tryon/
├── src/
│   ├── App.tsx           # Main application component with face detection logic
│   ├── Scene.tsx         # Three.js scene rendering component
│   ├── config.ts         # Configuration for glasses models and camera settings
│   ├── App.css           # Component styles
│   ├── index.css         # Global styles
│   ├── main.tsx          # Application entry point
│   └── assets/           # Static assets
├── public/
│   ├── face_landmarker.task  # MediaPipe face landmarker model
│   ├── env.hdr              # HDR environment map
│   └── wasm/                # WebAssembly modules for MediaPipe
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies and scripts
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint checks
- `pnpm preview` - Preview production build locally

## Key Dependencies

- **@mediapipe/tasks-vision** - Face landmark detection
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for React Three Fiber
- **@tensorflow/tfjs-node** - TensorFlow.js with Node.js support
- **tailwindcss** - Utility-first CSS framework

## Browser Compatibility

This application requires:
- WebGL support
- WebRTC for webcam access
- Browser that supports ES modules

Tested on:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 15+

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source. See LICENSE file for more details.

## Troubleshooting

### Camera Not Working
- Ensure you've granted camera permissions to the browser
- Check that no other application is using the webcam

### Face Not Detected
- Ensure adequate lighting in the environment
- Position your face clearly in front of the camera
- Make sure the face is fully visible in the frame

### Performance Issues
- Close other browser tabs to free up resources
- Reduce the browser window size
- Try a different browser if issues persist

## Future Enhancements

- Support for more glasses styles
- Face detail improvements
- Mobile device support
- Glasses customization options
- Export/share functionality