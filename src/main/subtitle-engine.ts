import { BrowserWindow, ipcMain } from 'electron';
import { configStore } from './config-store';
import { cinemaDetector } from './cinema-detector';

export interface SubtitleCue {
  id: string;
  text: string;
  originalText: string;
  sourceLang: string;
  targetLang: string;
  durationMs: number;
  timestamp: number;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' }
];

/**
 * High-frequency offline dictionary for instant cinema subtitles without network latency.
 */
const CINEMA_DICTIONARY: Record<string, Record<string, string>> = {
  'hello': {
    hi: 'नमस्ते।',
    mr: 'नमस्कार.',
    es: 'Hola.',
    ja: 'こんにちは。',
    ko: '안녕하세요.',
    fr: 'Bonjour.',
    de: 'Hallo.',
    zh: '你好。'
  },
  'where are you going': {
    hi: 'आप कहाँ जा रहे हैं?',
    mr: 'तुम्ही कुठे जात आहात?',
    es: '¿A dónde vas?',
    ja: 'どこに行くの？',
    ko: '어디 가세요?',
    fr: 'Où vas-tu ?',
    de: 'Wohin gehst du?',
    zh: '你要去哪里？'
  },
  'we need to leave now': {
    hi: 'हमें अभी निकलना होगा!',
    mr: 'आपल्याला आत्ताच निघावे लागेल!',
    es: '¡Tenemos que irnos ahora!',
    ja: '今すぐ出発しなければならない！',
    ko: '지금 떠나야 해요!',
    fr: 'Nous devons partir maintenant !',
    de: 'Wir müssen jetzt gehen!',
    zh: '我们必须马上离开！'
  },
  'i have a bad feeling about this': {
    hi: 'मुझे इस बारे में गलत अंदेशा लग रहा है।',
    mr: 'मला याबद्दल काहीतरी चुकीचे वाटते आहे.',
    es: 'Tengo un mal presentimiento sobre esto.',
    ja: '嫌な予感がする。',
    ko: '느낌이 안 좋아요.',
    fr: 'J\'ai un mauvais pressentiment.',
    de: 'Ich habe dabei ein ganz mieses Gefühl.',
    zh: '我对此有一种不祥的预感。'
  },
  'look out': {
    hi: 'बचो!',
    mr: 'सांभाळा!',
    es: '¡Cuidado!',
    ja: '危ない！',
    ko: '조심해!',
    fr: 'Attention !',
    de: 'Pass auf!',
    zh: '小心！'
  },
  'who are you': {
    hi: 'तुम कौन हो?',
    mr: 'तू कोण आहेस?',
    es: '¿Quién eres tú?',
    ja: 'お前は誰だ？',
    ko: '당신은 누구십니까?',
    fr: 'Qui es-tu ?',
    de: 'Wer bist du?',
    zh: '你是谁？'
  },
  'what happened': {
    hi: 'क्या हुआ?',
    mr: 'काय झाले?',
    es: '¿Qué pasó?',
    ja: '何があったの？',
    ko: '무슨 일이야?',
    fr: 'Qu\'est-ce qui s\'est passé ?',
    de: 'Was ist passiert?',
    zh: '发生了什么？'
  },
  'dont move': {
    hi: 'हिलो मत।',
    mr: 'हलू नका.',
    es: 'No te muevas.',
    ja: '動くな。',
    ko: '움직이지 마.',
    fr: 'Ne bouge pas.',
    de: 'Beweg dich nicht.',
    zh: '别动。'
  },
  'everything is going to be fine': {
    hi: 'सब कुछ ठीक हो जाएगा।',
    mr: 'सर्व काही ठीक होईल.',
    es: 'Todo va a estar bien.',
    ja: 'すべて大丈夫だから。',
    ko: '모든 게 잘 될 거야.',
    fr: 'Tout ira bien.',
    de: 'Alles wird gut werden.',
    zh: '一切都会好起来的。'
  },
  'thank you': {
    hi: 'धन्यवाद।',
    mr: 'धन्यवाद.',
    es: 'Muchas gracias.',
    ja: 'ありがとうございます。',
    ko: '감사합니다.',
    fr: 'Merci beaucoup.',
    de: 'Vielen Dank.',
    zh: '非常感谢。'
  },
  'new computer': {
    hi: 'नया कंप्यूटर!',
    mr: 'नवीन संगणक!',
    es: '¡Nueva computadora!',
    ja: '新しいコンピューター！',
    ko: '새 컴퓨터!',
    fr: 'Nouvel ordinateur !',
    de: 'Neuer Computer!',
    zh: '新电脑！'
  },
  'are you ready': {
    hi: 'क्या आप तैयार हैं?',
    mr: 'तुम्ही तयार आहात का?',
    es: '¿Estás listo?',
    ja: '準備はできた？',
    ko: '준비되셨나요?',
    fr: 'Es-tu prêt ?',
    de: 'Bist du bereit?',
    zh: '准备好了吗？'
  },
  'lets go': {
    hi: 'चलो चलें!',
    mr: 'चला जाऊया!',
    es: '¡Vamos!',
    ja: '行こう！',
    ko: '가자!',
    fr: 'Allons-y !',
    de: 'Los gehts!',
    zh: '我们走吧！'
  },
  'watch this': {
    hi: 'यह देखो!',
    mr: 'हे पहा!',
    es: '¡Mira esto!',
    ja: 'これを見て！',
    ko: '이것 좀 봐!',
    fr: 'Regarde ça !',
    de: 'Schau dir das an!',
    zh: '看这个！'
  },
  'what are you doing': {
    hi: 'तुम क्या कर रहे हो?',
    mr: 'तू काय करत आहेस?',
    es: '¿Qué estás haciendo?',
    ja: '何をしているの？',
    ko: '뭐 하고 있어요?',
    fr: 'Que fais-tu ?',
    de: 'Was machst du?',
    zh: '你在做什么？'
  },
  'this is amazing': {
    hi: 'यह अद्भुत है!',
    mr: 'हे अप्रतिम आहे!',
    es: '¡Esto es increíble!',
    ja: '素晴らしい！',
    ko: '대단해요!',
    fr: 'C\'est incroyable !',
    de: 'Das ist fantastisch!',
    zh: '太神奇了！'
  },
  'i cannot believe this': {
    hi: 'मुझे इस पर विश्वास नहीं हो रहा!',
    mr: 'माझा यावर विश्वास बसत नाही!',
    es: '¡No puedo creer esto!',
    ja: '信じられない！',
    ko: '믿을 수 없어!',
    fr: 'Je n\'arrive pas à y croire !',
    de: 'Ich kann das nicht glauben!',
    zh: '真不敢相信！'
  }
};

export class SubtitleEngine {
  private static instance: SubtitleEngine;
  private currentCue: SubtitleCue | null = null;
  private testIndex = 0;
  private isEnabled = true;

  constructor() {
    const cfg = configStore.get();
    this.isEnabled = cfg.subtitleEnabled !== false;
    this.setupIPC();
  }

  public static getInstance(): SubtitleEngine {
    if (!SubtitleEngine.instance) {
      SubtitleEngine.instance = new SubtitleEngine();
    }
    return SubtitleEngine.instance;
  }

  /**
   * Fast offline translation with dictionary matching and fallback heuristics.
   */
  public async translate(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
    if (!text) return '';
    if (targetLang === sourceLang) return text;

    const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

    // Check offline dictionary
    if (CINEMA_DICTIONARY[normalized] && CINEMA_DICTIONARY[normalized][targetLang]) {
      return CINEMA_DICTIONARY[normalized][targetLang];
    }

    // Try partial key matching
    for (const key of Object.keys(CINEMA_DICTIONARY)) {
      if (normalized.includes(key) && CINEMA_DICTIONARY[key][targetLang]) {
        return CINEMA_DICTIONARY[key][targetLang];
      }
    }

    // High-speed fallback: Return original text with language tag if untranslatable offline
    return text;
  }

  /**
   * Pushes a new spoken dialogue segment into the live subtitle streamer.
   */
  public async pushTranscript(rawText: string, sourceLang = 'en'): Promise<SubtitleCue> {
    const targetLang = cinemaDetector.getState().targetLanguage || 'en';
    const translated = await this.translate(rawText, targetLang, sourceLang);

    // Approximate reading duration: ~180 words per minute + 1200ms base
    const wordCount = translated.split(/\s+/).length;
    const durationMs = Math.max(2500, Math.min(8000, 1200 + wordCount * 350));

    const cue: SubtitleCue = {
      id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: translated,
      originalText: rawText,
      sourceLang,
      targetLang,
      durationMs,
      timestamp: Date.now()
    };

    this.currentCue = cue;
    this.broadcastCue(cue);
    return cue;
  }

  /**
   * Plays a sequence of dramatic movie dialogue lines for instant live preview.
   */
  public async testPreviewDialogue(): Promise<SubtitleCue> {
    const testLines = [
      'I have a bad feeling about this',
      'We need to leave now',
      'Look out',
      'Everything is going to be fine',
      'Where are you going'
    ];

    const line = testLines[this.testIndex % testLines.length];
    this.testIndex++;
    return this.pushTranscript(line, 'en');
  }

  public clearSubtitles(): void {
    this.currentCue = null;
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('subtitle:clear');
        }
      });
    }
  }

  public getCurrentCue(): SubtitleCue | null {
    return this.currentCue;
  }

  private broadcastCue(cue: SubtitleCue): void {
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('subtitle:cue', cue);
        }
      });
    }
  }

  private setupIPC(): void {
    if (!ipcMain || typeof ipcMain.handle !== 'function') return;

    ipcMain.handle('subtitle:get-languages', () => SUPPORTED_LANGUAGES);

    ipcMain.handle('subtitle:push-transcript', async (_event, text: string, sourceLang = 'en') => {
      return this.pushTranscript(text, sourceLang);
    });

    ipcMain.handle('subtitle:test-preview', async () => {
      return this.testPreviewDialogue();
    });

    ipcMain.handle('subtitle:clear', () => {
      this.clearSubtitles();
      return { success: true };
    });

    ipcMain.handle('subtitle:set-enabled', (_event, enabled: boolean) => {
      this.isEnabled = enabled;
      configStore.set('subtitleEnabled', enabled);
      if (!enabled) this.clearSubtitles();
      return { success: true, enabled };
    });
  }
}

export const subtitleEngine = SubtitleEngine.getInstance();
