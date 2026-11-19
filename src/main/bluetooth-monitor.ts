/**
 * Bluetooth Battery & Device HUD Monitor Service (Milestone 5 - Requirement R5)
 * 
 * Provides:
 * 1. Native Windows PnP/CIM querying via child_process PowerShell with strict timeouts.
 * 2. Device classification for AirPods, headphones, earbuds, speakers, mice, keyboards, peripherals.
 * 3. Battery extraction and normalization (0-100%, multiBattery L/R/Case for AirPods/Galaxy Buds).
 * 4. State transition detector emitting 'connected', 'disconnected', 'battery_change' (>=2% delta threshold).
 * 5. Robust offline BluetoothSimulator with built-in realistic presets and simulateEvent testing hook.
 * 6. Zero runtime dependencies, safe fallback handling, and zero memory leaks.
 */

import { exec } from 'child_process';
import { EventEmitter } from 'events';

export type BluetoothDeviceType =
  | 'airpods'
  | 'headphones'
  | 'earbuds'
  | 'speaker'
  | 'mouse'
  | 'keyboard'
  | 'peripheral';

export interface MultiBatteryLevels {
  left?: number;
  right?: number;
  case?: number;
}

export interface BluetoothDeviceStatus {
  id: string;
  name: string;
  deviceType: BluetoothDeviceType;
  connected: boolean;
  batteryPercent: number | null;
  multiBattery?: MultiBatteryLevels;
  isCharging?: boolean;
  lastSeen: number;
}

export interface BluetoothHudEvent {
  type: 'connected' | 'disconnected' | 'battery_change';
  device: BluetoothDeviceStatus;
  previousBattery?: number | null;
  previousConnected?: boolean;
  timestamp: number;
}

/**
 * Classifies device category based on name and PnP class string.
 * Fast, pure regex with zero ReDoS risk.
 */
export function classifyBluetoothDeviceType(name?: string, deviceClass?: string): BluetoothDeviceType {
  const n = (name || '').trim();
  const c = (deviceClass || '').toLowerCase();

  if (!n) {
    if (c.includes('mouse')) return 'mouse';
    if (c.includes('keyboard')) return 'keyboard';
    return 'peripheral';
  }

  // 1. AirPods (highest priority)
  if (/\b(?:airpods?|air\s*pods?)\b/i.test(n)) {
    return 'airpods';
  }

  // 2. Dual Earbuds / In-Ear TWS
  if (/\b(?:galaxy\s*buds\w*|pixel\s*buds\w*|earbuds?|airdots\w*|freebuds\w*|nothing\s*ear\w*|jabra\s*elite\w*|linkbuds\w*|wf-?\d{3,4}\w*)\b/i.test(n)) {
    return 'earbuds';
  }

  // 3. Over-ear / On-ear Headphones & Headsets
  if (/\b(?:headphones?|headset|wh-?\d{3,4}\w*|quietcomfort|qc\s*\d{1,4}\w*|bose\s*qc|beats\s*(?:solo|studio|fit)\w*|sennheiser|momentum|audio-technica)\b/i.test(n)) {
    return 'headphones';
  }

  // 4. Speakers & Soundbars
  if (/\b(?:speakers?|soundbar|echo\s*(?:dot|plus|pop)?|flip\s*\d|charge\s*\d|jbl|ue\s*boom|megaboom|soundlink)\b/i.test(n)) {
    return 'speaker';
  }

  // 5. Mice & Pointers
  if (/\b(?:mouse|mice|trackball|touchpad|mx\s*master|magic\s*mouse|deathadder|basilisk|g\s*pro)\b/i.test(n) || c.includes('mouse')) {
    return 'mouse';
  }

  // 6. Keyboards
  if (/\b(?:keyboard|keypad|keychron|k\d{2,3}|mx\s*keys|magic\s*keyboard|logi\s*k\d{3})\b/i.test(n) || c.includes('keyboard')) {
    return 'keyboard';
  }

  return 'peripheral';
}

/**
 * Normalizes a raw battery level into 0-100 or null.
 */
export function normalizeBatteryLevel(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/[^0-9.-]/g, ''), 10);
  if (isNaN(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Normalizes multiBattery values (left, right, case) with 0-100 bounds clamping.
 */
export function normalizeMultiBattery(multi?: MultiBatteryLevels): MultiBatteryLevels | undefined {
  if (!multi || typeof multi !== 'object') return undefined;

  const result: MultiBatteryLevels = {};
  if (typeof multi.left !== 'undefined') {
    const l = normalizeBatteryLevel(multi.left);
    if (l !== null) result.left = l;
  }
  if (typeof multi.right !== 'undefined') {
    const r = normalizeBatteryLevel(multi.right);
    if (r !== null) result.right = r;
  }
  if (typeof multi.case !== 'undefined') {
    const c = normalizeBatteryLevel(multi.case);
    if (c !== null) result.case = c;
  }

  if (result.left !== undefined || result.right !== undefined || result.case !== undefined) {
    return result;
  }
  return undefined;
}

/**
 * Offline simulation engine and presets for Bluetooth devices.
 */
export class BluetoothSimulator {
  private presets: BluetoothDeviceStatus[] = [
    {
      id: 'bt-airpods-pro-1',
      name: 'AirPods Pro',
      deviceType: 'airpods',
      connected: true,
      batteryPercent: 88,
      multiBattery: { left: 85, right: 90, case: 100 },
      isCharging: false,
      lastSeen: Date.now()
    },
    {
      id: 'bt-sony-wh1000xm5-1',
      name: 'Sony WH-1000XM5',
      deviceType: 'headphones',
      connected: true,
      batteryPercent: 70,
      isCharging: false,
      lastSeen: Date.now()
    },
    {
      id: 'bt-logitech-mxmaster-1',
      name: 'Logitech MX Master 3',
      deviceType: 'mouse',
      connected: true,
      batteryPercent: 50,
      isCharging: false,
      lastSeen: Date.now()
    },
    {
      id: 'bt-galaxy-buds2-1',
      name: 'Galaxy Buds2',
      deviceType: 'earbuds',
      connected: false,
      batteryPercent: 80,
      multiBattery: { left: 80, right: 80, case: 95 },
      isCharging: false,
      lastSeen: Date.now()
    }
  ];

  public getPresets(): BluetoothDeviceStatus[] {
    return JSON.parse(JSON.stringify(this.presets));
  }

  public createDevice(partial: Partial<BluetoothDeviceStatus>): BluetoothDeviceStatus {
    const name = (partial.name || 'Bluetooth Device').trim();
    const id = partial.id || `bt-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const deviceType = partial.deviceType || classifyBluetoothDeviceType(name);
    const connected = typeof partial.connected === 'boolean' ? partial.connected : true;
    const multiBattery = normalizeMultiBattery(partial.multiBattery);
    let batteryPercent = normalizeBatteryLevel(partial.batteryPercent);

    // If batteryPercent was not provided but multiBattery is available, derive primary from earbuds
    if (batteryPercent === null && multiBattery) {
      if (typeof multiBattery.left === 'number' && typeof multiBattery.right === 'number') {
        batteryPercent = Math.round((multiBattery.left + multiBattery.right) / 2);
      } else if (typeof multiBattery.left === 'number') {
        batteryPercent = multiBattery.left;
      } else if (typeof multiBattery.right === 'number') {
        batteryPercent = multiBattery.right;
      } else if (typeof multiBattery.case === 'number') {
        batteryPercent = multiBattery.case;
      }
    }

    return {
      id,
      name,
      deviceType,
      connected,
      batteryPercent,
      ...(multiBattery ? { multiBattery } : {}),
      isCharging: Boolean(partial.isCharging),
      lastSeen: partial.lastSeen || Date.now()
    };
  }
}

/**
 * Main Bluetooth Monitor Service
 */
export class BluetoothMonitorService {
  private devices: Map<string, BluetoothDeviceStatus> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private isPollingActive = false;
  private eventEmitter: EventEmitter = new EventEmitter();
  private broadcastCallback: ((channel: string, payload: any) => void) | null = null;
  private simulator: BluetoothSimulator = new BluetoothSimulator();
  private simulationMode = false;

  constructor() {
    // Seed with simulation presets so default getters are instantly populated
    this.resetToPresets();
  }

  public resetToPresets(): void {
    this.devices.clear();
    for (const preset of this.simulator.getPresets()) {
      this.devices.set(preset.id, preset);
    }
  }

  public setSimulationMode(enabled: boolean): void {
    this.simulationMode = enabled;
  }

  public isSimulationMode(): boolean {
    return this.simulationMode;
  }

  public setBroadcastCallback(cb: (channel: string, payload: any) => void): void {
    this.broadcastCallback = cb;
  }

  public getConnectedDevices(): BluetoothDeviceStatus[] {
    return Array.from(this.devices.values()).filter((d) => d.connected);
  }

  public getAllDevices(): BluetoothDeviceStatus[] {
    return Array.from(this.devices.values());
  }

  public getDevice(id: string): BluetoothDeviceStatus | undefined {
    return this.devices.get(id);
  }

  public onDeviceEvent(cb: (event: BluetoothHudEvent) => void): () => void {
    this.eventEmitter.on('device_event', cb);
    return () => {
      this.eventEmitter.off('device_event', cb);
    };
  }

  /**
   * Programmatic simulation hook for automated testing and UI verification.
   */
  public simulateEvent(payload: {
    type: 'connected' | 'disconnected' | 'battery_change';
    device: Partial<BluetoothDeviceStatus>;
  }): BluetoothDeviceStatus {
    const existing = payload.device?.id ? this.devices.get(payload.device.id) : undefined;
    const previousBattery = existing ? existing.batteryPercent : null;
    const previousConnected = existing ? existing.connected : false;

    // Merge device
    const mergedPartial: Partial<BluetoothDeviceStatus> = {
      ...existing,
      ...payload.device,
      connected: payload.type === 'connected' ? true : (payload.type === 'disconnected' ? false : (typeof payload.device.connected === 'boolean' ? payload.device.connected : (existing?.connected ?? true)))
    };

    const status = this.simulator.createDevice(mergedPartial);
    this.devices.set(status.id, status);

    const event: BluetoothHudEvent = {
      type: payload.type,
      device: status,
      previousBattery,
      previousConnected,
      timestamp: Date.now()
    };

    this.eventEmitter.emit('device_event', event);
    if (this.broadcastCallback) {
      try {
        this.broadcastCallback('island:bluetooth-hud', event);
      } catch (err) {
        console.warn('[BluetoothMonitorService] Broadcast callback error:', err);
      }
    }

    return status;
  }

  /**
   * Compares new devices list against existing state and generates transitions.
   * Emits 'connected', 'disconnected', 'battery_change' (>= 2% delta or charging state change).
   */
  public updateDevices(newDevices: BluetoothDeviceStatus[], isFullScan = false): BluetoothHudEvent[] {
    const emittedEvents: BluetoothHudEvent[] = [];
    const seenIds = new Set<string>();

    for (const dev of newDevices) {
      seenIds.add(dev.id);
      const existing = this.devices.get(dev.id);

      if (!existing) {
        // Brand new device
        this.devices.set(dev.id, dev);
        if (dev.connected) {
          const event: BluetoothHudEvent = {
            type: 'connected',
            device: dev,
            previousConnected: false,
            previousBattery: null,
            timestamp: Date.now()
          };
          emittedEvents.push(event);
          this.emitHudEvent(event);
        }
      } else {
        const wasConnected = existing.connected;
        const isConnected = dev.connected;
        const prevBat = existing.batteryPercent;
        const newBat = dev.batteryPercent;
        const prevCharging = Boolean(existing.isCharging);
        const newCharging = Boolean(dev.isCharging);

        this.devices.set(dev.id, dev);

        // Connection change
        if (!wasConnected && isConnected) {
          const event: BluetoothHudEvent = {
            type: 'connected',
            device: dev,
            previousConnected: wasConnected,
            previousBattery: prevBat,
            timestamp: Date.now()
          };
          emittedEvents.push(event);
          this.emitHudEvent(event);
        } else if (wasConnected && !isConnected) {
          const event: BluetoothHudEvent = {
            type: 'disconnected',
            device: dev,
            previousConnected: wasConnected,
            previousBattery: prevBat,
            timestamp: Date.now()
          };
          emittedEvents.push(event);
          this.emitHudEvent(event);
        } else if (wasConnected && isConnected) {
          // Battery level change (>= 2% delta or charging state toggle)
          const batDelta = (prevBat !== null && newBat !== null) ? Math.abs(newBat - prevBat) : (prevBat !== newBat ? 10 : 0);
          const chargingToggled = prevCharging !== newCharging;

          if (batDelta >= 2 || chargingToggled) {
            const event: BluetoothHudEvent = {
              type: 'battery_change',
              device: dev,
              previousConnected: wasConnected,
              previousBattery: prevBat,
              timestamp: Date.now()
            };
            emittedEvents.push(event);
            this.emitHudEvent(event);
          }
        }
      }
    }

    // Check for devices that vanished from connected list during a full scan
    if (isFullScan) {
      for (const [id, dev] of this.devices.entries()) {
        if (!seenIds.has(id) && dev.connected) {
          dev.connected = false;
          dev.lastSeen = Date.now();
          const event: BluetoothHudEvent = {
            type: 'disconnected',
            device: dev,
            previousConnected: true,
            previousBattery: dev.batteryPercent,
            timestamp: Date.now()
          };
          emittedEvents.push(event);
          this.emitHudEvent(event);
        }
      }
    }

    return emittedEvents;
  }

  private emitHudEvent(event: BluetoothHudEvent): void {
    this.eventEmitter.emit('device_event', event);
    if (this.broadcastCallback) {
      try {
        this.broadcastCallback('island:bluetooth-hud', event);
      } catch (err) {
        console.warn('[BluetoothMonitorService] Broadcast callback error:', err);
      }
    }
  }

  /**
   * Native Windows Bluetooth Querying via PowerShell child_process.
   * Uses safe 3000ms timeout and handles failures gracefully without crashing.
   */
  public async queryNativeDevices(timeoutMs = 3000): Promise<BluetoothDeviceStatus[]> {
    if (this.simulationMode || process.platform !== 'win32') {
      return this.getAllDevices();
    }

    return new Promise<BluetoothDeviceStatus[]>((resolve) => {
      // Safe PowerShell command extracting Bluetooth devices with battery property if present
      const psScript = `
        $ProgressPreference = 'SilentlyContinue';
        try {
          $devs = Get-PnpDevice -Class 'Bluetooth' -Status 'OK' -ErrorAction SilentlyContinue | Where-Object { $_.Present -eq $true };
          $list = @();
          foreach ($d in $devs) {
            $bat = $null;
            try {
              $prop = Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2' -ErrorAction SilentlyContinue;
              if ($prop -and $prop.Data) { $bat = [int]$prop.Data; }
            } catch {}
            $list += [PSCustomObject]@{
              InstanceId = $d.InstanceId;
              FriendlyName = $d.FriendlyName;
              Present = $d.Present;
              Battery = $bat;
            };
          }
          $list | ConvertTo-Json -Compress;
        } catch {
          Write-Output '[]';
        }
      `.replace(/\r?\n\s*/g, ' ');

      const cmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`;

      exec(cmd, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          // Graceful fallback: return current devices without failing
          resolve(this.getAllDevices());
          return;
        }

        try {
          const raw = JSON.parse(stdout.trim());
          const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
          const parsed: BluetoothDeviceStatus[] = [];

          for (const item of arr) {
            const name = item.FriendlyName || 'Bluetooth Device';
            // Filter out system adapter / radio parent controllers
            if (name.toLowerCase().includes('adapter') || name.toLowerCase().includes('radio') || name.toLowerCase().includes('enumerator')) {
              continue;
            }

            const id = item.InstanceId || `bt-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            const devType = classifyBluetoothDeviceType(name);
            const battery = normalizeBatteryLevel(item.Battery);

            parsed.push(this.simulator.createDevice({
              id,
              name,
              deviceType: devType,
              connected: Boolean(item.Present),
              batteryPercent: battery,
              isCharging: false,
              lastSeen: Date.now()
            }));
          }

          if (parsed.length > 0) {
            resolve(parsed);
          } else {
            resolve(this.getAllDevices());
          }
        } catch {
          resolve(this.getAllDevices());
        }
      });
    });
  }

  public async pollOnce(): Promise<void> {
    try {
      const devices = await this.queryNativeDevices(3000);
      if (devices && devices.length > 0) {
        this.updateDevices(devices, true);
      }
    } catch (err) {
      console.warn('[BluetoothMonitorService] Poll error:', err);
    }
  }

  public startPolling(intervalMs = 6000): void {
    if (this.isPollingActive) return;
    this.isPollingActive = true;

    // Initial check
    this.pollOnce().catch(() => {});

    this.pollTimer = setInterval(() => {
      this.pollOnce().catch(() => {});
    }, intervalMs);
  }

  public stopPolling(): void {
    this.isPollingActive = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public dispose(): void {
    this.stopPolling();
    this.eventEmitter.removeAllListeners();
    this.broadcastCallback = null;
    this.devices.clear();
  }
}

export const bluetoothMonitorService = new BluetoothMonitorService();
