# Install ExpressIt

ExpressIt is a local expression library for Adobe After Effects. It does not require an ExpressIt account or an internet connection for expression workflows.

## Requirements

- Adobe After Effects 25.x.
- Windows or macOS.
- Adobe Creative Cloud Desktop for Marketplace or signed-ZXP installation.

Only versions explicitly listed above are supported. Future After Effects versions may work but are not supported until they have passed release testing.

## Install from Adobe Marketplace

1. Install and launch a supported version of After Effects at least once.
2. Open the Adobe Creative Cloud desktop application.
3. Choose **Stock & Marketplace → Plugins**.
4. Search for **ExpressIt**.
5. Select **Get** or the displayed purchase button and complete installation.
6. Restart After Effects.
7. Choose **Window → Extensions → ExpressIt**.
8. Drag the ExpressIt tab into your workspace if you want to dock it.

Adobe's Marketplace installation help is available at <https://helpx.adobe.com/creative-cloud/apps/integration-with-other-apps/manage-plugins/install-plugins-extensions-using-creative-cloud-desktop-app.html>.

## Install a signed ZXP directly

Close After Effects and make sure Creative Cloud Desktop is installed and signed in.

### Windows

Open Command Prompt and run:

```bat
cd "C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent"
UnifiedPluginInstallerAgent.exe /install "C:\path\to\ExpressIt-1.0.0.zxp"
```

### macOS

Open Terminal and run:

```sh
cd "/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/macOS"
./UnifiedPluginInstallerAgent --install "/path/to/ExpressIt-1.0.0.zxp"
```

Replace the example path and version with the downloaded file. Restart After Effects, then choose **Window → Extensions → ExpressIt**.

Adobe's UPIA instructions cover ZXP, CCX, and XDX packages: <https://helpx.adobe.com/creative-cloud/help/working-from-the-command-line.html>.

## Install an unsigned beta ZIP

This method is for invited beta testers and developers only.

1. Extract `expressit-<version>.zip`.
2. Copy the extracted `ExpressIt` folder to:
   - Windows: `%APPDATA%\Adobe\CEP\extensions\ExpressIt`
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions/ExpressIt`
3. Confirm that the folder directly contains `CSXS`, `dist`, and `host`. Avoid an extra nested `ExpressIt/ExpressIt` folder.
4. Enable unsigned CEP extensions.

Windows:

```bat
reg add HKCU\Software\Adobe\CSXS.12 /v PlayerDebugMode /t REG_SZ /d 1 /f
```

macOS:

```sh
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

5. Restart After Effects and choose **Window → Extensions → ExpressIt**.

Set PlayerDebugMode back to `0` after beta testing if unsigned CEP development is no longer required.

## Apply an expression

1. Open a composition and reveal a property in the timeline.
2. Select exactly one property, such as Position, Scale, Rotation, Opacity, or Source Text.
3. Select an expression in ExpressIt.
4. Adjust its controls.
5. Select **Apply**.
6. Preview the animation and use **Edit → Undo** if necessary.

Bounce can be applied to any expression-capable property. It becomes visible when the property has usable keyframe velocity; unsupported values safely retain their original value.

## Update ExpressIt

Install the newer Marketplace or ZXP version over the existing version, then restart After Effects. Your Mine library, Favorites, and settings should remain available. Export an `.evpack` backup before a major update.

Do not keep multiple copies with the `com.khua.expressit` bundle ID in different CEP extension folders.

## Uninstall

For a Marketplace installation, open Creative Cloud Desktop, go to **Manage Plugins**, open the ExpressIt actions menu, and choose **Uninstall**.

For a direct installation, UPIA also provides `/remove` on Windows and `--remove` on macOS. Use `/list all` or `--list all` to confirm the installed plugin name before removal.

## Troubleshooting

| Problem                       | What to check                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| ExpressIt is missing          | Supported AE version, installation result, duplicate bundle IDs, then restart AE          |
| Panel is blank or outdated    | Remove duplicate developer copies and reinstall the current package                       |
| Apply is disabled             | Select exactly one expression-capable property and read the compatibility message         |
| Bounce has no visible effect  | Add keyframes with incoming velocity and move after a keyframe                            |
| Installation reports an error | Update Creative Cloud Desktop and run UPIA from the command line to reveal the error code |
| Saved expressions are missing | Open Settings and use reload or backup restoration; do not overwrite storage manually     |

For support, use the contact link on the ExpressIt product page and include your operating system, exact After Effects version, ExpressIt version, installation method, and the complete error message.
