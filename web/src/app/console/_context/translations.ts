// Simple i18n helper for the console UI.
// Extend this file with more languages as needed.
export const translations: Record<string, Record<string, string>> = {
  en: {
    settings: "Settings",
    usage: "Usage",
    chat: "Chat",
    canvas: "Canvas",
    skills: "Skills",
    channels: "Channels",
    features: "Features",
    "scheduled jobs": "Scheduled Jobs",
    terminal: "Terminal",
    "control ui": "Control UI",
    status: "Status",
    // add more keys as used throughout the UI
  },
  ja: {
    settings: "設定",
    usage: "利用状況",
    chat: "チャット",
    canvas: "キャンバス",
    skills: "スキル",
    channels: "チャンネル",
    features: "機能",
    "scheduled jobs": "スケジュールされたジョブ",
    terminal: "ターミナル",
    "control ui": "コントロール UI",
    status: "ステータス",
    // placeholder translations; extend as needed
  },
};
