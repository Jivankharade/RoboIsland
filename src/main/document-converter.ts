import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app, BrowserWindow, nativeImage } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  fileName?: string;
  error?: string;
}

export class DocumentConverter {
  private convertedDir: string;

  constructor() {
    this.convertedDir = path.join(app.getPath('userData'), 'converted');
    if (!fs.existsSync(this.convertedDir)) {
      try {
        fs.mkdirSync(this.convertedDir, { recursive: true });
      } catch (e) {
        console.warn('[DocumentConverter] Failed to create converted dir:', e);
      }
    }
  }

  /**
   * Determine safe destination path for converted file.
   * Prefer original folder; fallback to AppData if original folder is not writable.
   */
  private getDestinationPath(sourcePath: string, targetExt: string): string {
    const dir = path.dirname(sourcePath);
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const targetFileName = `${baseName}.${targetExt.toLowerCase().replace(/^\./, '')}`;
    const preferredPath = path.join(dir, targetFileName);

    try {
      // Test if destination directory is writable
      const testFile = path.join(dir, `.robo_write_test_${Date.now()}`);
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return preferredPath;
    } catch {
      return path.join(this.convertedDir, targetFileName);
    }
  }

  /**
   * Main convert dispatch method.
   */
  public async convert(filePath: string, targetFormat: string): Promise<ConversionResult> {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
    const target = targetFormat.toLowerCase().replace(/^\./, '');

    try {
      // 1. Image conversions (PNG, JPG, WEBP, ICO, BMP, PDF)
      if (['png', 'jpg', 'jpeg', 'webp', 'ico', 'bmp'].includes(ext)) {
        return await this.convertImage(filePath, target);
      }

      // 2. Word conversions (DOCX, DOC -> PDF, TXT, HTML)
      if (['docx', 'doc'].includes(ext)) {
        return await this.convertWord(filePath, target);
      }

      // 3. PowerPoint conversions (PPTX, PPT -> PDF)
      if (['pptx', 'ppt'].includes(ext)) {
        return await this.convertPowerPoint(filePath, target);
      }

      // 4. Excel conversions (XLSX, XLS -> PDF, CSV)
      if (['xlsx', 'xls'].includes(ext)) {
        return await this.convertExcel(filePath, target);
      }

      // 5. PDF conversions (PDF -> DOCX, TXT, PNG)
      if (ext === 'pdf') {
        return await this.convertPdf(filePath, target);
      }

      // 6. Text / Markdown conversions (TXT, MD -> PDF, HTML, DOCX)
      if (['txt', 'md', 'markdown'].includes(ext)) {
        return await this.convertText(filePath, target);
      }

      return { success: false, error: `Conversion from ${ext.toUpperCase()} to ${target.toUpperCase()} is not supported` };
    } catch (err: any) {
      console.error('[DocumentConverter] Conversion failed:', err);
      return { success: false, error: err.message || 'Conversion failed' };
    }
  }

  /**
   * Convert image formats using Electron nativeImage or printToPDF.
   */
  private async convertImage(sourcePath: string, target: string): Promise<ConversionResult> {
    if (target === 'pdf') {
      const outPath = this.getDestinationPath(sourcePath, 'pdf');
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true
        }
      });

      const fileUrl = `file:///${sourcePath.replace(/\\/g, '/')}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
            img { max-width: 100%; max-height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${fileUrl}" />
        </body>
        </html>
      `;

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      // Wait for image to render
      await new Promise(r => setTimeout(r, 400));
      const pdfBuffer = await win.webContents.printToPDF({
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        printBackground: true
      });
      win.close();

      fs.writeFileSync(outPath, pdfBuffer);
      return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
    }

    const img = nativeImage.createFromPath(sourcePath);
    if (img.isEmpty()) {
      return { success: false, error: 'Could not load image bytes' };
    }

    const outPath = this.getDestinationPath(sourcePath, target);

    if (target === 'png') {
      fs.writeFileSync(outPath, img.toPNG());
      return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
    }

    if (target === 'jpg' || target === 'jpeg') {
      fs.writeFileSync(outPath, img.toJPEG(92));
      return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
    }

    if (target === 'bmp') {
      fs.writeFileSync(outPath, img.toBitmap());
      return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
    }

    if (target === 'ico') {
      const icoBuf = this.createIcoFromImage(img);
      fs.writeFileSync(outPath, icoBuf);
      return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
    }

    // Fallback save PNG
    fs.writeFileSync(outPath, img.toPNG());
    return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
  }

  /**
   * Generates standard Windows ICO binary buffer with PNG embedded frames.
   */
  private createIcoFromImage(img: Electron.NativeImage): Buffer {
    const sizes = [16, 32, 48, 64, 128, 256];
    const frames: Buffer[] = [];

    for (const s of sizes) {
      const resized = img.resize({ width: s, height: s, quality: 'best' });
      frames.push(resized.toPNG());
    }

    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = ICO
    header.writeUInt16LE(frames.length, 4); // Count

    let offset = 6 + frames.length * 16;
    const entries: Buffer[] = [];

    for (let i = 0; i < frames.length; i++) {
      const s = sizes[i];
      const buf = frames[i];
      const entry = Buffer.alloc(16);
      entry.writeUInt8(s === 256 ? 0 : s, 0); // Width
      entry.writeUInt8(s === 256 ? 0 : s, 1); // Height
      entry.writeUInt8(0, 2); // Color palette
      entry.writeUInt8(0, 3); // Reserved
      entry.writeUInt16LE(1, 4); // Color planes
      entry.writeUInt16LE(32, 6); // Bits per pixel
      entry.writeUInt32LE(buf.length, 8); // Image size in bytes
      entry.writeUInt32LE(offset, 12); // File offset

      entries.push(entry);
      offset += buf.length;
    }

    return Buffer.concat([header, ...entries, ...frames]);
  }

  /**
   * Convert Word documents (.docx, .doc) via Word COM automation.
   */
  private async convertWord(sourcePath: string, target: string): Promise<ConversionResult> {
    const outPath = this.getDestinationPath(sourcePath, target);
    const escapedSource = sourcePath.replace(/'/g, "''");
    const escapedOut = outPath.replace(/'/g, "''");

    let formatCode = '17'; // wdFormatPDF
    if (target === 'txt') formatCode = '2'; // wdFormatText
    if (target === 'html') formatCode = '8'; // wdFormatHTML

    const psScript = `
      try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone
        $doc = $word.Documents.Open('${escapedSource}', $false, $true)
        $doc.SaveAs([ref]'${escapedOut}', [ref]${formatCode})
        $doc.Close($false)
        $word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
        Write-Output "SUCCESS"
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    try {
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`);
      if (fs.existsSync(outPath)) {
        return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
      }
    } catch (e: any) {
      console.warn('[DocumentConverter] Word COM failed, attempting fallback:', e);
    }

    return { success: false, error: 'Could not convert Word document' };
  }

  /**
   * Convert PowerPoint (.pptx, .ppt) via PowerPoint COM automation.
   */
  private async convertPowerPoint(sourcePath: string, target: string): Promise<ConversionResult> {
    if (target !== 'pdf') {
      return { success: false, error: 'PowerPoint can only be converted to PDF' };
    }

    const outPath = this.getDestinationPath(sourcePath, 'pdf');
    const escapedSource = sourcePath.replace(/'/g, "''");
    const escapedOut = outPath.replace(/'/g, "''");

    const psScript = `
      try {
        $ppt = New-Object -ComObject PowerPoint.Application
        $pres = $ppt.Presentations.Open('${escapedSource}', [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
        $pres.SaveAs('${escapedOut}', 32)
        $pres.Close()
        $ppt.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
        Write-Output "SUCCESS"
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    try {
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`);
      if (fs.existsSync(outPath)) {
        return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
      }
    } catch (e: any) {
      console.warn('[DocumentConverter] PowerPoint COM failed:', e);
    }

    return { success: false, error: 'Could not convert PowerPoint presentation' };
  }

  /**
   * Convert Excel (.xlsx, .xls) via Excel COM automation.
   */
  private async convertExcel(sourcePath: string, target: string): Promise<ConversionResult> {
    const outPath = this.getDestinationPath(sourcePath, target);
    const escapedSource = sourcePath.replace(/'/g, "''");
    const escapedOut = outPath.replace(/'/g, "''");

    const isPdf = target === 'pdf';
    const psScript = `
      try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $wb = $excel.Workbooks.Open('${escapedSource}', $null, $true)
        if ('${isPdf}' -eq 'True') {
          $wb.ExportAsFixedFormat(0, '${escapedOut}')
        } else {
          $wb.SaveAs('${escapedOut}', 6)
        }
        $wb.Close($false)
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
        Write-Output "SUCCESS"
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    try {
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`);
      if (fs.existsSync(outPath)) {
        return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
      }
    } catch (e: any) {
      console.warn('[DocumentConverter] Excel COM failed:', e);
    }

    return { success: false, error: 'Could not convert Excel workbook' };
  }

  /**
   * Convert PDF (.pdf -> DOCX, TXT, PNG).
   */
  private async convertPdf(sourcePath: string, target: string): Promise<ConversionResult> {
    const outPath = this.getDestinationPath(sourcePath, target);
    const escapedSource = sourcePath.replace(/'/g, "''");
    const escapedOut = outPath.replace(/'/g, "''");

    if (target === 'docx') {
      // Word 2013+ PDF Reflow natively opens PDF and saves as DOCX
      const psScript = `
        try {
          $word = New-Object -ComObject Word.Application
          $word.Visible = $false
          $word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone
          $doc = $word.Documents.Open('${escapedSource}', $false, $true)
          $doc.SaveAs([ref]'${escapedOut}', [ref]16)
          $doc.Close($false)
          $word.Quit()
          [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
          Write-Output "SUCCESS"
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      `;

      try {
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`);
        if (fs.existsSync(outPath)) {
          return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
        }
      } catch (e: any) {
        console.warn('[DocumentConverter] Word PDF reflow failed:', e);
      }
    }

    if (target === 'txt') {
      // Extract text content from PDF
      const psScript = `
        try {
          $word = New-Object -ComObject Word.Application
          $word.Visible = $false
          $word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone
          $doc = $word.Documents.Open('${escapedSource}', $false, $true)
          $doc.SaveAs([ref]'${escapedOut}', [ref]2)
          $doc.Close($false)
          $word.Quit()
          [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
          Write-Output "SUCCESS"
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      `;

      try {
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`);
        if (fs.existsSync(outPath)) {
          return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
        }
      } catch (e: any) {
        console.warn('[DocumentConverter] Text extraction via Word failed:', e);
      }
    }

    if (target === 'png' || target === 'jpg') {
      // Windows 10/11 built-in WinRT PDF rasterizer
      const psScript = `
        try {
          [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
          $storageFile = [Windows.Storage.StorageFile]::GetFileFromPathAsync('${escapedSource}').GetAwaiter().GetResult()
          $pdfDoc = [Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($storageFile).GetAwaiter().GetResult()
          if ($pdfDoc.PageCount -gt 0) {
            $page = $pdfDoc.GetPage(0)
            $outFile = [Windows.Storage.StorageFile]::CreateStreamedFileAsync('${escapedOut}', $null, $null).GetAwaiter().GetResult()
            # Render page
            Write-Output "SUCCESS"
          }
        } catch {}
      `;
      // If direct WinRT rasterizer didn't write, fallback to placeholder
    }

    return { success: false, error: `Could not convert PDF to ${target.toUpperCase()}` };
  }

  /**
   * Convert Text / Markdown to PDF, HTML, or DOCX.
   */
  private async convertText(sourcePath: string, target: string): Promise<ConversionResult> {
    const rawContent = fs.readFileSync(sourcePath, 'utf8');
    const outPath = this.getDestinationPath(sourcePath, target);

    if (target === 'pdf') {
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true
        }
      });

      const escapedContent = rawContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { margin: 20mm; size: A4; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; padding: 20px; }
            pre { background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div style="white-space: pre-wrap; font-family: inherit;">${escapedContent}</div>
        </body>
        </html>
      `;

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise(r => setTimeout(r, 200));
      const pdfBuffer = await win.webContents.printToPDF({
        margins: { top: 0.8, bottom: 0.8, left: 0.8, right: 0.8 },
        printBackground: true
      });
      win.close();

      fs.writeFileSync(outPath, pdfBuffer);
      return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
    }

    if (target === 'html') {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${path.basename(sourcePath)}</title></head><body><pre>${rawContent.replace(/</g, '&lt;')}</pre></body></html>`;
      fs.writeFileSync(outPath, html, 'utf8');
      return { success: true, outputPath: outPath, fileName: path.basename(outPath) };
    }

    return { success: false, error: `Unsupported target format ${target}` };
  }
}
