import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.adityapro.app',
  appName: 'AdityaPro',
  webDir: 'public',
  server: {
    url: 'https://adityapro.in',
    cleartext: true
  }
};

export default config;