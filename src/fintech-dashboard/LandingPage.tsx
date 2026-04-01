import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import App from "./App";

const APP_WIDTH = 1280;

export function LandingPage() {
  const glitchRef = useRef<HTMLHeadingElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Dynamically set scale so the 1280px-wide App fits the screen-viewport
  const updateScale = useCallback(() => {
    if (!viewportRef.current || !scalerRef.current) return;
    const vpW = viewportRef.current.offsetWidth;
    const scale = vpW / APP_WIDTH;
    scalerRef.current.style.transform = `scale(${scale})`;
    // Adjust container height to match scaled content
    scalerRef.current.parentElement!.style.height = `${800 * scale}px`;
  }, []);

  useEffect(() => {
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [updateScale]);

  // Glitch burst toggler
  useEffect(() => {
    const el = glitchRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        el.classList.add("glitch-active");
        setTimeout(() => {
          el.classList.remove("glitch-active");
          schedule();
        }, 250 + Math.random() * 350);
      }, 1800 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="landing-root">
      {/* === BACKGROUND LAYERS === */}
      <div className="fire-base" />
      <div className="fire-radial-1" />
      <div className="fire-radial-2" />
      <div className="fire-vignette" />
      <div className="fire-grain" />

      {/* === CONTENT === */}
      <div className="landing-body">

        {/* GLITCH HEADLINE */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="headline-container"
        >
          <h1
            ref={glitchRef}
            className="glitch-headline"
            data-text="ONLYGENIUS"
          >
            ONLYGENIUS
          </h1>
        </motion.div>

        {/* LAPTOP MOCKUP STAGE */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="laptop-stage"
        >
          {/* Glow beneath laptop */}
          <div className="laptop-glow-base" />

          <div className="laptop-perspective-wrapper">
            <div className="laptop-3d">

              {/* LID (screen) */}
              <div className="laptop-lid">
                <div className="lid-back-face" />
                <div className="lid-notch" />
                <div className="lid-bezel">
                  {/* Screen content with dynamic scaling */}
                  <div className="screen-viewport" ref={viewportRef}>
                    <div className="app-scaler" ref={scalerRef}>
                      <App />
                    </div>
                  </div>
                  <div className="screen-glare" />
                </div>
              </div>

              {/* HINGE */}
              <div className="laptop-hinge">
                <div className="hinge-strip" />
              </div>

              {/* BASE (keyboard) */}
              <div className="laptop-base">
                <div className="base-top-face">
                  <div className="keyboard-area">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} className="key-cap" />
                    ))}
                  </div>
                  <div className="trackpad-area" />
                </div>
                <div className="base-bottom-face" />
                <div className="base-shadow" />
              </div>

            </div>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="landing-tagline"
        >
          Next-generation prop trading intelligence platform
        </motion.p>
      </div>
    </div>
  );
}
