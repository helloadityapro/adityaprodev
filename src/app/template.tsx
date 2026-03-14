'use client';

import { motion } from 'framer-motion';

/**
 * Standard page transition wrapper for the Aditya Pro application.
 * Uses Framer Motion to provide subtle entry animations for all routes.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        duration: 0.3,
      }}
      className="flex flex-col flex-1 h-full"
    >
      {children}
    </motion.div>
  );
}
