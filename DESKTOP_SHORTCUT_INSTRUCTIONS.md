# 🖥️ Desktop Shortcut Setup Instructions

## Quick Setup

1. **Right-click** on your desktop
2. **Select** "New" → "Shortcut"
3. **Enter** this path as the target:
   ```
   C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker\start-psh-app.bat
   ```
4. **Name** the shortcut "PSH Tracking Platform"
5. **Click** "Finish"

## Alternative: Use the PowerShell Script

If you prefer to use the PowerShell script (recommended for Windows 10/11):

1. **Right-click** on your desktop
2. **Select** "New" → "Shortcut"
3. **Enter** this path as the target:
   ```
   powershell.exe -ExecutionPolicy Bypass -File "C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker\start-psh-app.ps1"
   ```
4. **Name** the shortcut "PSH Tracking Platform"
5. **Click** "Finish"

## What the Shortcut Does

When you double-click the shortcut, it will:

1. ✅ **Check** if Node.js and npm are installed
2. ✅ **Install dependencies** if needed (first time only)
3. ✅ **Start** the development server on localhost:5175
4. ✅ **Wait** 5-6 seconds for the server to start
5. ✅ **Open Chrome** automatically to your PSH application
6. ✅ **Run** the server in a minimized window

## Stopping the Server

To stop the development server:
- Look for a minimized command window or PowerShell window
- Close that window to stop the server

## Troubleshooting

### If the shortcut doesn't work:
1. **Check** that the path in the shortcut target is correct
2. **Make sure** Node.js is installed on your system
3. **Try** running the batch file directly first to test

### If Chrome doesn't open automatically:
1. **Check** that Chrome is installed
2. **Manually** navigate to http://localhost:5175
3. **The server should still be running** in the background

### If you get permission errors:
1. **Right-click** the shortcut
2. **Select** "Run as administrator"

## Customizing

You can modify the scripts to:
- Change the port number (currently 5175)
- Use a different browser
- Adjust the wait time
- Add additional startup tasks

## Files Created

- `start-psh-app.bat` - Batch script version
- `start-psh-app.ps1` - PowerShell script version (recommended)
- `create-desktop-shortcut.ps1` - Automated shortcut creator
- `DESKTOP_SHORTCUT_INSTRUCTIONS.md` - This instruction file

---

**🎯 Goal**: One-click access to your PSH Tracking Platform with real applicant data!
