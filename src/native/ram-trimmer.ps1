$ErrorActionPreference = 'SilentlyContinue'

try {
  Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class RamTrimmer {
    [DllImport("psapi.dll")]
    public static extern bool EmptyWorkingSet(IntPtr hProcess);

    public static long TrimAll() {
        long freedTotal = 0;
        Process[] procs = Process.GetProcesses();
        foreach (Process p in procs) {
            try {
                long before = p.WorkingSet64;
                if (EmptyWorkingSet(p.Handle)) {
                    p.Refresh();
                    long after = p.WorkingSet64;
                    if (before > after) {
                        freedTotal += (before - after);
                    }
                }
            } catch {}
            finally {
                p.Dispose();
            }
        }
        return freedTotal;
    }
}
"@ -ErrorAction SilentlyContinue
} catch {}

[RamTrimmer]::TrimAll() | Out-Null
Write-Output "OK"
