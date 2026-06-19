import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bysubotic.quadshot",
  appName: "Quadshot",
  webDir: "dist",
  backgroundColor: "#070b1a",
  ios: {
    backgroundColor: "#070b1a",
    contentInset: "always",
  },
  android: {
    backgroundColor: "#070b1a",
  },
};

export default config;
