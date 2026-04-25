interface Window {
  __TAURI__?: {
    window: {
      getCurrentWindow(): {
        close(): Promise<void>;
        minimize(): Promise<void>;
        toggleMaximize(): Promise<void>;
      };
    };
  };
}
