"use client";

import { useState } from "react";

/**
 * macOS-accurate traffic light buttons.
 * Real dimensions: 12px circles, 8px gap (20px center-to-center).
 */
export function TrafficLights() {
  const [hovered, setHovered] = useState(false);

  const close = () => window.__TAURI__?.window?.getCurrentWindow().close();
  const minimize = () => window.__TAURI__?.window?.getCurrentWindow().minimize();
  const maximize = () => window.__TAURI__?.window?.getCurrentWindow().toggleMaximize();

  return (
    <div
      className="flex items-center gap-[8px] py-[1px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Close */}
      <button
        onClick={close}
        className="flex size-[12px] items-center justify-center rounded-full border border-[#df4744]/60 bg-[#ff5f57] focus:outline-none active:bg-[#bf4943]"
        aria-label="Close"
      >
        {hovered && (
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="#4d0000" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/* Minimize */}
      <button
        onClick={minimize}
        className="flex size-[12px] items-center justify-center rounded-full border border-[#d89e33]/60 bg-[#febc2e] focus:outline-none active:bg-[#bf9123]"
        aria-label="Minimize"
      >
        {hovered && (
          <svg width="6" height="1" viewBox="0 0 6 1" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.5 0.5H5.5" stroke="#985700" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/* Maximize */}
      <button
        onClick={maximize}
        className="flex size-[12px] items-center justify-center rounded-full border border-[#27a82e]/60 bg-[#28c840] focus:outline-none active:bg-[#1f9a31]"
        aria-label="Maximize"
      >
        {hovered && (
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 0.5L5.5 5.5L0.5 5.5" stroke="#0d4807" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0.5 5.5L0.5 0.5L5.5 0.5" stroke="#0d4807" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
