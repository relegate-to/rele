"use client";

import { createContext, useContext, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const TransitionContext = createContext<{
  navigate: (href: string) => void;
}>({ navigate: () => {} });

export function useNavigate() {
  return useContext(TransitionContext).navigate;
}

export function PageTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const navigating = useRef(false);

  // When the pathname changes, the new page has mounted — release the opacity lock
  useEffect(() => {
    if (navigating.current) {
      navigating.current = false;
      document.body.style.animation = "";
      document.body.style.opacity = "";
    }
  }, [pathname]);

  const navigate = useCallback(
    (href: string) => {
      document.body.style.animation = "none";
      document.body.style.opacity = "1";
      void document.body.offsetHeight;

      document.body.style.animation = "page-exit 0.2s ease-in-out forwards";

      setTimeout(() => {
        document.body.style.animation = "none";
        document.body.style.opacity = "0";
        navigating.current = true;

        startTransition(() => {
          router.push(href);
        });
      }, 200);
    },
    [router]
  );

  return (
    <TransitionContext.Provider value={{ navigate }}>
      {children}
    </TransitionContext.Provider>
  );
}
