export function buildInjection(url) {
  const isCanvas = url.pathname.startsWith("/__openclaw__/canvas");

  const canvasStyles = isCanvas ? `
          <style>
            /* rele branding: design tokens */
            :root {
              --bg:           #09090b;
              --bg-warm:      #111113;
              --surface:      #111113;
              --surface-hi:   #1e1e23;
              --border:       #27272a;
              --border-hi:    #3f3f46;
              --text:         #fafafa;
              --text-dim:     #a1a1aa;
              --muted:        #52525b;
              --accent:       #818cf8;
              --accent-dim:   #6366f1;
              --accent-subtle: rgba(129, 140, 248, 0.1);

              --status-success:        #4ade80;
              --status-success-bg:     rgba(74,  222, 128, 0.08);
              --status-success-border: rgba(74,  222, 128, 0.3);
              --status-success-text:   #86efac;

              --status-warning:        #fbbf24;
              --status-warning-bg:     rgba(251, 191, 36,  0.08);
              --status-warning-border: rgba(251, 191, 36,  0.3);
              --status-warning-text:   #fde68a;

              --status-error:          #f87171;
              --status-error-bg:       rgba(248, 113, 113, 0.08);
              --status-error-border:   rgba(248, 113, 113, 0.3);
              --status-error-text:     #fca5a5;

              --status-info:           #818cf8;
              --status-info-bg:        rgba(129, 140, 248, 0.08);
              --status-info-border:    rgba(129, 140, 248, 0.3);
              --status-info-text:      #a5b4fc;
            }

            html, body {
              background: #09090b !important;
              color: #fafafa !important;
              -webkit-font-smoothing: antialiased;
            }
          </style>
` : "";

  return `
          ${canvasStyles}
          <style>
            /*
             * HACK: OpenClaw uses <dialog open> (not showModal()) so dialogs sit in
             * normal flow as position:absolute, ending up thousands of pixels down a
             * tall document when viewed inside an iframe. Force them into the viewport
             * with position:fixed until a proper fix lands in OpenClaw itself.
             */
            dialog[open] {
              position: fixed !important;
              inset: unset !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              margin: 0 !important;
              max-height: 90svh !important;
              overflow-y: auto !important;
            }
          </style>
          <script>
            (function() {
              const key = 'openclaw.control.settings.v1';
              const settings = JSON.parse(localStorage.getItem(key) || '{}');
              settings.theme = 'knot';
              localStorage.setItem(key, JSON.stringify(settings));
            })();
          </script>`;
}

export function injectIntoHtml(html, url) {
  const script = buildInjection(url);
  return html.includes("<head>")
    ? html.replace("<head>", `<head>${script}`)
    : script + html;
}
