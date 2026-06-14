/// <reference types="vite/client" />

interface FishSwarmBridge {
  getApiBaseUrl: () => string;
  getPlatform: () => string;
}

interface Window {
  fishswarm?: FishSwarmBridge;
}
