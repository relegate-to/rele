"use client";

import { useState } from "react";

export function TrafficLights() {
  const [hovered, setHovered] = useState(false);

  const close = () => window.__TAURI__?.window?.getCurrentWindow().close();
  const minimize = () => window.__TAURI__?.window?.getCurrentWindow().minimize();
  const maximize = () => window.__TAURI__?.window?.getCurrentWindow().toggleMaximize();

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Close */}
      <button onClick={close} className="size-3 rounded-full focus:outline-none" aria-label="Close">
        <svg viewBox="0 0 85.4 85.4" xmlns="http://www.w3.org/2000/svg">
          <g clipRule="evenodd" fillRule="evenodd">
            <path d="m42.7 85.4c23.6 0 42.7-19.1 42.7-42.7s-19.1-42.7-42.7-42.7-42.7 19.1-42.7 42.7 19.1 42.7 42.7 42.7z" fill="#e24b41"/>
            <path d="m42.7 81.8c21.6 0 39.1-17.5 39.1-39.1s-17.5-39.1-39.1-39.1-39.1 17.5-39.1 39.1 17.5 39.1 39.1 39.1z" fill="#ed6a5f"/>
            {hovered && (
              <g fill="#460804">
                <path d="m22.5 57.8 35.3-35.3c1.4-1.4 3.6-1.4 5 0l.1.1c1.4 1.4 1.4 3.6 0 5l-35.3 35.3c-1.4 1.4-3.6 1.4-5 0l-.1-.1c-1.3-1.4-1.3-3.6 0-5z"/>
                <path d="m27.6 22.5 35.3 35.3c1.4 1.4 1.4 3.6 0 5l-.1.1c-1.4 1.4-3.6 1.4-5 0l-35.3-35.3c-1.4-1.4-1.4-3.6 0-5l.1-.1c1.4-1.3 3.6-1.3 5 0z"/>
              </g>
            )}
          </g>
        </svg>
      </button>
      {/* Minimize */}
      <button onClick={minimize} className="size-3 rounded-full focus:outline-none" aria-label="Minimize">
        <svg viewBox="0 0 85.4 85.4" xmlns="http://www.w3.org/2000/svg">
          <g clipRule="evenodd" fillRule="evenodd">
            <path d="m42.7 85.4c23.6 0 42.7-19.1 42.7-42.7s-19.1-42.7-42.7-42.7-42.7 19.1-42.7 42.7 19.1 42.7 42.7 42.7z" fill="#e1a73e"/>
            <path d="m42.7 81.8c21.6 0 39.1-17.5 39.1-39.1s-17.5-39.1-39.1-39.1-39.1 17.5-39.1 39.1 17.5 39.1 39.1 39.1z" fill="#f6be50"/>
            {hovered && (
              <path d="m17.8 39.1h49.9c1.9 0 3.5 1.6 3.5 3.5v.1c0 1.9-1.6 3.5-3.5 3.5h-49.9c-1.9 0-3.5-1.6-3.5-3.5v-.1c0-1.9 1.5-3.5 3.5-3.5z" fill="#90591d"/>
            )}
          </g>
        </svg>
      </button>
      {/* Maximize */}
      <button onClick={maximize} className="size-3 rounded-full focus:outline-none" aria-label="Maximize">
        <svg viewBox="0 0 85.4 85.4" xmlns="http://www.w3.org/2000/svg">
          <g clipRule="evenodd" fillRule="evenodd">
            <path d="m42.7 85.4c23.6 0 42.7-19.1 42.7-42.7s-19.1-42.7-42.7-42.7-42.7 19.1-42.7 42.7 19.1 42.7 42.7 42.7z" fill="#2dac2f"/>
            <path d="m42.7 81.8c21.6 0 39.1-17.5 39.1-39.1s-17.5-39.1-39.1-39.1-39.1 17.5-39.1 39.1c0 21.5 17.5 39.1 39.1 39.1z" fill="#61c555"/>
            {hovered && (
              <path d="m31.2 20.8h26.7c3.6 0 6.5 2.9 6.5 6.5v26.7zm23.2 43.7h-26.8c-3.6 0-6.5-2.9-6.5-6.5v-26.8z" fill="#2a6218"/>
            )}
          </g>
        </svg>
      </button>
    </div>
  );
}
