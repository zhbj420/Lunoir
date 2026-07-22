# winget manifests

Manifests for submitting Lunoir to the Windows Package Manager
([microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)), so people can
`winget install Yao666.Lunoir`. One folder per version.

## Submitting a version (e.g. `0.6.0/`)

**Easy path — [wingetcreate](https://github.com/microsoft/winget-create):**

```powershell
winget install wingetcreate
# regenerates + validates + opens the PR for you, prompting for the release URL:
wingetcreate new https://github.com/zhbj420/Lunoir/releases/download/v0.6.0/Lunoir-0.6.0-setup.exe
```

**Manual path — use the files in this folder:**
1. Fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).
2. Copy the three `Yao666.Lunoir.*.yaml` files into
   `manifests/y/Yao666/Lunoir/0.6.0/` in your fork.
3. Validate locally: `winget validate --manifest manifests/y/Yao666/Lunoir/0.6.0`
   (optionally `winget install --manifest ...` in a sandbox to test).
4. Open a PR to `microsoft/winget-pkgs`. A bot validates; a moderator reviews.

## Updating for a new release

1. Copy this folder to `<new-version>/`.
2. In all three files, bump `PackageVersion`.
3. In `*.installer.yaml`: update `InstallerUrl`, `ReleaseDate`, and
   **`InstallerSha256`** — compute it from the exact file attached to the GitHub
   release:
   ```powershell
   (Get-FileHash .\dist\Lunoir-<version>-setup.exe -Algorithm SHA256).Hash
   ```
   (The local `dist/…-setup.exe` matches the uploaded asset as long as you upload the
   build you produced.)
4. In `*.locale.en-US.yaml`: update `ReleaseNotesUrl`.

## Notes

- Installer is the electron-builder **NSIS** `setup.exe`, per-user (`Scope: user`).
- The portable `.exe` is intentionally left out (winget users want the installer).
- `PackageIdentifier` is `Yao666.Lunoir` — keep it stable across versions.
