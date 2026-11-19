/**
 * Adversarial Stress Test & Edge-Case Harness for Milestone 2 (R2: Spotlight Launcher)
 * Evaluates: SafeMathParser, UnitConverter, CurrencyConverter, AppFileSearch, QuickAIPrompt, LauncherEngine
 */

const fs = require('fs');
const path = require('path');

const launcherEnginePath = path.join(__dirname, '../dist/main/launcher-engine.js');
if (!fs.existsSync(launcherEnginePath)) {
  console.error('[FAIL] launcher-engine.js does not exist in dist/main! Run npm run build first.');
  process.exit(1);
}

const {
  SafeMathParser,
  UnitConverter,
  CurrencyConverter,
  AppFileSearch,
  QuickAIPrompt,
  LauncherEngine,
  launcherEngine
} = require(launcherEnginePath);

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const findings = [];

function check(title, condition, extraInfo = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${title}`);
  } else {
    failedAssertions++;
    const msg = `  [FAIL] ${title} ${extraInfo ? '-> ' + extraInfo : ''}`;
    console.error(msg);
    findings.push({ title, extraInfo });
  }
}

async function runAdversarialSuite() {
  console.log('====================================================');
  console.log('  M2 SPOTLIGHT LAUNCHER ADVERSARIAL STRESS SUITE    ');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: SAFEMATHPARSER ARITHMETIC, PRECEDENCE & PARENTHESES
  // --------------------------------------------------------------------------
  console.log('--- 1. SafeMathParser: Arithmetic, Precedence & Associativity ---');

  const r1 = SafeMathParser.evaluate('2 + 3 * 4');
  check('Operator precedence * over + (2 + 3 * 4 = 14)', r1 && r1.result === 14);

  const r2 = SafeMathParser.evaluate('10 - 4 / 2');
  check('Operator precedence / over - (10 - 4 / 2 = 8)', r2 && r2.result === 8);

  const r3 = SafeMathParser.evaluate('2^3 * 4');
  check('Operator precedence ^ over * (2^3 * 4 = 32)', r3 && r3.result === 32);

  const r4 = SafeMathParser.evaluate('2^(1 + 2)');
  check('Parentheses inside exponent (2^(1 + 2) = 8)', r4 && r4.result === 8);

  const r5 = SafeMathParser.evaluate('((2 + 3) * (4 + 5)) / (5 - 2)');
  check('Deeply nested balanced parentheses = 15', r5 && r5.result === 15);

  let r6 = null;
  let r6Error = null;
  try {
    r6 = SafeMathParser.evaluate('2 ** 8');
  } catch (err) {
    r6Error = err.message;
  }
  check('JavaScript ** operator mapped to ^ (2 ** 8 = 256)', !r6Error && r6 && r6.result === 256, r6Error || 'result mismatch');

  const r7 = SafeMathParser.evaluate('10 % 3');
  check('Modulo operator: 10 % 3 = 1', r7 && r7.result === 1);

  const r8 = SafeMathParser.evaluate('1,000,000 + 250,000');
  check('Commas in large numbers parsed correctly (1,250,000)', r8 && r8.result === 1250000);

  const r9 = SafeMathParser.evaluate('0.1 + 0.2');
  check('Floating point addition parsed cleanly', r9 && Math.abs(r9.result - 0.3) < 0.0001);


  // --------------------------------------------------------------------------
  // SECTION 2: SAFEMATHPARSER UNARY OPERATORS & NEGATIVE NUMBERS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. SafeMathParser: Unary Operators & Negative Numbers ---');

  const u1 = SafeMathParser.evaluate('-42 + 10');
  check('Leading negative number (-42 + 10 = -32)', u1 && u1.result === -32);

  const u2 = SafeMathParser.evaluate('5 * -10');
  check('Negative operand after multiplication (5 * -10 = -50)', u2 && u2.result === -50);

  const u3 = SafeMathParser.evaluate('5 - -10');
  check('Subtract negative number (5 - -10 = 15)', u3 && u3.result === 15);

  const u4 = SafeMathParser.evaluate('-5 * -10');
  check('Negative multiplied by negative (-5 * -10 = 50)', u4 && u4.result === 50);

  const u5 = SafeMathParser.evaluate('+10 + +20');
  check('Explicit unary plus (+10 + +20 = 30)', u5 && u5.result === 30);

  const u6 = SafeMathParser.evaluate('--10 + 5');
  check('Double unary negation (--10 + 5 = 15)', u6 && u6.result === 15);

  const u7 = SafeMathParser.evaluate('(-5)^2');
  check('Parenthesized negative squared ((-5)^2 = 25)', u7 && u7.result === 25);


  // --------------------------------------------------------------------------
  // SECTION 3: SAFEMATHPARSER DIVISION & MODULO BY ZERO / INFINITY / NAN
  // --------------------------------------------------------------------------
  console.log('\n--- 3. SafeMathParser: Division / Modulo by Zero ---');

  const z1 = SafeMathParser.evaluate('10 / 0');
  check('Division by zero returns null or handles gracefully (no unhandled throw)', z1 === null || !isFinite(z1.result));

  const z2 = SafeMathParser.evaluate('0 / 0');
  check('Zero divided by zero returns null or handles gracefully (no unhandled throw)', z2 === null || isNaN(z2.result));

  const z3 = SafeMathParser.evaluate('10 % 0');
  check('Modulo by zero returns null (no unhandled throw)', z3 === null);

  const z4 = SafeMathParser.evaluate('10 / (5 - 5)');
  check('Division by zero via arithmetic expression returns null or non-finite', z4 === null || !isFinite(z4.result));


  // --------------------------------------------------------------------------
  // SECTION 4: SAFEMATHPARSER PERCENTAGE CALCULATIONS & COMPOUND OPERANDS
  // --------------------------------------------------------------------------
  console.log('\n--- 4. SafeMathParser: Percentage Logic & Edge Cases ---');

  const p1 = SafeMathParser.evaluate('15% of 850');
  check('Percentage of: 15% of 850 = 127.5', p1 && Math.abs(p1.result - 127.5) < 0.001);

  const p2 = SafeMathParser.evaluate('25% off 200');
  check('Percentage off (discount): 25% off 200 = 150', p2 && Math.abs(p2.result - 150) < 0.001);

  const p3 = SafeMathParser.evaluate('10% on 200');
  check('Percentage on (markup): 10% on 200 = 220', p3 && Math.abs(p3.result - 220) < 0.001);

  const p4 = SafeMathParser.evaluate('100 + 15%');
  check('Percentage addition modifier: 100 + 15% = 115', p4 && Math.abs(p4.result - 115) < 0.001);

  const p5 = SafeMathParser.evaluate('200 - 25%');
  check('Percentage subtraction modifier: 200 - 25% = 150', p5 && Math.abs(p5.result - 150) < 0.001);

  const p6 = SafeMathParser.evaluate('50 * 10%');
  check('Percentage multiplication modifier: 50 * 10% = 5', p6 && Math.abs(p6.result - 5) < 0.001);

  const p7 = SafeMathParser.evaluate('100 / 10%');
  check('Percentage division modifier: 100 / 10% = 1000', p7 && Math.abs(p7.result - 1000) < 0.001);

  const p8 = SafeMathParser.evaluate('(10 + 20) + 10%');
  check('Parenthesized compound expression before %: (10 + 20) + 10% = 33', p8 && Math.abs(p8.result - 33) < 0.001);

  const p9 = SafeMathParser.evaluate('10 + 20 + 10%');
  // Document whether compound unparenthesized percentage parses full expression 30 + 10% = 33 or truncates to 10 + 10% = 11
  const p9Val = p9 ? p9.result : null;
  console.log(`    [OBSERVATION] "10 + 20 + 10%" evaluates to: ${p9Val} (expected 33 if compound, 11 if parseFloat stops at first space)`);


  // --------------------------------------------------------------------------
  // SECTION 5: SAFEMATHPARSER FUNCTIONS, CONSTANTS & IMPLICIT MULTIPLICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 5. SafeMathParser: Functions, Constants & Implicit Multiplication ---');

  const f1 = SafeMathParser.evaluate('sqrt(144)');
  check('sqrt(144) = 12', f1 && f1.result === 12);

  const f2 = SafeMathParser.evaluate('cbrt(27)');
  check('cbrt(27) = 3', f2 && f2.result === 3);

  const f3 = SafeMathParser.evaluate('abs(-99)');
  check('abs(-99) = 99', f3 && f3.result === 99);

  const f4 = SafeMathParser.evaluate('sin(0) + cos(0)');
  check('sin(0) + cos(0) = 1', f4 && f4.result === 1);

  const f5 = SafeMathParser.evaluate('log(100)');
  check('log10(100) = 2', f5 && Math.abs(f5.result - 2) < 0.0001);

  const f6 = SafeMathParser.evaluate('ln(e)');
  check('ln(e) = 1', f6 && Math.abs(f6.result - 1) < 0.0001);

  const f7 = SafeMathParser.evaluate('round(4.6) + floor(4.9) + ceil(4.1)');
  check('round(4.6) [5] + floor(4.9) [4] + ceil(4.1) [5] = 14', f7 && f7.result === 14);

  const f8 = SafeMathParser.evaluate('2(10 + 5)');
  check('Implicit multiplication: 2(10 + 5) = 30', f8 && f8.result === 30);

  const f9 = SafeMathParser.evaluate('3pi');
  check('Implicit multiplication with constant: 3pi approx 9.424778', f9 && Math.abs(f9.result - (3 * Math.PI)) < 0.001);

  const f10 = SafeMathParser.evaluate('(2)(3)(4)');
  check('Multiple implicit parentheses: (2)(3)(4) = 24', f10 && f10.result === 24);


  // --------------------------------------------------------------------------
  // SECTION 6: INJECTION, MALFORMED & ADVERSARIAL INPUT REJECTION
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Security: Injection & Malformed Expression Rejection ---');

  const injectionPayloads = [
    'process.exit(1)',
    'process.kill(0)',
    'alert(1)',
    '<script>alert(1)</script>',
    '__proto__',
    'constructor',
    'this.constructor',
    'window.location',
    'global.process',
    'require("child_process")',
    'import("fs")',
    'eval("2+2")',
    'Function("return 1")()',
    'Object.keys({})',
    'Math.pow(2, 8)',
    'Number.MAX_SAFE_INTEGER',
    'String.fromCharCode(65)',
    'document.cookie',
    'fetch("https://evil.com")'
  ];

  let anyInjectionLeaked = false;
  for (const payload of injectionPayloads) {
    const res = SafeMathParser.evaluate(payload);
    if (res !== null) {
      anyInjectionLeaked = true;
      console.error(`    [VULN] Injection payload "${payload}" evaluated to:`, res);
    }
  }
  check('SafeMathParser rejects all 19 code injection & prototype payloads', !anyInjectionLeaked);

  const malformedInputs = [
    '',
    '   ',
    '42',             // plain number without operator should be ignored
    '+',
    '++',
    '2 +',
    '5 *',
    '10 /',
    '()',
    '(10 + 2',
    '10 + 2)',
    ')(10 + 2)(',
    'sqrt()',
    'foo(10)',
    '2 @ 3',
    '2 $ 3',
    'a + b',
    'x * y',
    ' '.repeat(160)   // over 150 chars length
  ];

  let anyMalformedAccepted = false;
  for (const m of malformedInputs) {
    const res = SafeMathParser.evaluate(m);
    if (res !== null) {
      anyMalformedAccepted = true;
      console.error(`    [MALFORMED ACCEPTED] "${m}" evaluated to:`, res);
    }
  }
  check('SafeMathParser rejects all 19 malformed / non-calculation inputs', !anyMalformedAccepted);

  // Decimal edge case: multiple dots
  const multiDot = SafeMathParser.evaluate('5..5 + 2');
  console.log(`    [OBSERVATION] "5..5 + 2" evaluated to:`, multiDot ? multiDot.result : null);


  // --------------------------------------------------------------------------
  // SECTION 7: UNIT CONVERTER ADVERSARIAL STRESS & BOUNDARIES
  // --------------------------------------------------------------------------
  console.log('\n--- 7. UnitConverter: Conversions & Boundary Cases ---');

  // Length
  const l1 = UnitConverter.convert('1000 m to km');
  check('Length: 1000 m to km = 1', l1 && l1.toValue === 1);

  const l2 = UnitConverter.convert('1 mi to feet');
  check('Length: 1 mi to feet = 5280', l2 && Math.abs(l2.toValue - 5280) < 0.1);

  const l3 = UnitConverter.convert('100 cm in inches');
  check('Length: 100 cm in inches approx 39.37', l3 && Math.abs(l3.toValue - 39.37) < 0.01);

  // Mass
  const m1 = UnitConverter.convert('1 kg to grams');
  check('Mass: 1 kg to grams = 1000', m1 && m1.toValue === 1000);

  const m2 = UnitConverter.convert('16 oz to lbs');
  check('Mass: 16 oz to lbs approx 1', m2 && Math.abs(m2.toValue - 1) < 0.01);

  const m3 = UnitConverter.convert('1 ton to kg');
  check('Mass: 1 ton to kg = 1000', m3 && m3.toValue === 1000);

  // Temperature
  const t1 = UnitConverter.convert('0 C to F');
  check('Temperature: 0 C to F = 32', t1 && t1.toValue === 32);

  const t2 = UnitConverter.convert('100 C to F');
  check('Temperature: 100 C to F = 212', t2 && t2.toValue === 212);

  const t3 = UnitConverter.convert('0 K in C');
  check('Temperature: 0 K in C = -273.15', t3 && Math.abs(t3.toValue - (-273.15)) < 0.01);

  const t4 = UnitConverter.convert('212 F to C');
  check('Temperature: 212 F to C = 100', t4 && Math.abs(t4.toValue - 100) < 0.01);

  const tNeg = UnitConverter.convert('-40 C to F');
  console.log(`    [OBSERVATION] "-40 C to F" returns:`, tNeg ? tNeg.toValue : null, '(fails if regex only matches [\\d.,]+)');

  // Data Storage
  const d1 = UnitConverter.convert('1 GB to MB');
  check('Data: 1 GB to MB = 1024', d1 && d1.toValue === 1024);

  const d2 = UnitConverter.convert('1 TB to GB');
  check('Data: 1 TB to GB = 1024', d2 && d2.toValue === 1024);

  const d3 = UnitConverter.convert('1024 B in KB');
  check('Data: 1024 B in KB = 1', d3 && d3.toValue === 1);

  // Time
  const tm1 = UnitConverter.convert('60 s to minutes');
  check('Time: 60 s to minutes = 1', tm1 && tm1.toValue === 1);

  const tm2 = UnitConverter.convert('24 h to days');
  check('Time: 24 h to days = 1', tm2 && tm2.toValue === 1);

  const tm3 = UnitConverter.convert('7 d to weeks');
  check('Time: 7 d to weeks = 1', tm3 && tm3.toValue === 1);

  // Boundary & Cross-Category Rejections
  check('UnitConverter rejects cross-category: 5 km to kg', UnitConverter.convert('5 km to kg') === null);
  check('UnitConverter rejects cross-category: 100 C to meters', UnitConverter.convert('100 C to meters') === null);
  check('UnitConverter rejects cross-category: 1 TB to seconds', UnitConverter.convert('1 TB to seconds') === null);
  check('UnitConverter rejects unknown units: 10 bananas to apples', UnitConverter.convert('10 bananas to apples') === null);
  check('UnitConverter rejects empty input', UnitConverter.convert('') === null);


  // --------------------------------------------------------------------------
  // SECTION 8: CURRENCY CONVERTER RESILIENCE & OFFLINE MATRIX
  // --------------------------------------------------------------------------
  console.log('\n--- 8. CurrencyConverter: Matrix & Rates Edge Cases ---');

  const curRates = CurrencyConverter.getRates();
  const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'CHF', 'CNY', 'NZD', 'SGD', 'HKD', 'BRL', 'KRW', 'AED'];
  const allCurrenciesPresent = majorCurrencies.every(c => typeof curRates[c] === 'number' && curRates[c] > 0);
  check('CurrencyConverter contains all 15 major fiat currencies in offline matrix', allCurrenciesPresent);

  const c1 = CurrencyConverter.convert('100 USD to EUR');
  check('USD to EUR conversion calculates positive amount and rate', c1 && c1.toAmount > 0 && c1.rate > 0);

  const c2 = CurrencyConverter.convert('$100 to INR');
  check('Symbol syntax $100 to INR works', c2 && c2.fromCurrency === 'USD' && c2.toCurrency === 'INR' && c2.toAmount > 0);

  const c3 = CurrencyConverter.convert('€50 in GBP');
  check('Symbol syntax €50 in GBP works', c3 && c3.fromCurrency === 'EUR' && c3.toCurrency === 'GBP' && c3.toAmount > 0);

  const c4 = CurrencyConverter.convert('¥1000 in USD');
  check('Symbol syntax ¥1000 in USD works', c4 && c4.fromCurrency === 'JPY' && c4.toCurrency === 'USD' && c4.toAmount > 0);

  const c5 = CurrencyConverter.convert('₹8440 in USD');
  check('Symbol syntax ₹8440 in USD works', c5 && c5.fromCurrency === 'INR' && c5.toCurrency === 'USD' && Math.abs(c5.toAmount - 100) < 5);

  const c6 = CurrencyConverter.convert('0 USD to EUR');
  check('Zero amount currency conversion returns 0', c6 && c6.toAmount === 0);

  check('CurrencyConverter rejects unknown currency: 100 USD to XYZ', CurrencyConverter.convert('100 USD to XYZ') === null);
  check('CurrencyConverter rejects malformed string: USD to EUR', CurrencyConverter.convert('USD to EUR') === null);


  // --------------------------------------------------------------------------
  // SECTION 9: APPFILESEARCH FUZZY MATCHING, SPEED & PATHOLOGICAL INPUTS
  // --------------------------------------------------------------------------
  console.log('\n--- 9. AppFileSearch: Fuzzy Scoring & Throughput ---');

  await AppFileSearch.init();

  const emptySearch = AppFileSearch.search('');
  check('Empty search returns standard system apps', emptySearch.length >= 5);

  const calcSearch = AppFileSearch.search('calc');
  check('Query "calc" ranks Calculator at top', calcSearch.length > 0 && calcSearch[0].name.toLowerCase().includes('calc'));

  const noteSearch = AppFileSearch.search('note');
  check('Query "note" ranks Notepad at top', noteSearch.length > 0 && noteSearch[0].name.toLowerCase().includes('note'));

  const termSearch = AppFileSearch.search('term');
  check('Query "term" ranks Windows Terminal at top', termSearch.length > 0 && termSearch[0].name.toLowerCase().includes('terminal'));

  // Fuzzy algorithm checks
  const exactScore = AppFileSearch.calculateFuzzyScore('calculator', 'calculator');
  check('Exact match score is 100', exactScore === 100);

  const prefixScore = AppFileSearch.calculateFuzzyScore('calc', 'calculator');
  check('Prefix match score is >= 85', prefixScore >= 85);

  const wordBoundaryScore = AppFileSearch.calculateFuzzyScore('term', 'windows terminal');
  check('Word boundary match score is >= 75', wordBoundaryScore >= 75);

  const nonMatchScore = AppFileSearch.calculateFuzzyScore('xyz123', 'calculator');
  check('Non-match score is 0', nonMatchScore === 0);

  // Pathological inputs: regex characters and huge string
  const regexQuery = '.*+?^${}()|[]\\';
  const regexResults = AppFileSearch.search(regexQuery);
  check('AppFileSearch handles regex special characters without crashing', Array.isArray(regexResults));

  const hugeString = 'a'.repeat(5000);
  const hugeResults = AppFileSearch.search(hugeString);
  check('AppFileSearch handles 5000-char input without crashing or freezing', Array.isArray(hugeResults));

  // Throughput stress test: 1,000 rapid searches
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) {
    AppFileSearch.search('calc');
  }
  const searchElapsed = Date.now() - t0;
  check(`1,000 rapid searches complete in < 250ms (actual: ${searchElapsed}ms)`, searchElapsed < 250);


  // --------------------------------------------------------------------------
  // SECTION 10: QUICKAIPROMPT PREFIXES & ROUTING
  // --------------------------------------------------------------------------
  console.log('\n--- 10. QuickAIPrompt: Parsing & Prefix Routing ---');

  const ai1 = QuickAIPrompt.parse('ai: how to create electron window');
  check('ai: prefix parsed', ai1 && ai1.type === 'ai' && ai1.prompt === 'how to create electron window');

  const ai2 = QuickAIPrompt.parse('ai summarize this article');
  check('ai <space> prefix parsed', ai2 && ai2.type === 'ai' && ai2.prompt === 'summarize this article');

  const ai3 = QuickAIPrompt.parse('? best ways to optimize Windows 11');
  check('? prefix parsed', ai3 && ai3.type === 'ai' && ai3.prompt === 'best ways to optimize Windows 11');

  const ai4 = QuickAIPrompt.parse('ask: how does Runge Kutta work');
  check('ask: prefix parsed', ai4 && ai4.type === 'ai' && ai4.prompt === 'how does Runge Kutta work');

  const ai5 = QuickAIPrompt.parse('why is the sky blue');
  check('Question word "why" parsed', ai5 && ai5.type === 'ai' && ai5.prompt === 'why is the sky blue');

  const ai6 = QuickAIPrompt.parse('explain dynamic island physics');
  check('Question word "explain" parsed', ai6 && ai6.type === 'ai' && ai6.prompt === 'explain dynamic island physics');

  check('Non-AI query (app name) returns null', QuickAIPrompt.parse('notepad') === null);
  check('Non-AI query (calculation) returns null', QuickAIPrompt.parse('2 + 2') === null);
  check('Empty query returns null', QuickAIPrompt.parse('') === null);


  // --------------------------------------------------------------------------
  // SECTION 11: LAUNCHERENGINE DISPATCH ROUTING & THROUGHPUT
  // --------------------------------------------------------------------------
  console.log('\n--- 11. LauncherEngine: Master Query Routing & Throughput ---');

  const q1 = await launcherEngine.query('25 * 4');
  check('Routes arithmetic query to type "calc"', q1.type === 'calc' && q1.result.result === 100);

  const q2 = await launcherEngine.query('10 km to miles');
  check('Routes unit conversion query to type "convert"', q2.type === 'convert' && q2.result.isUnit);

  const q3 = await launcherEngine.query('100 USD to EUR');
  check('Routes currency query to type "convert"', q3.type === 'convert' && q3.result.isCurrency);

  const q4 = await launcherEngine.query('notepad');
  check('Routes app query to type "app"', q4.type === 'app' && q4.items.length > 0);

  const q5 = await launcherEngine.query('ai: write a haiku');
  check('Routes explicit AI query to type "ai"', q5.type === 'ai' && q5.result.type === 'ai');

  const q6 = await launcherEngine.query('random unknown unindexed search string xyz');
  check('Routes unindexed fallback search to type "ai"', q6.type === 'ai');

  // Throughput stress: 500 mixed queries
  const tStart = Date.now();
  const mixedQueries = [
    '2 + 2',
    '10 km to miles',
    '50 USD to INR',
    'notepad',
    'ai: test',
    'unknown query'
  ];
  for (let i = 0; i < 500; i++) {
    const qStr = mixedQueries[i % mixedQueries.length];
    await launcherEngine.query(qStr);
  }
  const totalThroughputTime = Date.now() - tStart;
  check(`500 mixed queries complete in < 500ms (actual: ${totalThroughputTime}ms)`, totalThroughputTime < 500);


  // --------------------------------------------------------------------------
  // SECTION 12: SECURITY AUDIT OF UI DOM INGESTION (XSS CHECK)
  // --------------------------------------------------------------------------
  console.log('\n--- 12. Security Audit: UI DOM XSS Verification ---');
  const canvasEngineSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');

  // Inspect setupSpotlightLauncherDOM and queryLauncher in canvas-engine.ts
  const hasRawInnerHTMLInList = canvasEngineSrc.includes('list.innerHTML = this.launcherItems.map((item, idx) => `') &&
    canvasEngineSrc.includes('${item.title}') &&
    !canvasEngineSrc.includes('${this.escapeHtml(item.title)}');

  if (hasRawInnerHTMLInList) {
    console.log('    [FINDING] list.innerHTML in canvas-engine.ts renders item.title/item.subtitle without escapeHtml.');
    console.log('    This allows unescaped HTML injection if query or AI title contains HTML tags.');
  }

  // Summary
  console.log('\n====================================================');
  console.log(`STRESS TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('====================================================\n');

  if (failedAssertions > 0) {
    console.error('FAILURES RECORDED:');
    findings.forEach(f => console.error(` - ${f.title}: ${f.extraInfo}`));
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('[FATAL] Stress test unhandled error:', err);
  process.exit(1);
});
