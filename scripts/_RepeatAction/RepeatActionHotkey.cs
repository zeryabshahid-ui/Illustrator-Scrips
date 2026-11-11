// Windows shortcut helper for Zeryab's Illustrator scripts. No dependencies beyond .NET Framework.
// Ctrl+Alt+R runs Repeat Action and Ctrl+Alt+V runs Paste to Replace.
// Shortcuts are registered only while Illustrator is foreground. No key logging.
// Starts with Windows (HKCU Run value "ZeryabIllustratorShortcuts"); tray icon > Exit to stop.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

internal sealed class RepeatActionHotkey : ApplicationContext
{
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] private static extern bool UnregisterHotKey(IntPtr window, int id);

    private readonly string settingsDirectory;
    private readonly string scriptPath;
    private readonly string pastePath;
    private readonly HotkeyWindow receiver;
    private readonly System.Windows.Forms.Timer timer;
    private readonly NotifyIcon tray;
    private bool registered;
    private bool busy;
    private const string IdleState = "Shortcut helper is running. Ctrl+Alt+R (Repeat Action) and Ctrl+Alt+V (Paste to Replace) activate when Illustrator is in front.";
    private string state = IdleState;
    private DateTime lastWrite = DateTime.MinValue;

    private sealed class HotkeyWindow : NativeWindow, IDisposable
    {
        public Action<int> Pressed;
        public HotkeyWindow() { CreateHandle(new CreateParams { Caption = "Zeryab Repeat Action Hotkey" }); }
        protected override void WndProc(ref Message message)
        {
            if (message.Msg == 0x0312 && Pressed != null) { Pressed(message.WParam.ToInt32()); }
            base.WndProc(ref message);
        }
        public void Dispose() { DestroyHandle(); }
    }

    private RepeatActionHotkey()
    {
        settingsDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ZeryabRepeatAction");
        Directory.CreateDirectory(settingsDirectory);
        // Paths follow this folder, wherever the download lives. Do not hardcode a drive or Scripts directory.
        // RepeatActionRun.jsx sits beside the exe; PasteToReplace.jsx is one folder up (scripts/ in this repo).
        scriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "RepeatActionRun.jsx");
        pastePath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "PasteToReplace.jsx"));
        receiver = new HotkeyWindow(); receiver.Pressed = OnHotkey;
        var menu = new ContextMenuStrip();
        menu.Items.Add("Repeat Action - Ctrl+Alt+R").Enabled = false;
        menu.Items.Add("Paste to Replace - Ctrl+Alt+V").Enabled = false;
        menu.Items.Add("Exit shortcut helper", null, delegate { ExitThread(); });
        tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "Illustrator shortcuts - Ctrl+Alt+R / Ctrl+Alt+V", ContextMenuStrip = menu, Visible = true };
        timer = new System.Windows.Forms.Timer { Interval = 150 };
        timer.Tick += delegate { UpdateRegistration(); };
        timer.Start(); UpdateRegistration();
    }

    private static bool IllustratorIsForeground()
    {
        uint processId;
        GetWindowThreadProcessId(GetForegroundWindow(), out processId);
        if (processId == 0) { return false; }
        try { using (var process = Process.GetProcessById((int)processId)) { return String.Equals(process.ProcessName, "Illustrator", StringComparison.OrdinalIgnoreCase); } }
        catch { return false; }
    }

    private void WriteStatus()
    {
        if ((DateTime.UtcNow - lastWrite).TotalSeconds < 2) { return; }
        try { File.WriteAllText(Path.Combine(settingsDirectory, "hotkey.txt"), state); lastWrite = DateTime.UtcNow; }
        catch { }
    }

    private void UpdateRegistration()
    {
        bool active = IllustratorIsForeground();
        if (active && !registered)
        {
            bool r = RegisterHotKey(receiver.Handle, 1, 0x0001 | 0x0002 | 0x4000, 0x52); // Alt + Ctrl + no repeat + R
            bool v = RegisterHotKey(receiver.Handle, 2, 0x0001 | 0x0002 | 0x4000, 0x56); // Alt + Ctrl + no repeat + V
            registered = true;
            if (r && v) { state = "Ctrl+Alt+R (Repeat Action) and Ctrl+Alt+V (Paste to Replace) are enabled in Illustrator."; }
            else
            {
                state = (r ? "" : "Ctrl+Alt+R ") + (!r && !v ? "and " : "") + (v ? "" : "Ctrl+Alt+V ") +
                    "is already registered by another application. Close the conflicting shortcut utility and try again.";
            }
        }
        else if (!active && registered)
        {
            UnregisterHotKey(receiver.Handle, 1); UnregisterHotKey(receiver.Handle, 2); registered = false;
            state = IdleState;
        }
        WriteStatus();
    }

    private void Notify(string message)
    {
        state = message; lastWrite = DateTime.MinValue; WriteStatus();
        tray.BalloonTipTitle = "Illustrator shortcuts"; tray.BalloonTipText = message;
        tray.BalloonTipIcon = ToolTipIcon.Info; tray.ShowBalloonTip(4000);
    }

    private void OnHotkey(int id)
    {
        if (id == 1) { RunScript(scriptPath, "RepeatActionRun.jsx is missing from the helper folder.", "Could not repeat."); }
        else if (id == 2) { RunScript(pastePath, "PasteToReplace.jsx is missing. Keep it one folder above this helper.", "Could not run Paste to Replace."); }
    }

    private void RunScript(string path, string missing, string failure)
    {
        if (busy || !IllustratorIsForeground()) { return; }
        busy = true;
        object illustrator = null;
        try
        {
            if (!File.Exists(path)) { throw new FileNotFoundException(missing); }
            // Get an existing instance; never launch Illustrator in response to a key.
            illustrator = Marshal.GetActiveObject("Illustrator.Application");
            object result = illustrator.GetType().InvokeMember("DoJavaScriptFile", BindingFlags.InvokeMethod, null, illustrator,
                new object[] { path, Type.Missing, Type.Missing });
            string response = Convert.ToString(result);
            if (response.StartsWith("ERROR|", StringComparison.Ordinal)) { Notify(response.Substring(6)); }
            else { state = response.StartsWith("OK|", StringComparison.Ordinal) ? response.Substring(3) : "Command completed."; lastWrite = DateTime.MinValue; WriteStatus(); }
        }
        catch (Exception error)
        {
            Exception detail = error.InnerException ?? error;
            Notify(failure + " Close any Illustrator dialog and try again. " + detail.Message);
        }
        finally
        {
            if (illustrator != null && Marshal.IsComObject(illustrator)) { Marshal.ReleaseComObject(illustrator); }
            busy = false;
        }
    }

    protected override void ExitThreadCore()
    {
        timer.Stop(); timer.Dispose();
        if (registered) { UnregisterHotKey(receiver.Handle, 1); UnregisterHotKey(receiver.Handle, 2); }
        receiver.Dispose(); tray.Visible = false; tray.Dispose();
        try { File.Delete(Path.Combine(settingsDirectory, "hotkey.txt")); } catch { }
        base.ExitThreadCore();
    }

    [STAThread]
    private static void Main()
    {
        bool created;
        using (var mutex = new Mutex(true, "Local\\ZeryabIllustratorRepeatActionHotkey", out created))
        {
            if (!created) { return; }
            try
            {
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new RepeatActionHotkey());
            }
            catch (Exception error) { MessageBox.Show(error.Message, "Repeat Action shortcut"); }
            finally { mutex.ReleaseMutex(); }
        }
    }
}
