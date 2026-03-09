import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.adityapro.app',
  appName: 'Aditya Pro',
  webDir: 'public',
  server: {
    url: 'https://adityapro.in',
    cleartext: true
  }
};

export default config;