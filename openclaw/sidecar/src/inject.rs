// Mirror of the previous inject.mjs: design tokens for canvas, dialog fix,
// and forced theme settings.

const CANVAS_STYLES: &str = r#"
          <style>
            :root {
              --bg:           #ffffff;
              --bg-warm:      #fafafa;
              --surface:      #f4f4f5;
              --surface-hi:   #e4e4e7;
              --border:       #d4d4d8;
              --border-hi:    #a1a1aa;
              --text:         #09090b;
              --text-dim:     #52525b;
              --muted:        #a1a1aa;
              --accent:       #6366f1;
              --accent-dim:   #818cf8;
              --accent-subtle: rgba(99, 102, 241, 0.1);
              --status-success:        #16a34a;
              --status-success-bg:     rgba(22,  163,  74, 0.08);
              --status-success-border: rgba(22,  163,  74, 0.3);
              --status-success-text:   #15803d;
              --status-warning:        #d97706;
              --status-warning-bg:     rgba(217, 119,  6,  0.08);
              --status-warning-border: rgba(217, 119,  6,  0.3);
              --status-warning-text:   #b45309;
              --status-error:          #dc2626;
              --status-error-bg:       rgba(220,  38,  38, 0.08);
              --status-error-border:   rgba(220,  38,  38, 0.3);
              --status-error-text:     #b91c1c;
              --status-info:           #6366f1;
              --status-info-bg:        rgba(99,  102, 241, 0.08);
              --status-info-border:    rgba(99,  102, 241, 0.3);
              --status-info-text:      #4f46e5;
            }
            @media (prefers-color-scheme: dark) {
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
                --status-warning-bg:     rgba(251, 191,  36, 0.08);
                --status-warning-border: rgba(251, 191,  36, 0.3);
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
            }
            html, body {
              background: var(--bg) !important;
              color: var(--text) !important;
              -webkit-font-smoothing: antialiased;
            }
          </style>
"#;

const COMMON_SCRIPT: &str = r#"
          <style>
            /* OpenClaw uses <dialog open> (not showModal()) so dialogs sit in
             * normal flow as position:absolute and end up thousands of pixels
             * down a tall document when viewed inside an iframe. Force into
             * viewport with position:fixed until OpenClaw fixes this itself. */
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
          </script>"#;

fn build_injection(path: &str) -> String {
    let mut out = String::new();
    if path.starts_with("/__openclaw__/canvas") {
        out.push_str(CANVAS_STYLES);
    }
    out.push_str(COMMON_SCRIPT);
    out
}

pub fn inject_into_html(html: &str, path: &str) -> String {
    let injection = build_injection(path);
    if let Some(pos) = html.find("<head>") {
        let cut = pos + "<head>".len();
        let mut s = String::with_capacity(html.len() + injection.len());
        s.push_str(&html[..cut]);
        s.push_str(&injection);
        s.push_str(&html[cut..]);
        s
    } else {
        format!("{}{}", injection, html)
    }
}
