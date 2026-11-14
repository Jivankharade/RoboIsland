"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('buddyApi', {
    inspect: (point) => electron_1.ipcRenderer.invoke('buddy:inspect', point),
    speak: (text) => electron_1.ipcRenderer.send('buddy:speak', text),
    flyHome: () => electron_1.ipcRenderer.send('buddy:fly-home'),
    onState: (callback) => {
        electron_1.ipcRenderer.on('buddy:state', (_e, data) => callback(data));
    }
});
