const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('[TEST] Starting RoboIsland Pro & Owner License Verification...\n');

// 1. Zero-Emoji Compliance
const licenseFiles = [
  'src/main/license-manager.ts',
  'src/preload/settings-preload.ts',
  'src/renderer/settings/settings.html',
  'src/renderer/settings/settings.css',
  'src/renderer/settings/settings-ui.ts'
];

const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

for (const rel of licenseFiles) {
  const full = path.join(__dirname, '..', rel);
  const content = fs.readFileSync(full, 'utf8');
  assert(!emojiRegex.test(content), `Found forbidden emoji in ${rel}`);
}
console.log('  OK: Zero-Emoji Compliance across all license and monetization files');

// 2. LicenseManager Logic Tests
const { LicenseManager } = require('../dist/main/license-manager');
const mgr = LicenseManager.getInstance();

// A. Owner Detection
const isOwner = mgr.isCurrentMachineOwner();
console.log(`  OK: Owner detection active on this PC (isOwner = ${isOwner})`);
assert(typeof isOwner === 'boolean', 'isOwner must return a boolean');

// B. License Status Structure
const status = mgr.getLicenseStatus();
assert(status.tier, 'LicenseStatus must have a tier');
assert(typeof status.isOwner === 'boolean', 'status.isOwner must be boolean');
assert(typeof status.isPro === 'boolean', 'status.isPro must be boolean');
console.log(`  OK: License status verified (Tier: ${status.tier}, Registered: ${status.registeredTo || 'Free'})`);

// C. Customer Key Generation & Verification
const testCustomer = 'customer@example.com';
const genKey = mgr.generateCustomerKey(testCustomer);
assert(genKey.startsWith('ROBO-PRO-'), 'Generated key must start with ROBO-PRO-');
assert(/^ROBO-PRO-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(genKey), 'Generated key must match ROBO-PRO-XXXX-YYYY-ZZZZ format');
console.log(`  OK: Generated genuine customer key: ${genKey}`);

// D. Validation of genuine key
const verifyResult = mgr.verifyKey(genKey);
assert(verifyResult.valid === true, 'Generated key must verify as valid');
assert(verifyResult.tier === 'pro', 'Customer key must have tier pro');

// E. Master Owner Key validation
const ownerVerify = mgr.verifyKey('ROBO-OWNER-MASTER-2026');
assert(ownerVerify.valid === true, 'Master key must verify as valid');
assert(ownerVerify.tier === 'owner', 'Master key must have tier owner');

// F. Rejection of invalid keys
assert(mgr.verifyKey('INVALID-KEY-1234').valid === false, 'Invalid format key must be rejected');
assert(mgr.verifyKey('ROBO-PRO-ZZZZ-ZZZZ-ZZZZ').valid === false, 'Malformed hex key must be rejected');
console.log('  OK: Key verification accurately validates genuine keys and rejects forged keys');

// 3. Settings UI Elements Check
const htmlContent = fs.readFileSync(path.join(__dirname, '../src/renderer/settings/settings.html'), 'utf8');
assert(htmlContent.includes('id="pane-license"'), 'settings.html must contain pane-license');
assert(htmlContent.includes('id="license-owner-view"'), 'settings.html must contain license-owner-view');
assert(htmlContent.includes('id="license-customer-view"'), 'settings.html must contain license-customer-view');
assert(htmlContent.includes('id="btn-generate-customer-key"'), 'settings.html must contain btn-generate-customer-key');
assert(htmlContent.includes('id="btn-activate-key"'), 'settings.html must contain btn-activate-key');
console.log('  OK: settings.html contains Owner & Pro monetization UI panels');

// 4. Preload API Check
const preloadContent = fs.readFileSync(path.join(__dirname, '../src/preload/settings-preload.ts'), 'utf8');
assert(preloadContent.includes('getLicenseStatus:'), 'settings-preload must expose getLicenseStatus');
assert(preloadContent.includes('activateLicense:'), 'settings-preload must expose activateLicense');
assert(preloadContent.includes('generateCustomerKey:'), 'settings-preload must expose generateCustomerKey');
console.log('  OK: settings-preload exposes license and key generator bridges');

console.log('\nAll RoboIsland Pro & Owner License tests PASSED!\n');
