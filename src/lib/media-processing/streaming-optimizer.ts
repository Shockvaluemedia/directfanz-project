export interface BandwidthInfo {
  downloadSpeed: number;
  uploadSpeed: number;
  latency: number;
  effectiveBandwidth: number;
}

export interface StreamingManifest {
  url: string;
  format: string;
  qualities: Array<{
    resolution: string;
    bitrate: number;
    codec: string;
  }>;
  duration?: number;
}
