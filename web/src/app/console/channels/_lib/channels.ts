// Catalog of every channel adapter the OpenClaw gateway supports.
//
// The catalog is the only thing we hardcode. Per-channel fields are rendered
// from the live JSON Schema returned by `config.schema`, so when OpenClaw
// adds/changes a field we don't need to touch this file.
//
// `setupFields` is a curated short-list (the credentials a user actually
// needs to get started) that the Sheet's "Setup" tab promotes from the
// schema. Everything else is rendered under "Advanced".

export type AuthStyle =
  | "bot-token"        // single token paste (Telegram, Discord, Twitch)
  | "oauth-tokens"     // multiple OAuth-ish tokens (Slack)
  | "qr-pair"          // device-link / QR (WhatsApp, WeChat, Zalo personal)
  | "device-link"      // signal-cli style pairing (Signal)
  | "service-account"  // JSON keyfile (Google Chat)
  | "webhook"          // inbound webhook (SMS via Twilio, Synology)
  | "matrix-creds"     // homeserver + token (Matrix)
  | "local-only"       // runs on this host (iMessage)
  | "msteams"          // Bot Framework triple
  | "generic";

export interface ChannelDef {
  id: string;          // matches the key under `channels.*` in openclaw.json
  label: string;
  tagline: string;     // one-line marketing copy under the title
  brand: string;       // hex color used as a subtle accent
  glyph: string;       // emoji fallback (icon component handled by card)
  auth: AuthStyle;
  /** Fields promoted to the Setup tab — keys are dot-paths into the channel slice. */
  setupFields: string[];
  /** Optional human guidance shown above setup fields (1–3 sentences). */
  setupHint?: string;
  /** Numbered steps to get the channel working. Rendered as an ordered list. */
  setupSteps?: string[];
  /** Per-field hint shown under that field's label in the Setup tab. */
  setupFieldHints?: Record<string, string>;
  docsUrl: string;
  /** True when the channel needs a stateful pairing dance (QR/login.run) rather than just credentials. */
  needsPairing?: boolean;
  /** Pairing flow id passed to web.login.* RPC, when applicable. */
  pairingFlow?: "whatsapp" | "telegram" | "wechat" | "zalo" | "signal";
}

const docs = (slug: string) => `https://docs.openclaw.ai/channels/${slug}`;

export const CHANNELS: ChannelDef[] = [
  {
    id: "telegram",
    label: "Telegram",
    tagline: "Fastest setup. Groups, DMs, inline.",
    brand: "#229ED9",
    glyph: "✈️",
    auth: "bot-token",
    setupFields: ["botToken"],
    setupHint: "Telegram bots are free, take ~60 seconds to create, and can be used in DMs or added to any group.",
    setupSteps: [
      "Open Telegram and search for @BotFather.",
      "Send /newbot and pick a display name + username (must end in `bot`).",
      "BotFather replies with an HTTP API token — paste it below.",
    ],
    setupFieldHints: {
      botToken: "Looks like `123456:ABC-DEF…`. Treat it like a password — anyone with it can post as your bot.",
    },
    docsUrl: docs("telegram"),
  },
  {
    id: "discord",
    label: "Discord",
    tagline: "Servers, channels, threads, DMs.",
    brand: "#5865F2",
    glyph: "🎮",
    auth: "bot-token",
    setupFields: ["token"],
    setupHint: "Create a Discord application, add a bot user, then invite that bot to a server you admin.",
    setupSteps: [
      "Go to discord.com/developers/applications and click New Application.",
      "In the sidebar, open Bot → Reset Token, then copy the token.",
      "Under OAuth2 → URL Generator, check `bot` + `applications.commands`, paste the URL into your browser, and add it to a server.",
    ],
    setupFieldHints: {
      token: "Discord bot tokens look like `MTAxNz…`. Rotate from the Bot page if it ever leaks.",
    },
    docsUrl: docs("discord"),
  },
  {
    id: "slack",
    label: "Slack",
    tagline: "Workspace bot via Socket Mode.",
    brand: "#4A154B",
    glyph: "💬",
    auth: "oauth-tokens",
    setupFields: ["botToken", "appToken"],
    setupHint: "Slack apps in Socket Mode don't need a public URL — they connect outbound, so this works from a laptop or homelab.",
    setupSteps: [
      "Go to api.slack.com/apps and create a new app from scratch.",
      "Under Socket Mode, enable it and generate an app-level token with `connections:write`.",
      "Under OAuth & Permissions, add scopes `chat:write`, `im:history`, `app_mentions:read` then install to your workspace.",
    ],
    setupFieldHints: {
      botToken: "Starts with `xoxb-`. Found under OAuth & Permissions after installing the app.",
      appToken: "Starts with `xapp-`. Found under Basic Information → App-Level Tokens.",
    },
    docsUrl: docs("slack"),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    tagline: "Most popular. QR pair from your phone.",
    brand: "#25D366",
    glyph: "📱",
    auth: "qr-pair",
    setupFields: [],
    setupHint: "WhatsApp uses your real account — there's no bot API. The Pair tab will show a QR code; scan it once and the connection stays linked.",
    setupSteps: [
      "Open the Pair tab to get a QR code.",
      "On your phone, open WhatsApp → Settings → Linked Devices → Link a Device.",
      "Scan the QR. After it pairs, this counts as one of your 4 linked devices.",
    ],
    needsPairing: true,
    pairingFlow: "whatsapp",
    docsUrl: docs("whatsapp"),
  },
  {
    id: "signal",
    label: "Signal",
    tagline: "Private messaging via signal-cli.",
    brand: "#3A76F0",
    glyph: "🔐",
    auth: "device-link",
    setupFields: ["account"],
    setupHint: "Signal links via signal-cli, either as a secondary device on your existing account or as a fresh registered number.",
    setupSteps: [
      "Install signal-cli on the host running OpenClaw (`brew install signal-cli` on macOS).",
      "Either link as a secondary device (your phone scans a QR), or register a brand-new phone number.",
      "Paste the resulting account identifier (your phone number in +E164 format) below.",
    ],
    setupFieldHints: {
      account: "Phone number in international format, e.g. `+15551234567`. Leave blank to use the only registered account.",
    },
    needsPairing: true,
    pairingFlow: "signal",
    docsUrl: docs("signal"),
  },
  {
    id: "imessage",
    label: "iMessage",
    tagline: "Native macOS. Full Disk Access required.",
    brand: "#34C759",
    glyph: "💬",
    auth: "local-only",
    setupFields: ["cliPath"],
    setupHint: "iMessage only works when OpenClaw runs on a Mac signed into iMessage. It reads chat.db directly and sends via AppleScript.",
    setupSteps: [
      "System Settings → Privacy & Security → Full Disk Access → add Terminal (or the process running OpenClaw).",
      "Install the helper CLI: `brew install reagent-eng/tap/imsg`.",
      "Confirm `imsg --version` works, then leave the path below at its default.",
    ],
    setupFieldHints: {
      cliPath: "Defaults to `imsg`. Override only if it's not on PATH.",
    },
    docsUrl: docs("imessage"),
  },
  {
    id: "msteams",
    label: "Microsoft Teams",
    tagline: "Enterprise via Bot Framework.",
    brand: "#5059C9",
    glyph: "🏢",
    auth: "msteams",
    setupFields: ["appId", "appPassword", "tenantId"],
    setupHint: "Teams routes through Microsoft Bot Framework. Requires an Azure subscription and admin consent in your tenant.",
    setupFieldHints: {
      appId: "Bot's App (client) ID from the Azure App Registration.",
      appPassword: "Client secret value (not the secret ID).",
      tenantId: "Your Azure AD tenant GUID.",
    },
    docsUrl: docs("msteams"),
  },
  {
    id: "matrix",
    label: "Matrix",
    tagline: "Federated, encrypted, self-hostable.",
    brand: "#0DBD8B",
    glyph: "🌐",
    auth: "matrix-creds",
    setupFields: ["homeserver", "accessToken"],
    setupHint: "Create a dedicated bot user on your homeserver (or matrix.org), log in once to grab an access token, and paste both below.",
    setupFieldHints: {
      homeserver: "Full base URL, e.g. `https://matrix.org` or `https://matrix.yourdomain.com`.",
      accessToken: "From Element: Settings → Help & About → Advanced → Access Token. Treat as a password.",
    },
    docsUrl: docs("matrix"),
  },
  {
    id: "googlechat",
    label: "Google Chat",
    tagline: "Workspace via service account.",
    brand: "#34A853",
    glyph: "💼",
    auth: "service-account",
    setupFields: ["serviceAccountFile", "audience"],
    setupHint: "Google Chat bots authenticate as a service account. Requires a Google Workspace admin to register the app.",
    setupFieldHints: {
      serviceAccountFile: "Absolute path to the downloaded JSON keyfile on the OpenClaw host.",
      audience: "Public HTTPS URL Google posts webhooks to (e.g. `https://gateway.example.com/googlechat`).",
    },
    docsUrl: docs("googlechat"),
  },
  {
    id: "irc",
    label: "IRC",
    tagline: "Channels and DMs on any IRC network.",
    brand: "#7E57C2",
    glyph: "💻",
    auth: "generic",
    setupFields: ["server", "nick"],
    docsUrl: docs("irc"),
  },
  {
    id: "sms",
    label: "SMS",
    tagline: "Twilio inbound webhook.",
    brand: "#F22F46",
    glyph: "✉️",
    auth: "webhook",
    setupFields: ["accountSid", "authToken", "fromNumber"],
    docsUrl: docs("sms"),
  },
  {
    id: "wechat",
    label: "WeChat",
    tagline: "Tencent iLink. QR login, DMs only.",
    brand: "#07C160",
    glyph: "🟢",
    auth: "qr-pair",
    setupFields: [],
    needsPairing: true,
    pairingFlow: "wechat",
    docsUrl: docs("wechat"),
  },
  {
    id: "twitch",
    label: "Twitch",
    tagline: "Stream chat via IRC.",
    brand: "#9146FF",
    glyph: "🎮",
    auth: "bot-token",
    setupFields: ["username", "oauthToken"],
    docsUrl: docs("twitch"),
  },
  {
    id: "nostr",
    label: "Nostr",
    tagline: "Decentralized DMs (NIP-04).",
    brand: "#8E44AD",
    glyph: "🪩",
    auth: "generic",
    setupFields: ["nsec", "relays"],
    docsUrl: docs("nostr"),
  },
  {
    id: "feishu",
    label: "Feishu",
    tagline: "ByteDance work suite.",
    brand: "#3370FF",
    glyph: "🐉",
    auth: "bot-token",
    setupFields: ["appId", "appSecret"],
    docsUrl: docs("feishu"),
  },
  {
    id: "line",
    label: "LINE",
    tagline: "Messaging API.",
    brand: "#06C755",
    glyph: "🟩",
    auth: "bot-token",
    setupFields: ["channelAccessToken", "channelSecret"],
    docsUrl: docs("line"),
  },
  {
    id: "mattermost",
    label: "Mattermost",
    tagline: "Self-hosted Slack alternative.",
    brand: "#1E325C",
    glyph: "🟦",
    auth: "bot-token",
    setupFields: ["server", "token"],
    docsUrl: docs("mattermost"),
  },
  {
    id: "nextcloudtalk",
    label: "Nextcloud Talk",
    tagline: "Self-hosted chat.",
    brand: "#0082C9",
    glyph: "☁️",
    auth: "generic",
    setupFields: ["server", "username", "password"],
    docsUrl: docs("nextcloudtalk"),
  },
  {
    id: "synologychat",
    label: "Synology Chat",
    tagline: "Incoming/outgoing webhooks.",
    brand: "#11487F",
    glyph: "📦",
    auth: "webhook",
    setupFields: ["incomingWebhook", "outgoingToken"],
    docsUrl: docs("synologychat"),
  },
  {
    id: "qq",
    label: "QQ Bot",
    tagline: "Tencent QQ private + group.",
    brand: "#12B7F5",
    glyph: "🐧",
    auth: "bot-token",
    setupFields: ["botAppId", "botSecret"],
    docsUrl: docs("qq"),
  },
  {
    id: "tlon",
    label: "Tlon",
    tagline: "Urbit-based chat.",
    brand: "#000000",
    glyph: "🛸",
    auth: "generic",
    setupFields: ["ship", "code"],
    docsUrl: docs("tlon"),
  },
  {
    id: "yuanbao",
    label: "Yuanbao",
    tagline: "Tencent Yuanbao bot.",
    brand: "#FF6B35",
    glyph: "💴",
    auth: "bot-token",
    setupFields: ["botToken"],
    docsUrl: docs("yuanbao"),
  },
  {
    id: "zalo",
    label: "Zalo",
    tagline: "Vietnamese messenger.",
    brand: "#0068FF",
    glyph: "💌",
    auth: "bot-token",
    setupFields: ["accessToken"],
    docsUrl: docs("zalo"),
  },
  {
    id: "zalopersonal",
    label: "Zalo Personal",
    tagline: "Personal Zalo account via QR.",
    brand: "#0068FF",
    glyph: "📲",
    auth: "qr-pair",
    setupFields: [],
    needsPairing: true,
    pairingFlow: "zalo",
    docsUrl: docs("zalopersonal"),
  },
  {
    id: "voicecall",
    label: "Voice Call",
    tagline: "Plivo/Twilio phone calls.",
    brand: "#FF9500",
    glyph: "☎️",
    auth: "generic",
    setupFields: ["provider", "accountSid", "authToken"],
    docsUrl: docs("voicecall"),
  },
  {
    id: "webchat",
    label: "Web Chat",
    tagline: "Built-in WebSocket UI.",
    brand: "#6366F1",
    glyph: "🌍",
    auth: "generic",
    setupFields: [],
    setupHint: "No credentials needed — exposed at the gateway URL.",
    docsUrl: docs("webchat"),
  },
];

export const CHANNELS_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c])) as Record<string, ChannelDef>;

export interface ChannelState {
  def: ChannelDef;
  /** The raw config slice (e.g. config.channels.telegram), or null if not configured at all. */
  slice: Record<string, unknown> | null;
  enabled: boolean;
  /** Best-effort: do we have at least one credential filled in? */
  configured: boolean;
}

export function deriveChannelStates(
  config: Record<string, unknown> | null | undefined,
): ChannelState[] {
  const channelsCfg = (config?.channels ?? {}) as Record<string, unknown>;
  return CHANNELS.map((def) => {
    const raw = channelsCfg[def.id];
    const slice = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const enabled = slice?.enabled !== false && slice !== null; // default true when present
    const configured = !!slice && def.setupFields.every((k) => {
      const v = (slice as Record<string, unknown>)[k];
      return v !== undefined && v !== null && v !== "";
    });
    return { def, slice, enabled, configured };
  });
}

