"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IconGenerator = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class IconGenerator {
    static getTrayIcon() {
        // Try loading pre-built icon image and resize to 16x16 for Windows taskbar tray
        const candidates = [
            path.join(__dirname, '../../assets/icon.png'),
            path.join(__dirname, '../assets/icon.png'),
            path.join(__dirname, 'assets/icon.png'),
            path.join(electron_1.app.getAppPath(), 'assets/icon.png'),
            path.join(process.resourcesPath, 'app.asar/assets/icon.png'),
            path.join(process.resourcesPath, 'assets/icon.png')
        ];
        for (const p of candidates) {
            try {
                if (fs.existsSync(p)) {
                    const img = electron_1.nativeImage.createFromPath(p);
                    if (!img.isEmpty()) {
                        return img.resize({ width: 16, height: 16 });
                    }
                }
            }
            catch { }
        }
        // Fallback: 32x32 RGBA buffer representing a sleek robot face with glowing cyan eyes
        const width = 32;
        const height = 32;
        const buffer = Buffer.alloc(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const offset = (y * width + x) * 4;
                // Outer rounded helmet bounds: (x: 4..27, y: 6..26)
                const inHead = x >= 4 && x <= 27 && y >= 6 && y <= 26;
                const isCorner = (x === 4 || x === 27) && (y === 6 || y === 26);
                // Antenna on top: (x: 15..16, y: 2..5)
                const isAntenna = (x === 15 || x === 16) && y >= 2 && y <= 5;
                const isAntennaTip = (x >= 14 && x <= 17) && y === 2;
                // Eyes: left eye (x: 9..12, y: 12..17), right eye (x: 19..22, y: 12..17)
                const isLeftEye = x >= 9 && x <= 12 && y >= 13 && y <= 17;
                const isRightEye = x >= 19 && x <= 22 && y >= 13 && y <= 17;
                // Smile: (x: 13..18, y: 21..22)
                const isSmile = x >= 13 && x <= 18 && y === 22;
                if (isLeftEye || isRightEye) {
                    // Glowing vibrant cyan eye (#00ffff)
                    buffer[offset] = 0; // R
                    buffer[offset + 1] = 240; // G
                    buffer[offset + 2] = 255; // B
                    buffer[offset + 3] = 255; // A
                }
                else if (isAntenna || isAntennaTip) {
                    // Bright cyan accent
                    buffer[offset] = 0;
                    buffer[offset + 1] = 200;
                    buffer[offset + 2] = 255;
                    buffer[offset + 3] = 255;
                }
                else if (isSmile) {
                    // Dim white smile
                    buffer[offset] = 200;
                    buffer[offset + 1] = 220;
                    buffer[offset + 2] = 240;
                    buffer[offset + 3] = 220;
                }
                else if (inHead && !isCorner) {
                    // Deep dark titanium grey helmet (#16181e)
                    buffer[offset] = 22;
                    buffer[offset + 1] = 24;
                    buffer[offset + 2] = 30;
                    buffer[offset + 3] = 255;
                }
                else {
                    // Transparent
                    buffer[offset] = 0;
                    buffer[offset + 1] = 0;
                    buffer[offset + 2] = 0;
                    buffer[offset + 3] = 0;
                }
            }
        }
        return electron_1.nativeImage.createFromBitmap(buffer, { width, height });
    }
}
exports.IconGenerator = IconGenerator;
