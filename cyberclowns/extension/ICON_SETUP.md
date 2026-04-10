# Adding Custom Icon to Tilloff Extension

## Setup Instructions

### Option 1: Copy Your Existing Icon (Recommended)

1. **Locate your icon.png file** from the `pics` folder
2. **Copy it to the extension directory**:
   ```
   From: SmartSolutions - Hackathon/pics/icon.png
   To:   SmartSolutions - Hackathon/cyberclowns/extension/icon.png
   ```
3. **Reload the extension** in Chrome
4. Your custom icon will now appear in:
   - Extension popup header
   - Chrome extension management page
   - Chrome toolbar

### Option 2: Use Browser Icon

If you don't have a custom icon, the extension will default to a text-based "T" logo:
- White "T" on the login form header
- Clean and minimal design
- Works across all screens

### File Requirements

- **Format**: PNG (recommended) or JPG
- **Size**: 128x128px (will be scaled down automatically)
- **Color**: Works best with solid colors or simple designs
- **Background**: Transparent PNG works best

### Icon Specifications

For best appearance across all sizes:

| Size | Use |
|------|-----|
| 16x16 | Favicon/toolbar |
| 48x48 | Extension page |
| 128x128 | Chrome Web Store |

All sizes can use the same 128x128 PNG - Chrome scales it automatically.

### How to Create a Custom Icon

If you want to create your own:

1. **Use a design tool** (Figma, Photoshop, Canva, Inkscape)
2. **Design dimensions**: 128x128 pixels
3. **Design a "T" logo or Tilloff brand**
4. **Export as PNG** with transparent background
5. **Copy to**: `cyberclowns/extension/icon.png`
6. **Reload extension**

### Testing

After adding the icon:

1. Go to `chrome://extensions/`
2. Look for "Tilloff - Advanced Phishing Analyzer"
3. Verify your custom icon displays
4. Click on the extension in the toolbar
5. Verify icon appears in the popup header

### Icon Fallback

If the icon file is missing:
- Auth page shows "T" logo
- Main dashboard shows no icon (only appears if logged in)
- Extension still functions normally
- No errors in console

### Troubleshooting

**Icon not showing?**
- Verify file is named exactly: `icon.png`
- Verify file is in: `cyberclowns/extension/` folder
- Reload extension (or reload Chrome)
- Check browser console for errors

**Wrong icon showing?**
- Clear Chrome cache (Developer Settings → Clear browsing data)
- Uninstall and reinstall extension
- Use incognito window to test

**File format issues?**
- Convert to PNG using ImageMagick: `convert image.jpg image.png`
- Use online converter if needed
- Ensure it's actually PNG, not renamed JPG
