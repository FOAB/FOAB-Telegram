# Mini App design QA

## Source visual truth

- Source screenshot: `C:\Users\louan\AppData\Local\Temp\codex-clipboard-cee04a00-76a7-4442-a6c8-ff8ad19b6321.png`
- Source state: authenticated group settings form in the Telegram Mini App, pt-BR locale, narrow mobile viewport.
- Source dimensions: 461 × 709 pixels. Device pixel ratio was not available in the attachment metadata.
- Reference screenshots: `C:\Users\louan\Documents\Git\FOAB-Telegram\.codex-remote-attachments\01a0a818-6f4e-7a60-8bfa-ed9f95a8959b\a1370d15-e85a-49aa-b77b-51ee416da207\1-Photo-1.jpg` and `C:\Users\louan\Documents\Git\FOAB-Telegram\.codex-remote-attachments\01a0a818-6f4e-7a60-8bfa-ed9f95a8959b\a1370d15-e85a-49aa-b77b-51ee416da207\2-Photo-2.jpg`
- Reference pattern: BotFather grouped lists with section headings, consistent rows, a leading icon or avatar, title and supporting text, and a trailing chevron.

## Implementation evidence

- Local implementation: `http://127.0.0.1:4173/`
- Browser-rendered state: FOAB shell and recoverable error state were captured in the Codex in-app browser at its default viewport.
- Implementation screenshot file: not persisted; the browser capture was inspected directly during QA.
- The authenticated group settings state could not be reached because the local browser session was outside Telegram and had no signed Mini App session.

## Comparison

The source shows the previous single long form. The implementation now has a group list and group settings menu built from the BotFather-style grouped-list pattern. Groups, General, Welcome, Rules, and Goodbye use one full-row interaction with a leading avatar or line icon, supporting text, optional status chip, and trailing chevron. Each row opens its own focused settings or editor view, without an intermediate Messages category. The local browser confirmed the shell renders and the error state is readable, but it could not provide a same-state authenticated capture for the new category menu.

The following surfaces were checked against the existing Telegram-like tokens and the attached reference:

- Typography: system sans-serif, bold section hierarchy, and muted helper text are preserved.
- Spacing and layout: the long form is split into sectioned, touch-sized grouped lists and focused forms with consistent row heights, dividers, and rounded containers.
- Colors and tokens: the existing dark Telegram palette and blue accent remain in use.
- Image quality and assets: the references use compact avatars and line icons; the implementation reuses the FOAB group mark and Tabler icons without adding decorative image assets.
- Copy and content: the new navigation copy is present in en-US, pt-BR, and es-ES catalogs.

## Findings

- No P0, P1, or P2 issue was observable in the shell or error state.
- Same-state authenticated visual comparison is blocked by the missing Telegram `initData` session in the local browser.

## Primary interactions tested

- Local Mini App shell loaded at the Vite URL.
- Error state rendered with a retry action.
- TypeScript and production bundle completed successfully.

## Final result

final result: blocked

Blocker: the authenticated group menu and its category navigation require launch from Telegram, so the rendered category state still needs a real Mini App session check after deployment or local Telegram launch.

## Follow-up: compact settings and activation switches

The BotFather Mini Apps screenshot and the user's FOAB language and activation screenshots were compared with a 390 × 844 synthetic browser preview. Private settings now have a centered icon/title and a compact language row with a separate choice screen. Group language and time zone use the same selected-value pattern. Welcome and goodbye use activation switches; pausing delivery retains saved text.

The synthetic browser rendered the group list, private settings, language picker, group settings, and welcome screen without horizontal overflow or clipped primary controls. Keyboard radio selection, private locale saving, and switch activation were exercised against a mock API. No P0/P1/P2 visual issue remained in these checked states.

Final result: passed for the synthetic browser comparison. The live Telegram WebView and deployed API behavior remain unverified, as in the original QA gate above.
