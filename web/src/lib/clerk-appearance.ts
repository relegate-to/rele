import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";
import { C } from "@/lib/theme";

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;

export const clerkAppearance: Appearance = {
  variables: {
    // Core palette — drives Clerk's automatic shade generation
    colorBackground: C.surface,
    colorNeutral: C.text,        // seeds all neutral shades (borders, hover bg, etc.)
    colorPrimary: C.copper,
    colorBorder: C.border,

    // Text
    colorForeground: C.text,
    colorMutedForeground: C.textDim,
    colorPrimaryForeground: C.bg, // text on copper buttons

    // Inputs
    colorInput: C.bg,
    colorInputForeground: C.cream,

    // Misc
    colorShimmer: C.surfaceHi,
    borderRadius: "6px",
    fontFamily: "var(--font-crimson-pro), serif",
    fontSize: "15px",
  },
  elements: {
    card: {
      border: `1px solid ${C.border}`,
      boxShadow: "none",
      background: C.surface,
    },
    headerTitle: {
      fontFamily: "var(--font-lora), serif",
      fontWeight: 400,
      color: C.cream,
    },
    headerSubtitle: {
      color: C.textDim,
      fontFamily: "var(--font-crimson-pro), serif",
    },
    formFieldLabel: {
      color: C.textDim,
      fontFamily: "var(--font-dm-mono), monospace",
      fontSize: "0.65rem",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    },
    formFieldInput: {
      background: C.bg,
      border: `1px solid ${C.border}`,
      color: C.cream,
      fontFamily: "var(--font-crimson-pro), serif",
    },
    formButtonPrimary: {
      background: C.copper,
      color: C.bg,
      fontFamily: "var(--font-dm-mono), monospace",
      fontSize: "0.72rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
    footerActionLink: {
      color: C.copper,
    },
    dividerLine: {
      background: C.border,
    },
    dividerText: {
      color: C.muted,
    },
    identityPreviewEditButton: {
      color: C.copper,
    },
    socialButtonsBlockButton: {
      border: `1px solid ${C.border}`,
      background: C.bgWarm,
      color: C.text,
    },
    socialButtonsBlockButtonText: {
      color: C.text,
    },
    socialButtonsBlockButtonArrow: {
      color: C.textDim,
    },
    socialButtonsProviderIcon: {
      filter: "brightness(0) invert(1)",
    },
    badge: {
      background: C.surfaceHi,
      color: C.textDim,
      border: `1px solid ${C.borderHi}`,
    },
  },
};
