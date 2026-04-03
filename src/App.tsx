/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Mail, Lock, LogIn, LayoutGrid, Sun, Moon } from "lucide-react";
import { useState, MouseEvent, useEffect } from "react";

export default function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };
  
  // Tilt effect values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["4deg", "-4deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-4deg", "4deg"]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: -30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const childVariants = {
    hidden: { y: -15, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const revealVariants = {
    hidden: { y: "-110%" },
    visible: {
      y: 0,
      transition: {
        duration: 1,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const childRevealVariants = {
    hidden: { y: "-110%" },
    visible: {
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative min-h-screen flex flex-col"
    >
      {/* Global Background Elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.8 },
            visible: { opacity: 1, scale: 1, transition: { duration: 2, ease: "easeOut" } }
          }}
          className="absolute top-[-10%] left-[-10%] w-[70%] sm:w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[80px] sm:blur-[120px]" 
        />
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.8 },
            visible: { opacity: 1, scale: 1, transition: { duration: 2, delay: 0.5, ease: "easeOut" } }
          }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] sm:w-[40%] h-[40%] bg-primary/10 rounded-full blur-[70px] sm:blur-[100px]" 
        />
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.8 },
            visible: { opacity: 1, scale: 1, transition: { duration: 2, delay: 1, ease: "easeOut" } }
          }}
          className="absolute top-[20%] right-[10%] w-24 sm:w-32 h-24 sm:h-32 bg-tertiary/20 rounded-full blur-[40px] sm:blur-[60px]" 
        />
      </div>

      {/* Header */}
      <motion.header 
        variants={{
          ...itemVariants,
          visible: { ...itemVariants.visible, transition: { ...itemVariants.visible.transition, delay: 0.2 } }
        }}
        className="relative z-50 flex justify-between items-center px-8 py-6"
      >
        <div className="overflow-hidden">
          <motion.div 
            variants={{
              ...revealVariants,
              visible: { ...revealVariants.visible, transition: { ...revealVariants.visible.transition, delay: 0.2 } }
            }}
            className="text-2xl font-black text-on-surface tracking-tighter uppercase"
          >
            Curator
          </motion.div>
        </div>

        <div className="overflow-hidden">
          <motion.button 
            onClick={toggleTheme}
            variants={{
              ...childRevealVariants,
              visible: { ...childRevealVariants.visible, transition: { ...childRevealVariants.visible.transition, delay: 0.3 } }
            }}
            className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all duration-300"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </motion.button>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 sm:px-8 md:px-12 lg:px-20 py-12">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Side: Headline */}
          <motion.div 
            variants={{
              ...itemVariants,
              visible: { ...itemVariants.visible, transition: { ...itemVariants.visible.transition, delay: 0.4 } }
            }}
            className="lg:col-span-6 flex flex-col justify-center text-center lg:text-left"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-on-surface leading-[1.2] tracking-tighter">
              <div className="overflow-hidden pb-2 -mb-2">
                <motion.span 
                  variants={{
                    ...revealVariants,
                    visible: { ...revealVariants.visible, transition: { ...revealVariants.visible.transition, delay: 0.4 } }
                  }}
                  className="inline-block"
                >
                  Leads Powered by
                </motion.span>
              </div>
              <div className="overflow-hidden pb-4 -mb-4">
                <motion.span 
                  variants={{
                    ...revealVariants,
                    visible: {
                      ...revealVariants.visible,
                      transition: {
                        ...revealVariants.visible.transition,
                        duration: 1.2,
                        delay: 0.6
                      }
                    }
                  }}
                  className="animated-gradient-text inline-block"
                >
                  Intelligence
                </motion.span>
              </div>
            </h1>
          </motion.div>

          {/* Right Side: Sign In Card */}
          <motion.div 
            variants={{
              ...itemVariants,
              visible: { ...itemVariants.visible, transition: { ...itemVariants.visible.transition, delay: 0.8 } }
            }}
            className="lg:col-span-6 flex justify-center lg:justify-end [perspective:1000px]"
          >
            <motion.div 
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              onMouseMove={handleMouseMove}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={handleMouseLeave}
              className="glass-panel w-full max-w-[480px] p-6 sm:p-8 lg:p-12 rounded-xl sm:rounded-2xl relative"
            >
              {/* Dynamic Glass Reflection */}
              <motion.div 
                animate={{ 
                  backgroundPosition: isHovered ? "100% 0%" : "0% 0%" 
                }}
                transition={{ duration: 0.5 }}
                className="glass-reflection" 
              />
              
              <div className="relative z-10" style={{ transform: "translateZ(50px)" }}>
                <div className="mb-8 lg:mb-10 text-center lg:text-left">
                  <div className="overflow-hidden pb-2 -mb-2">
                    <motion.h2 
                      variants={{
                        ...childRevealVariants,
                        visible: { ...childRevealVariants.visible, transition: { ...childRevealVariants.visible.transition, delay: 0.85 } }
                      }}
                      className="text-2xl sm:text-3xl font-bold text-on-surface mb-2"
                    >
                      Sign In
                    </motion.h2>
                  </div>
                  <div className="overflow-hidden pb-1 -mb-1">
                    <motion.p 
                      variants={{
                        ...childRevealVariants,
                        visible: {
                          ...childRevealVariants.visible,
                          transition: {
                            ...childRevealVariants.visible.transition,
                            delay: 0.9
                          }
                        }
                      }}
                      className="text-on-surface-variant text-sm sm:text-base font-medium"
                    >
                      Access your intelligent dashboard
                    </motion.p>
                  </div>
                </div>

                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  {/* Email Field */}
                  <motion.div 
                    variants={{
                      ...childVariants,
                      visible: { ...childVariants.visible, transition: { ...childVariants.visible.transition, delay: 0.95 } }
                    }} 
                    className="space-y-2"
                  >
                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary/50 ml-1 font-mono">
                      Email Address
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 w-4 h-4 group-focus-within:text-primary transition-colors" />
                      <input 
                        type="email"
                        placeholder="name@curator.ai"
                        className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-4 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-white/[0.05] transition-all duration-300 text-xs font-mono"
                      />
                    </div>
                  </motion.div>

                  {/* Password Field */}
                  <motion.div 
                    variants={{
                      ...childVariants,
                      visible: { ...childVariants.visible, transition: { ...childVariants.visible.transition, delay: 1.0 } }
                    }} 
                    className="space-y-2"
                  >
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary/50 font-mono">
                        Password
                      </label>
                      <a href="#" className="text-[9px] font-bold text-secondary/60 hover:text-secondary transition-colors uppercase tracking-widest font-mono">
                        Forgot?
                      </a>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4 group-focus-within:text-primary transition-colors" />
                      <input 
                        type="password"
                        placeholder="••••••••"
                        className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-4 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-white/[0.05] transition-all duration-300 text-xs font-mono"
                      />
                    </div>
                  </motion.div>

                  <motion.button 
                    variants={{
                      ...childVariants,
                      visible: { ...childVariants.visible, transition: { ...childVariants.visible.transition, delay: 1.05 } }
                    }}
                    whileHover={{ scale: 1.01, translateY: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-4 bg-gradient-to-r from-primary to-primary-dim text-on-primary font-bold rounded-lg neon-glow transition-all duration-300 flex items-center justify-center space-x-2 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <motion.div 
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                    />
                    <span className="relative z-10 uppercase tracking-widest text-xs font-bold">Sign In</span>
                    <LogIn className="w-4 h-4 relative z-10" />
                  </motion.button>
                </form>

                {/* SSO Options */}
                <motion.div 
                  variants={{
                    ...childVariants,
                    visible: { ...childVariants.visible, transition: { ...childVariants.visible.transition, delay: 1.1 } }
                  }} 
                  className="grid grid-cols-2 gap-4 mt-8"
                >
                  <button className="flex items-center justify-center py-3 bg-white/[0.03] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-colors group">
                    <img 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuABYa76y9WpUqcbapG4GmT2FVc5iwDj4Y_w-T4kFFjqIPL3IOw4qv9GYa0xpJZADfLZnJsYXyBIkroW2PRttD2ARMz5sfJdyXjGbpxtDyym03CmOgQRcZSSEKJyt6eMOJO85GSp_j583wcJN-NQmgWgbmFPaO2RsNQ2i3mjid2eF5Ta88T9TJGDhodyLaaR7ZUoW88g-p-EVi16WBgUTAaa6Y1ob7mRhS03et8jL_7WEYQr98rGCDP1j4wJkXdJNABmdOJ_k1WaXddi" 
                      alt="Google" 
                      className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                  <button className="flex items-center justify-center py-3 bg-white/[0.03] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-colors group">
                    <LayoutGrid className="w-5 h-5 text-on-surface-variant/60 group-hover:text-on-surface transition-colors" />
                  </button>
                </motion.div>

                <motion.p 
                  variants={{
                    ...childVariants,
                    visible: { ...childVariants.visible, transition: { ...childVariants.visible.transition, delay: 1.15 } }
                  }} 
                  className="mt-8 text-center text-[10px] text-on-surface-variant/50 font-mono uppercase tracking-wider"
                >
                  Don't have an account? <a href="#" className="text-primary/60 font-bold hover:text-primary transition-colors">Join the Network</a>
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-50 flex flex-col items-center justify-center pb-8 pt-4 px-4">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-4 overflow-hidden">
          <motion.div 
            variants={{
              ...revealVariants,
              visible: { ...revealVariants.visible, transition: { ...revealVariants.visible.transition, delay: 1.4 } }
            }}
            className="flex flex-wrap justify-center gap-x-8 gap-y-4"
          >
            {["Privacy Policy", "Terms of Service", "Status"].map((link) => (
              <a 
                key={link}
                href="#" 
                className="text-slate-500 text-[10px] sm:text-xs font-medium uppercase tracking-widest hover:text-white transition-opacity duration-300"
              >
                {link}
              </a>
            ))}
          </motion.div>
        </div>
        <div className="overflow-hidden">
          <motion.div 
            variants={{
              ...revealVariants,
              visible: {
                ...revealVariants.visible,
                transition: {
                  ...revealVariants.visible.transition,
                  delay: 1.5
                }
              }
            }}
            className="text-slate-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-60 text-center"
          >
            © 2024 Curator Intelligence. All rights reserved.
          </motion.div>
        </div>
      </footer>
    </motion.div>
  );
}
