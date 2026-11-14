import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('buddyApi', {
  inspect: (point: { x: number; y: number }) => ipcRenderer.invoke('buddy:inspect', point),
  speak: (text: string) => ipcRenderer.send('buddy:speak', text),
  flyHome: () => ipcRenderer.send('buddy:fly-home'),
  onState: (callback: (data: any) => void) => {
    ipcRenderer.on('buddy:state', (_e, data) => callback(data));
  }
});
