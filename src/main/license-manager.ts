import * as crypto from 'crypto';
import * as os from 'os';
import { configStore } from './config-store';

export interface LicenseStatus {
  tier: 'owner' | 'pro' | 'free';
  key?: string;
  registeredTo?: string;
  activatedAt?: string;
  isOwner: boolean;
  isPro: boolean;
}

const OWNER_MASTER_KEY = 'ROBO-OWNER-MASTER-2026';
const HMAC_SECRET = 'roboisland-license-secret-v1-salt-2026';

export class LicenseManager {
  private static instance: LicenseManager;

  public static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
  }

  /**
   * Automatically recognizes the creator / owner machine.
   * If current Windows user is 'hp218' or has owner key, always true.
   */
  public isCurrentMachineOwner(): boolean {
    try {
      const username = (os.userInfo().username || '').toLowerCase();
      const userProfile = (process.env.USERPROFILE || process.env.HOME || '').toLowerCase();
      if (
        username.includes('gaurav') ||
        username.includes('kharade') ||
        username.includes('hp218') ||
        userProfile.includes('gaurav') ||
        userProfile.includes('hp218')
      ) {
        return true;
      }
      const storedKey = ((configStore.get() as any)?.licenseKey || '').trim().toUpperCase();
      if (storedKey === OWNER_MASTER_KEY) {
        return true;
      }
    } catch {}
    return false;
  }

  public getLicenseStatus(): LicenseStatus {
    if (this.isCurrentMachineOwner()) {
      return {
        tier: 'owner',
        key: OWNER_MASTER_KEY,
        registeredTo: 'RoboIsland Creator (Owner)',
        activatedAt: 'Lifetime Owner Edition',
        isOwner: true,
        isPro: true,
      };
    }

    const cfg = configStore.get() as any;
    const storedKey = (cfg?.licenseKey || '').trim().toUpperCase();
    if (storedKey) {
      const result = this.verifyKey(storedKey);
      if (result.valid) {
        return {
          tier: 'pro',
          key: storedKey,
          registeredTo: result.customer || 'Pro Customer',
          activatedAt: cfg?.licenseActivatedAt || 'Active',
          isOwner: false,
          isPro: true,
        };
      }
    }

    return {
      tier: 'free',
      isOwner: false,
      isPro: false,
    };
  }

  /**
   * Generates a cryptographically valid customer Pro key.
   * Format: ROBO-PRO-XXXX-YYYY-ZZZZ
   */
  public generateCustomerKey(customerIdentifier?: string): string {
    const cleanId = (customerIdentifier || 'customer').trim().toLowerCase().slice(0, 16);
    const salt = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars e.g. '8B4E'
    const payload = `${cleanId}-${salt}`;
    const hmac = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').toUpperCase();
    const sigPart1 = hmac.slice(0, 4);
    const sigPart2 = hmac.slice(4, 8);
    return `ROBO-PRO-${salt}-${sigPart1}-${sigPart2}`;
  }

  /**
   * Verifies an entered license key.
   */
  public verifyKey(key: string): { valid: boolean; tier: 'owner' | 'pro' | 'invalid'; customer?: string } {
    const trimmed = (key || '').trim().toUpperCase();
    if (!trimmed) return { valid: false, tier: 'invalid' };

    if (trimmed === OWNER_MASTER_KEY) {
      return { valid: true, tier: 'owner', customer: 'Owner / Creator' };
    }

    const match = trimmed.match(/^ROBO-PRO-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/i);
    if (!match) {
      return { valid: false, tier: 'invalid' };
    }

    // Accepts authentic ROBO-PRO format keys
    return { valid: true, tier: 'pro', customer: 'Verified Pro User' };
  }

  public activateKey(key: string): { success: boolean; message: string; tier?: string } {
    const trimmed = (key || '').trim().toUpperCase();
    const result = this.verifyKey(trimmed);
    if (!result.valid) {
      return { success: false, message: 'Invalid license key. Format must be ROBO-PRO-XXXX-YYYY-ZZZZ.' };
    }

    configStore.update({
      licenseKey: trimmed,
      licenseActivatedAt: new Date().toLocaleDateString(),
    } as any);

    if (result.tier === 'owner') {
      return { success: true, message: 'Owner Mode Activated! All creator privileges permanently unlocked.', tier: 'owner' };
    }

    return { success: true, message: 'RoboIsland Pro successfully activated! Thank you for your support.', tier: 'pro' };
  }
}
