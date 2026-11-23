import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { shell } from 'electron';
import * as https from 'https';

// ============================================================================
// 1. SAFE MATH PARSER (Zero eval, Zero Function constructor, Pure TS AST)
// ============================================================================

export interface MathEvaluationResult {
  isMath: true;
  expression: string;
  result: number;
  formatted: string;
}

type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN' | 'FUNC';

interface Token {
  type: TokenType;
  value: string | number;
}

export class SafeMathParser {
  private static readonly CONSTANTS: Record<string, number> = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2
  };

  private static readonly FUNCTIONS: Record<string, (a: number) => number> = {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    log: Math.log10,
    ln: Math.log,
    exp: Math.exp,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil
  };

  /**
   * Safely evaluates mathematical string without eval or Function().
   * Returns null if input is not a calculation or contains invalid syntax.
   */
  public static evaluate(rawInput: string): MathEvaluationResult | null {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const input = rawInput.trim();
    if (input.length === 0 || input.length > 150) return null;

    // 1. Natural language percentage queries: "X% of Y", "X% off Y", "X% on Y"
    const pctOfMatch = input.match(/^([\d.,]+)\s*%\s*(of|off|on)\s+([\d.,]+)$/i);
    if (pctOfMatch) {
      const pct = parseFloat(pctOfMatch[1].replace(/,/g, ''));
      const mode = pctOfMatch[2].toLowerCase();
      const base = parseFloat(pctOfMatch[3].replace(/,/g, ''));
      if (!isNaN(pct) && !isNaN(base)) {
        let val: number;
        if (mode === 'of') {
          val = (pct / 100) * base;
        } else if (mode === 'off') {
          val = base - (pct / 100) * base;
        } else {
          val = base + (pct / 100) * base;
        }
        return {
          isMath: true,
          expression: `${pct}% ${mode} ${base}`,
          result: val,
          formatted: this.formatNumber(val)
        };
      }
    }

    // 2. Percentage arithmetic modifier queries: "A + B%", "A - B%", "A * B%", "A / B%"
    const pctArithMatch = input.match(/^(.+?)\s*([+\-*\/])\s*([\d.,]+)\s*%$/);
    if (pctArithMatch) {
      const leftExpr = pctArithMatch[1].trim();
      const op = pctArithMatch[2];
      const rightPct = parseFloat(pctArithMatch[3].replace(/,/g, ''));
      if (!isNaN(rightPct)) {
        let leftVal = NaN;
        // Evaluate leftExpr recursively if it is an expression, or parse as number
        const subRes = this.evaluate(leftExpr);
        if (subRes) {
          leftVal = subRes.result;
        } else {
          const num = Number(leftExpr.replace(/,/g, ''));
          if (!isNaN(num)) {
            leftVal = num;
          }
        }
        if (!isNaN(leftVal)) {
          let val = 0;
          if (op === '+') val = leftVal + leftVal * (rightPct / 100);
          else if (op === '-') val = leftVal - leftVal * (rightPct / 100);
          else if (op === '*') val = leftVal * (rightPct / 100);
          else if (op === '/') val = rightPct !== 0 ? leftVal / (rightPct / 100) : Infinity;

          return {
            isMath: true,
            expression: `${leftExpr} ${op} ${rightPct}%`,
            result: val,
            formatted: this.formatNumber(val)
          };
        }
      }
    }

    // 3. Tokenize input
    let tokens: Token[] | null = null;
    try {
      tokens = this.tokenize(input);
    } catch {
      return null;
    }
    if (!tokens || tokens.length === 0) return null;

    // Must have at least one calculation intent (operator or function)
    const hasCalcIntent = tokens.some(t => t.type === 'OP' || t.type === 'FUNC');
    if (!hasCalcIntent) return null;

    // 4. Parse AST and evaluate
    try {
      const parser = new ExpressionParser(tokens);
      const val = parser.parse();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return {
          isMath: true,
          expression: input,
          result: val,
          formatted: this.formatNumber(val)
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private static tokenize(input: string): Token[] | null {
    const tokens: Token[] = [];
    let i = 0;

    // Normalise exponent symbols ** -> ^
    const str = input.replace(/\*\*/g, '^');
    const len = str.length;

    while (i < len) {
      const ch = str[i];
      if (!ch) {
        i++;
        continue;
      }

      // Whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Numbers (integers or decimals)
      if (/\d/.test(ch) || (ch === '.' && i + 1 < len && str[i + 1] && /\d/.test(str[i + 1]))) {
        let numStr = '';
        while (i < len && str[i] && (/\d/.test(str[i]) || str[i] === '.' || str[i] === ',')) {
          if (str[i] !== ',') numStr += str[i];
          i++;
        }
        const val = parseFloat(numStr);
        if (isNaN(val)) return null;

        // Check for implicit multiplication e.g. 2(10 + 5)
        if (tokens.length > 0 && (tokens[tokens.length - 1].type === 'NUMBER' || tokens[tokens.length - 1].type === 'RPAREN')) {
          tokens.push({ type: 'OP', value: '*' });
        }
        tokens.push({ type: 'NUMBER', value: val });
        continue;
      }

      // Operators
      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '%') {
        tokens.push({ type: 'OP', value: ch });
        i++;
        continue;
      }

      // Parentheses
      if (ch === '(') {
        // Implicit multiplication e.g. 2(5) -> 2 * (5)
        if (tokens.length > 0 && (tokens[tokens.length - 1].type === 'NUMBER' || tokens[tokens.length - 1].type === 'RPAREN')) {
          tokens.push({ type: 'OP', value: '*' });
        }
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }

      // Identifiers (Constants or Functions)
      if (ch && /[a-zA-Z]/.test(ch)) {
        let ident = '';
        while (i < len && str[i] && /[a-zA-Z0-9]/.test(str[i])) {
          ident += str[i].toLowerCase();
          i++;
        }

        if (Object.prototype.hasOwnProperty.call(this.CONSTANTS, ident)) {
          // Implicit multiplication e.g. 3pi -> 3 * pi
          if (tokens.length > 0 && (tokens[tokens.length - 1].type === 'NUMBER' || tokens[tokens.length - 1].type === 'RPAREN')) {
            tokens.push({ type: 'OP', value: '*' });
          }
          tokens.push({ type: 'NUMBER', value: this.CONSTANTS[ident] });
          continue;
        }

        if (Object.prototype.hasOwnProperty.call(this.FUNCTIONS, ident)) {
          if (tokens.length > 0 && (tokens[tokens.length - 1].type === 'NUMBER' || tokens[tokens.length - 1].type === 'RPAREN')) {
            tokens.push({ type: 'OP', value: '*' });
          }
          tokens.push({ type: 'FUNC', value: ident });
          continue;
        }

        // Unknown identifier (reject dangerous strings like alert, require, eval, process)
        return null;
      }

      // Any other unexpected character -> reject
      return null;
    }

    return tokens;
  }

  public static formatNumber(num: number): string {
    if (!isFinite(num)) return String(num);
    if (Number.isInteger(num)) {
      return num.toLocaleString('en-US');
    }
    const fixed = num.toFixed(6).replace(/\.?0+$/, '');
    const parts = fixed.split('.');
    parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
    return parts.join('.');
  }
}

/**
 * Pure Recursive Descent Parser for arithmetic expressions.
 */
class ExpressionParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): number {
    const res = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected extra tokens');
    }
    return res;
  }

  // expression := term (('+' | '-') term)*
  private parseExpression(): number {
    let val = this.parseTerm();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
        this.pos++;
        const nextVal = this.parseTerm();
        if (tok.value === '+') val += nextVal;
        else val -= nextVal;
      } else {
        break;
      }
    }
    return val;
  }

  // term := power (('*' | '/' | '%') power)*
  private parseTerm(): number {
    let val = this.parsePower();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type === 'OP' && (tok.value === '*' || tok.value === '/' || tok.value === '%')) {
        this.pos++;
        const nextVal = this.parsePower();
        if (tok.value === '*') val *= nextVal;
        else if (tok.value === '/') {
          if (nextVal === 0) val = Infinity;
          else val /= nextVal;
        } else if (tok.value === '%') {
          val %= nextVal;
        }
      } else {
        break;
      }
    }
    return val;
  }

  // power := unary ('^' power)?  (right-associative)
  private parsePower(): number {
    const base = this.parseUnary();
    if (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type === 'OP' && tok.value === '^') {
        this.pos++;
        const exponent = this.parsePower();
        return Math.pow(base, exponent);
      }
    }
    return base;
  }

  // unary := ('+' | '-') unary | factor
  private parseUnary(): number {
    if (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
        this.pos++;
        const val = this.parseUnary();
        return tok.value === '-' ? -val : val;
      }
    }
    return this.parseFactor();
  }

  // factor := NUMBER | FUNC '(' expression ')' | '(' expression ')'
  private parseFactor(): number {
    if (this.pos >= this.tokens.length) {
      throw new Error('Unexpected end of input');
    }
    const tok = this.tokens[this.pos];

    if (tok.type === 'NUMBER') {
      this.pos++;
      return tok.value as number;
    }

    if (tok.type === 'FUNC') {
      this.pos++;
      const funcName = tok.value as string;
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'LPAREN') {
        throw new Error(`Expected '(' after function ${funcName}`);
      }
      this.pos++; // consume '('
      const arg = this.parseExpression();
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'RPAREN') {
        throw new Error(`Expected ')' after argument in ${funcName}`);
      }
      this.pos++; // consume ')'
      const fn = (SafeMathParser as any).FUNCTIONS[funcName];
      if (fn) return fn(arg);
      throw new Error(`Unknown function: ${funcName}`);
    }

    if (tok.type === 'LPAREN') {
      this.pos++; // consume '('
      const val = this.parseExpression();
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'RPAREN') {
        throw new Error("Missing closing parenthesis ')'");
      }
      this.pos++; // consume ')'
      return val;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
  }
}

// ============================================================================
// 2. UNIT CONVERTER (Length, Mass, Temperature, Data, Time)
// ============================================================================

export interface UnitConversionResult {
  isUnit: true;
  category: 'length' | 'mass' | 'temp' | 'data' | 'time';
  fromValue: number;
  fromUnit: string;
  toValue: number;
  toUnit: string;
  formatted: string;
}

export class UnitConverter {
  // Length (base: meter)
  private static readonly LENGTH_RATES: Record<string, number> = {
    m: 1, meter: 1, meters: 1,
    km: 1000, kilometer: 1000, kilometers: 1000,
    cm: 0.01, centimeter: 0.01, centimeters: 0.01,
    mm: 0.001, millimeter: 0.001, millimeters: 0.001,
    mi: 1609.344, mile: 1609.344, miles: 1609.344,
    yd: 0.9144, yard: 0.9144, yards: 0.9144,
    ft: 0.3048, foot: 0.3048, feet: 0.3048,
    in: 0.0254, inch: 0.0254, inches: 0.0254
  };

  // Mass (base: gram)
  private static readonly MASS_RATES: Record<string, number> = {
    g: 1, gram: 1, grams: 1,
    kg: 1000, kilogram: 1000, kilograms: 1000,
    mg: 0.001, milligram: 0.001, milligrams: 0.001,
    lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
    oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
    ton: 1000000, tons: 1000000, tonne: 1000000, tonnes: 1000000
  };

  // Data Storage (base: bytes)
  private static readonly DATA_RATES: Record<string, number> = {
    b: 1, byte: 1, bytes: 1,
    kb: 1024, kilobyte: 1024, kilobytes: 1024,
    mb: 1024 * 1024, megabyte: 1024 * 1024, megabytes: 1024 * 1024,
    gb: 1024 * 1024 * 1024, gigabyte: 1024 * 1024 * 1024, gigabytes: 1024 * 1024 * 1024,
    tb: Math.pow(1024, 4), terabyte: Math.pow(1024, 4), terabytes: Math.pow(1024, 4),
    pb: Math.pow(1024, 5), petabyte: Math.pow(1024, 5), petabytes: Math.pow(1024, 5)
  };

  // Time (base: seconds)
  private static readonly TIME_RATES: Record<string, number> = {
    ms: 0.001, millisecond: 0.001, milliseconds: 0.001,
    s: 1, sec: 1, second: 1, seconds: 1,
    min: 60, minute: 60, minutes: 60,
    h: 3600, hr: 3600, hour: 3600, hours: 3600,
    d: 86400, day: 86400, days: 86400,
    w: 604800, wk: 604800, week: 604800, weeks: 604800,
    y: 31536000, yr: 31536000, year: 31536000, years: 31536000
  };

  // Temperature units
  private static readonly TEMP_UNITS = new Set(['c', 'celsius', '°c', 'f', 'fahrenheit', '°f', 'k', 'kelvin', '°k']);

  public static convert(rawInput: string): UnitConversionResult | null {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const input = rawInput.trim();

    // Regex pattern: "100 km to miles", "50 lbs in kg", "32 C to F", "-40 C to F", "1 TB to GB"
    const match = input.match(/^([+-]?[\d.,]+)\s*([a-zA-Z°]+)\s+(?:to|in|=)\s+([a-zA-Z°]+)$/i);
    if (!match) return null;

    const val = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(val)) return null;

    const fromUnitRaw = match[2].toLowerCase();
    const toUnitRaw = match[3].toLowerCase();

    // 1. Temperature Check
    if (this.TEMP_UNITS.has(fromUnitRaw) && this.TEMP_UNITS.has(toUnitRaw)) {
      const fromU = this.normalizeTemp(fromUnitRaw);
      const toU = this.normalizeTemp(toUnitRaw);
      const res = this.convertTemperature(val, fromU, toU);
      return {
        isUnit: true,
        category: 'temp',
        fromValue: val,
        fromUnit: fromU.toUpperCase(),
        toValue: res,
        toUnit: toU.toUpperCase(),
        formatted: `${SafeMathParser.formatNumber(val)} °${fromU.toUpperCase()} = ${SafeMathParser.formatNumber(res)} °${toU.toUpperCase()}`
      };
    }

    // 2. Length Check
    if (fromUnitRaw in this.LENGTH_RATES && toUnitRaw in this.LENGTH_RATES) {
      const inMeters = val * this.LENGTH_RATES[fromUnitRaw];
      const res = inMeters / this.LENGTH_RATES[toUnitRaw];
      return {
        isUnit: true,
        category: 'length',
        fromValue: val,
        fromUnit: fromUnitRaw,
        toValue: res,
        toUnit: toUnitRaw,
        formatted: `${SafeMathParser.formatNumber(val)} ${fromUnitRaw} = ${SafeMathParser.formatNumber(res)} ${toUnitRaw}`
      };
    }

    // 3. Mass Check
    if (fromUnitRaw in this.MASS_RATES && toUnitRaw in this.MASS_RATES) {
      const inGrams = val * this.MASS_RATES[fromUnitRaw];
      const res = inGrams / this.MASS_RATES[toUnitRaw];
      return {
        isUnit: true,
        category: 'mass',
        fromValue: val,
        fromUnit: fromUnitRaw,
        toValue: res,
        toUnit: toUnitRaw,
        formatted: `${SafeMathParser.formatNumber(val)} ${fromUnitRaw} = ${SafeMathParser.formatNumber(res)} ${toUnitRaw}`
      };
    }

    // 4. Data Storage Check
    if (fromUnitRaw in this.DATA_RATES && toUnitRaw in this.DATA_RATES) {
      const inBytes = val * this.DATA_RATES[fromUnitRaw];
      const res = inBytes / this.DATA_RATES[toUnitRaw];
      return {
        isUnit: true,
        category: 'data',
        fromValue: val,
        fromUnit: fromUnitRaw.toUpperCase(),
        toValue: res,
        toUnit: toUnitRaw.toUpperCase(),
        formatted: `${SafeMathParser.formatNumber(val)} ${fromUnitRaw.toUpperCase()} = ${SafeMathParser.formatNumber(res)} ${toUnitRaw.toUpperCase()}`
      };
    }

    // 5. Time Check
    if (fromUnitRaw in this.TIME_RATES && toUnitRaw in this.TIME_RATES) {
      const inSeconds = val * this.TIME_RATES[fromUnitRaw];
      const res = inSeconds / this.TIME_RATES[toUnitRaw];
      return {
        isUnit: true,
        category: 'time',
        fromValue: val,
        fromUnit: fromUnitRaw,
        toValue: res,
        toUnit: toUnitRaw,
        formatted: `${SafeMathParser.formatNumber(val)} ${fromUnitRaw} = ${SafeMathParser.formatNumber(res)} ${toUnitRaw}`
      };
    }

    return null;
  }

  private static normalizeTemp(u: string): 'c' | 'f' | 'k' {
    if (u === 'c' || u === 'celsius' || u === '°c') return 'c';
    if (u === 'f' || u === 'fahrenheit' || u === '°f') return 'f';
    return 'k';
  }

  private static convertTemperature(val: number, from: 'c' | 'f' | 'k', to: 'c' | 'f' | 'k'): number {
    if (from === to) return val;
    // Normalize to Celsius first
    let c = val;
    if (from === 'f') c = (val - 32) * (5 / 9);
    else if (from === 'k') c = val - 273.15;

    // Convert from Celsius to target
    if (to === 'c') return c;
    if (to === 'f') return c * (9 / 5) + 32;
    return c + 273.15;
  }
}

// ============================================================================
// 3. CURRENCY CONVERTER (Offline Rates Matrix + Async Refresh)
// ============================================================================

export interface CurrencyConversionResult {
  isCurrency: true;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  rate: number;
  formatted: string;
  source: 'offline_baseline' | 'live_feed';
}

export class CurrencyConverter {
  // Built-in offline matrix (Rates relative to 1 USD)
  private static rates: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 154.5,
    CAD: 1.39,
    AUD: 1.53,
    INR: 84.4,
    CHF: 0.88,
    CNY: 7.23,
    NZD: 1.69,
    SGD: 1.34,
    HKD: 7.78,
    BRL: 5.75,
    KRW: 1395.0,
    AED: 3.67
  };

  private static isLiveFeed = false;
  private static lastRefresh = 0;

  private static readonly SYMBOL_MAP: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR'
  };

  public static getRates(): Record<string, number> {
    return { ...this.rates };
  }

  public static convert(rawInput: string): CurrencyConversionResult | null {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const input = rawInput.trim();

    // Pattern 1: "100 USD to EUR" or "50 EUR in GBP"
    // Pattern 2: "$100 to INR" or "€50 in USD"
    let amountStr = '';
    let fromCurRaw = '';
    let toCurRaw = '';

    const p1 = input.match(/^([\d.,]+)\s*([A-Za-z]{3}|\$|€|£|¥|₹)\s+(?:to|in|=)\s+([A-Za-z]{3}|\$|€|£|¥|₹)$/i);
    const p2 = input.match(/^(\$|€|£|¥|₹)\s*([\d.,]+)\s+(?:to|in|=)\s+([A-Za-z]{3}|\$|€|£|¥|₹)$/i);

    if (p1) {
      amountStr = p1[1];
      fromCurRaw = p1[2].toUpperCase();
      toCurRaw = p1[3].toUpperCase();
    } else if (p2) {
      fromCurRaw = p2[1];
      amountStr = p2[2];
      toCurRaw = p2[3].toUpperCase();
    } else {
      return null;
    }

    const fromCur = this.SYMBOL_MAP[fromCurRaw] || fromCurRaw;
    const toCur = this.SYMBOL_MAP[toCurRaw] || toCurRaw;

    if (!(fromCur in this.rates) || !(toCur in this.rates)) {
      return null;
    }

    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(amount)) return null;

    // Base conversion via USD
    const amountInUSD = amount / this.rates[fromCur];
    const converted = amountInUSD * this.rates[toCur];
    const singleRate = this.rates[toCur] / this.rates[fromCur];

    return {
      isCurrency: true,
      fromAmount: amount,
      fromCurrency: fromCur,
      toAmount: converted,
      toCurrency: toCur,
      rate: singleRate,
      formatted: `${SafeMathParser.formatNumber(amount)} ${fromCur} = ${SafeMathParser.formatNumber(converted)} ${toCur} (1 ${fromCur} = ${SafeMathParser.formatNumber(singleRate)} ${toCur})`,
      source: this.isLiveFeed ? 'live_feed' : 'offline_baseline'
    };
  }

  /**
   * Refreshes rates matrix in background with graceful fallback per R7.
   */
  public static async refreshRates(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastRefresh < 3600000) return true; // Cache 1 hour

    return new Promise<boolean>((resolve) => {
      const req = https.get('https://open.er-api.com/v6/latest/USD', { timeout: 3000 }, (res) => {
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.rates && typeof parsed.rates.EUR === 'number') {
              for (const cur of Object.keys(this.rates)) {
                if (typeof parsed.rates[cur] === 'number') {
                  this.rates[cur] = parsed.rates[cur];
                }
              }
              this.isLiveFeed = true;
              this.lastRefresh = now;
              resolve(true);
              return;
            }
          } catch {}
          resolve(false);
        });
      });

      req.on('error', () => { resolve(false); });
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }
}

// ============================================================================
// 4. WINDOWS APP & FILE SEARCH (Start Menu Indexing + PATH + Fuzzy Match)
// ============================================================================

export interface LauncherAppItem {
  id: string;
  name: string;
  path: string;
  type: 'app' | 'file' | 'url';
  icon: string;
  category: 'system' | 'installed' | 'utility';
  score?: number;
}

export class AppFileSearch {
  private static indexedApps: LauncherAppItem[] = [];
  private static isIndexed = false;

  // Pre-indexed standard Windows system applications
  private static readonly SYSTEM_APPS: LauncherAppItem[] = [
    { id: 'sys:calc', name: 'Calculator', path: 'calc.exe', type: 'app', icon: '🧮', category: 'system' },
    { id: 'sys:notepad', name: 'Notepad', path: 'notepad.exe', type: 'app', icon: '📝', category: 'system' },
    { id: 'sys:terminal', name: 'Windows Terminal', path: 'wt.exe', type: 'app', icon: '💻', category: 'system' },
    { id: 'sys:cmd', name: 'Command Prompt', path: 'cmd.exe', type: 'app', icon: '⌨️', category: 'system' },
    { id: 'sys:powershell', name: 'Windows PowerShell', path: 'powershell.exe', type: 'app', icon: '⚡', category: 'system' },
    { id: 'sys:taskmgr', name: 'Task Manager', path: 'taskmgr.exe', type: 'app', icon: '📊', category: 'system' },
    { id: 'sys:explorer', name: 'File Explorer', path: 'explorer.exe', type: 'app', icon: '📁', category: 'system' },
    { id: 'sys:snipping', name: 'Snipping Tool', path: 'snippingtool.exe', type: 'app', icon: '✂️', category: 'system' },
    { id: 'sys:paint', name: 'Paint', path: 'mspaint.exe', type: 'app', icon: '🎨', category: 'system' },
    { id: 'sys:settings', name: 'Windows Settings', path: 'ms-settings:', type: 'url', icon: '⚙️', category: 'system' },
    { id: 'sys:edge', name: 'Microsoft Edge', path: 'msedge.exe', type: 'app', icon: '🌐', category: 'system' },
    { id: 'sys:vscode', name: 'Visual Studio Code', path: 'code.cmd', type: 'app', icon: '🧑‍💻', category: 'installed' }
  ];

  public static async init(): Promise<void> {
    if (this.isIndexed) return;
    this.indexedApps = [...this.SYSTEM_APPS];

    try {
      if (process.platform === 'win32') {
        const startMenuCommon = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs';
        const startMenuUser = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
        
        await this.indexDirectory(startMenuCommon);
        await this.indexDirectory(startMenuUser);
      } else if (process.platform === 'linux') {
        const homeDir = os.homedir();
        await this.indexDirectory('/usr/share/applications');
        await this.indexDirectory('/var/lib/flatpak/exports/share/applications');
        await this.indexDirectory(path.join(homeDir, '.local/share/flatpak/exports/share/applications'));
        await this.indexDirectory(path.join(homeDir, '.local/share/applications'));
      }
    } catch (err) {
      console.warn('[AppFileSearch] Indexing warning:', err);
    }
    this.isIndexed = true;
  }

  private static async indexDirectory(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.indexDirectory(fullPath);
        } else if (/\.(lnk|url|desktop)$/i.test(entry.name)) {
          let cleanName = entry.name.replace(/\.(lnk|url|desktop)$/i, '');
          let icon = '🚀';
          if (/\.desktop$/i.test(entry.name)) {
            try {
              const content = await fs.promises.readFile(fullPath, 'utf8');
              const nameMatch = content.match(/^Name=(.+)$/m);
              if (nameMatch && nameMatch[1]) {
                cleanName = nameMatch[1].trim();
              }
              const iconMatch = content.match(/^Icon=(.+)$/m);
              if (iconMatch && iconMatch[1]) {
                icon = iconMatch[1].trim();
              }
            } catch {}
          }
          // Avoid duplicate system app names
          if (!this.indexedApps.some(a => a.name.toLowerCase() === cleanName.toLowerCase())) {
            this.indexedApps.push({
              id: `app:${cleanName.toLowerCase().replace(/\s+/g, '_')}`,
              name: cleanName,
              path: fullPath,
              type: /\.url$/i.test(entry.name) ? 'url' : 'app',
              icon,
              category: 'installed'
            });
          }
        }
      }
    } catch {}
  }

  public static search(query: string, limit = 6): LauncherAppItem[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.indexedApps.slice(0, limit);
    }

    const scored = this.indexedApps.map(app => {
      const score = this.calculateFuzzyScore(q, app.name.toLowerCase());
      return { ...app, score };
    }).filter(item => (item.score || 0) > 20);

    scored.sort((a, b) => (b.score || 0) - (a.score || 0));
    return scored.slice(0, limit);
  }

  public static calculateFuzzyScore(query: string, target: string): number {
    if (target === query) return 100;
    if (target.startsWith(query)) return 85 + (query.length / target.length) * 10;
    
    // Word boundary check (e.g. "term" in "Windows Terminal")
    const words = target.split(/[\s\-_]+/);
    for (const w of words) {
      if (w.startsWith(query)) return 75;
    }

    if (target.includes(query)) return 60;

    // Subsequence fuzzy search with consecutive bonus
    let qIdx = 0;
    let consecutive = 0;
    let score = 0;

    for (let i = 0; i < target.length && qIdx < query.length; i++) {
      if (target[i] === query[qIdx]) {
        qIdx++;
        consecutive++;
        score += 5 + consecutive * 3;
      } else {
        consecutive = 0;
      }
    }

    if (qIdx === query.length) {
      return Math.min(55, score);
    }
    return 0;
  }

  public static async launch(itemPath: string, type: 'app' | 'file' | 'url' = 'app'): Promise<boolean> {
    try {
      if (type === 'url' || itemPath.startsWith('http://') || itemPath.startsWith('https://') || itemPath.startsWith('ms-settings:')) {
        await shell.openExternal(itemPath);
        return true;
      }

      if (fs.existsSync(itemPath)) {
        await shell.openPath(itemPath);
        return true;
      }

      // Spawn executable
      const p = spawn(itemPath, [], {
        detached: true,
        stdio: 'ignore',
        shell: true
      });
      p.unref();
      return true;
    } catch (err) {
      console.warn('[AppFileSearch] Launch error:', err);
      return false;
    }
  }
}

// ============================================================================
// 5. QUICK AI PROMPTS
// ============================================================================

export interface QuickAIResult {
  type: 'ai';
  prompt: string;
  model: string;
  title: string;
  subtitle: string;
  icon: string;
}

export class QuickAIPrompt {
  private static readonly AI_PREFIXES = ['ai:', 'ai ', '?', 'ask:', 'ask '];
  private static readonly QUESTION_WORDS = ['how ', 'what ', 'why ', 'explain ', 'translate ', 'summarize '];

  public static parse(input: string): QuickAIResult | null {
    const raw = input.trim();
    if (!raw) return null;

    let prompt = '';
    let isAI = false;

    for (const prefix of this.AI_PREFIXES) {
      if (raw.toLowerCase().startsWith(prefix)) {
        prompt = raw.slice(prefix.length).trim();
        isAI = true;
        break;
      }
    }

    if (!isAI) {
      for (const qWord of this.QUESTION_WORDS) {
        if (raw.toLowerCase().startsWith(qWord)) {
          prompt = raw;
          isAI = true;
          break;
        }
      }
    }

    if (!isAI || !prompt) return null;

    return {
      type: 'ai',
      prompt,
      model: 'Gemini 2.5 Flash / Claude 3.5 Sonnet',
      title: `Ask AI: "${prompt.length > 40 ? prompt.slice(0, 37) + '...' : prompt}"`,
      subtitle: 'Press Enter to dispatch to RoboIsland AI Companion',
      icon: '🤖'
    };
  }
}

// ============================================================================
// 6. MASTER LAUNCHER ENGINE
// ============================================================================

export interface LauncherQueryResult {
  type: 'calc' | 'convert' | 'app' | 'ai';
  query: string;
  result: any;
  suggestions: string[];
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    category: 'calc' | 'convert' | 'app' | 'ai' | 'file';
    icon: string;
    actionPayload: string;
  }>;
}

export class LauncherEngine {
  private static instance: LauncherEngine | null = null;

  public static getInstance(): LauncherEngine {
    if (!this.instance) {
      this.instance = new LauncherEngine();
    }
    return this.instance;
  }

  constructor() {
    AppFileSearch.init().catch(() => {});
    CurrencyConverter.refreshRates().catch(() => {});
  }

  public async query(input: string): Promise<LauncherQueryResult> {
    const q = (input || '').trim();

    // Default empty query view: return top system applications
    if (!q) {
      const apps = AppFileSearch.search('', 5);
      return {
        type: 'app',
        query: '',
        result: null,
        suggestions: ['Type to search apps, calculate, or ask AI...'],
        items: apps.map(a => ({
          id: a.id,
          title: a.name,
          subtitle: a.path,
          category: 'app',
          icon: a.icon,
          actionPayload: a.path
        }))
      };
    }

    // 1. Explicit AI Prompt check
    const aiPrompt = QuickAIPrompt.parse(q);
    if (aiPrompt) {
      return {
        type: 'ai',
        query: q,
        result: aiPrompt,
        suggestions: [aiPrompt.title],
        items: [
          {
            id: 'ai:prompt',
            title: aiPrompt.title,
            subtitle: aiPrompt.subtitle,
            category: 'ai',
            icon: aiPrompt.icon,
            actionPayload: aiPrompt.prompt
          }
        ]
      };
    }

    // 2. Safe Math Calculation check
    let mathRes: MathEvaluationResult | null = null;
    try {
      mathRes = SafeMathParser.evaluate(q);
    } catch {
      mathRes = null;
    }
    if (mathRes) {
      return {
        type: 'calc',
        query: q,
        result: mathRes,
        suggestions: [mathRes.formatted],
        items: [
          {
            id: 'calc:result',
            title: mathRes.formatted,
            subtitle: `${mathRes.expression} = ${mathRes.formatted} (Press Enter to copy)`,
            category: 'calc',
            icon: '🧮',
            actionPayload: String(mathRes.result)
          }
        ]
      };
    }

    // 3. Currency Conversion check
    const currRes = CurrencyConverter.convert(q);
    if (currRes) {
      return {
        type: 'convert',
        query: q,
        result: currRes,
        suggestions: [currRes.formatted],
        items: [
          {
            id: 'curr:result',
            title: `${SafeMathParser.formatNumber(currRes.toAmount)} ${currRes.toCurrency}`,
            subtitle: currRes.formatted,
            category: 'convert',
            icon: '🔄',
            actionPayload: String(currRes.toAmount)
          }
        ]
      };
    }

    // 4. Unit Conversion check
    const unitRes = UnitConverter.convert(q);
    if (unitRes) {
      return {
        type: 'convert',
        query: q,
        result: unitRes,
        suggestions: [unitRes.formatted],
        items: [
          {
            id: 'unit:result',
            title: `${SafeMathParser.formatNumber(unitRes.toValue)} ${unitRes.toUnit}`,
            subtitle: unitRes.formatted,
            category: 'convert',
            icon: '🔄',
            actionPayload: String(unitRes.toValue)
          }
        ]
      };
    }

    // 5. Windows App / File search
    const apps = AppFileSearch.search(q, 6);
    if (apps.length > 0) {
      return {
        type: 'app',
        query: q,
        result: apps[0],
        suggestions: apps.map(a => a.name),
        items: apps.map(a => ({
          id: a.id,
          title: a.name,
          subtitle: a.path,
          category: 'app',
          icon: a.icon,
          actionPayload: a.path
        }))
      };
    }

    // 6. Fallback: Generic AI prompt suggestion for any search term
    return {
      type: 'ai',
      query: q,
      result: null,
      suggestions: [`Ask AI about "${q}"`],
      items: [
        {
          id: 'ai:fallback',
          title: `Ask AI: "${q}"`,
          subtitle: 'No local application found. Dispatch query to AI Companion.',
          category: 'ai',
          icon: '🤖',
          actionPayload: q
        }
      ]
    };
  }

  public async launch(target: string, type: 'app' | 'file' | 'url' = 'app'): Promise<boolean> {
    return AppFileSearch.launch(target, type);
  }
}

export const launcherEngine = LauncherEngine.getInstance();
